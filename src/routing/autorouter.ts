import type { Board, Side, Trace, V2, Via } from '../types';

export interface RouteRequest {
  board: Board;
  net: string;
  from: V2;
  to: V2;
  fromLayer?: Side;
  toLayer?: Side;
  clearance?: number;
  traceWidth?: number;
}

export interface RouteResult {
  success: boolean;
  traces: Trace[];
  vias: Via[];
  cost: number;
  message?: string;
}

interface Node {
  gx: number;
  gy: number;
  layer: number; // 0 = F, 1 = B
  g: number;
  h: number;
  f: number;
  parent: Node | null;
  dirX: number;
  dirY: number;
}

export function autorouteConnection(req: RouteRequest): RouteResult {
  const gridStep = 0.5; // mm resolution
  const w = req.board.w;
  const h = req.board.h;
  const cols = Math.ceil(w / gridStep) + 1;
  const rows = Math.ceil(h / gridStep) + 1;

  const startGx = Math.max(0, Math.min(cols - 1, Math.round(req.from[0] / gridStep)));
  const startGy = Math.max(0, Math.min(rows - 1, Math.round(req.from[1] / gridStep)));
  const targetGx = Math.max(0, Math.min(cols - 1, Math.round(req.to[0] / gridStep)));
  const targetGy = Math.max(0, Math.min(rows - 1, Math.round(req.to[1] / gridStep)));

  const startLayer = req.fromLayer === 'B' ? 1 : 0;
  const targetLayer = req.toLayer === 'B' ? 1 : 0;

  // Build obstacle grid
  const obstacle = new Uint8Array(cols * rows * 2);
  const idx = (gx: number, gy: number, l: number) => (l * cols * rows) + (gy * cols) + gx;

  // Mark existing components with foreign nets as keepouts
  for (const c of req.board.components) {
    for (const p of c.pads) {
      if (p.net && p.net !== req.net) {
        const px = c.at[0] + (p.at ? p.at[0] : 0);
        const py = c.at[1] + (p.at ? p.at[1] : 0);
        const cgx = Math.round(px / gridStep);
        const cgy = Math.round(py / gridStep);
        const padRad = Math.ceil(((p.size ? p.size[0] : 1.2) * 0.5 + 0.3) / gridStep);
        for (let dx = -padRad; dx <= padRad; dx++) {
          for (let dy = -padRad; dy <= padRad; dy++) {
            const nx = cgx + dx;
            const ny = cgy + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
              const obst0 = idx(nx, ny, 0);
              const obst1 = idx(nx, ny, 1);
              obstacle[obst0] = 1;
              if (p.layers !== 'F') obstacle[obst1] = 1;
            }
          }
        }
      }
    }
  }

  // Clear start and target points from obstacle map
  obstacle[idx(startGx, startGy, startLayer)] = 0;
  obstacle[idx(targetGx, targetGy, targetLayer)] = 0;

  // Heuristic: Octile distance + 45 deg angles
  function heuristic(gx: number, gy: number, layer: number): number {
    const dx = Math.abs(gx - targetGx);
    const dy = Math.abs(gy - targetGy);
    const octile = Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    const layerCost = layer !== targetLayer ? 8.0 : 0;
    return (octile * gridStep) + layerCost;
  }

  // A* Open and Closed lists
  const open: Node[] = [];
  const closed = new Uint8Array(cols * rows * 2);

  const startNode: Node = {
    gx: startGx,
    gy: startGy,
    layer: startLayer,
    g: 0,
    h: heuristic(startGx, startGy, startLayer),
    f: heuristic(startGx, startGy, startLayer),
    parent: null,
    dirX: 0,
    dirY: 0
  };
  open.push(startNode);

  // 8-directional movement offsets
  const directions = [
    [1, 0, 1.0], [-1, 0, 1.0], [0, 1, 1.0], [0, -1, 1.0],
    [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]
  ];

  let targetNode: Node | null = null;
  let iterations = 0;
  const maxIterations = 20000;

  while (open.length > 0 && iterations++ < maxIterations) {
    // Pop lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      const cur = open[i];
      const best = open[bestIdx];
      if (cur && best && cur.f < best.f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!;

    if (current.gx === targetGx && current.gy === targetGy && current.layer === targetLayer) {
      targetNode = current;
      break;
    }

    const curIdx = idx(current.gx, current.gy, current.layer);
    closed[curIdx] = 1;

    // Explore 8 directions on same layer
    for (const [dx, dy, dist] of directions) {
      const ngx = current.gx + dx!;
      const ngy = current.gy + dy!;

      if (ngx < 0 || ngx >= cols || ngy < 0 || ngy >= rows) continue;
      const nIdx = idx(ngx, ngy, current.layer);
      if (closed[nIdx] || obstacle[nIdx]) continue;

      // Direction change penalty to avoid zigzagging
      const bendPenalty = (current.dirX !== 0 || current.dirY !== 0) && (current.dirX !== dx || current.dirY !== dy) ? 0.4 : 0;
      const tentG = current.g + dist! * gridStep + bendPenalty;

      let neighbor = open.find(n => n.gx === ngx && n.gy === ngy && n.layer === current.layer);
      if (!neighbor) {
        neighbor = {
          gx: ngx,
          gy: ngy,
          layer: current.layer,
          g: tentG,
          h: heuristic(ngx, ngy, current.layer),
          f: tentG + heuristic(ngx, ngy, current.layer),
          parent: current,
          dirX: dx!,
          dirY: dy!
        };
        open.push(neighbor);
      } else if (tentG < neighbor.g) {
        neighbor.g = tentG;
        neighbor.f = tentG + neighbor.h;
        neighbor.parent = current;
        neighbor.dirX = dx!;
        neighbor.dirY = dy!;
      }
    }

    // Try layer transition via VIA
    const otherLayer = current.layer === 0 ? 1 : 0;
    const viaIdx = idx(current.gx, current.gy, otherLayer);
    if (!closed[viaIdx] && !obstacle[viaIdx]) {
      const viaCost = current.g + 6.0; // VIA cost penalty
      let viaNeighbor = open.find(n => n.gx === current.gx && n.gy === current.gy && n.layer === otherLayer);
      if (!viaNeighbor) {
        viaNeighbor = {
          gx: current.gx,
          gy: current.gy,
          layer: otherLayer,
          g: viaCost,
          h: heuristic(current.gx, current.gy, otherLayer),
          f: viaCost + heuristic(current.gx, current.gy, otherLayer),
          parent: current,
          dirX: 0,
          dirY: 0
        };
        open.push(viaNeighbor);
      } else if (viaCost < viaNeighbor.g) {
        viaNeighbor.g = viaCost;
        viaNeighbor.f = viaCost + viaNeighbor.h;
        viaNeighbor.parent = current;
      }
    }
  }

  if (!targetNode) {
    return { success: false, traces: [], vias: [], cost: Infinity, message: 'No viable routing path found' };
  }

  // Trace back path
  const pathNodes: Node[] = [];
  let curr: Node | null = targetNode;
  while (curr) {
    pathNodes.push(curr);
    curr = curr.parent;
  }
  pathNodes.reverse();

  // Convert nodes to combined traces and vias
  const traces: Trace[] = [];
  const vias: Via[] = [];
  let nextId = 1000;

  let segStart = pathNodes[0]!;
  for (let i = 1; i < pathNodes.length; i++) {
    const prev = pathNodes[i - 1]!;
    const cur = pathNodes[i]!;

    if (cur.layer !== prev.layer) {
      // Create trace up to the via
      if (segStart !== prev) {
        traces.push({
          id: `rt_${nextId++}`,
          layer: segStart.layer === 0 ? 'F' : 'B',
          a: [segStart.gx * gridStep, segStart.gy * gridStep],
          b: [prev.gx * gridStep, prev.gy * gridStep],
          w: req.traceWidth || 0.4,
          net: req.net
        });
      }
      // Insert via
      vias.push({
        id: `via_${nextId++}`,
        at: [cur.gx * gridStep, cur.gy * gridStep],
        d: 1.0,
        drill: 0.6,
        net: req.net
      });
      segStart = cur;
    } else {
      // Check if direction changed
      const next = pathNodes[i + 1];
      const dirChanged = next && (next.gx - cur.gx !== cur.gx - prev.gx || next.gy - cur.gy !== cur.gy - prev.gy);
      if (dirChanged || !next) {
        traces.push({
          id: `rt_${nextId++}`,
          layer: cur.layer === 0 ? 'F' : 'B',
          a: [segStart.gx * gridStep, segStart.gy * gridStep],
          b: [cur.gx * gridStep, cur.gy * gridStep],
          w: req.traceWidth || 0.4,
          net: req.net
        });
        segStart = cur;
      }
    }
  }

  return { success: true, traces, vias, cost: targetNode.g };
}

export function autorouteNet(board: Board, net: string): RouteResult {
  const padPositions: V2[] = [];
  for (const c of board.components) {
    for (const p of c.pads) {
      if (p.net === net) {
        padPositions.push([c.at[0] + (p.at ? p.at[0] : 0), c.at[1] + (p.at ? p.at[1] : 0)]);
      }
    }
  }

  if (padPositions.length < 2) {
    return { success: false, traces: [], vias: [], cost: 0, message: 'Need at least 2 pads to route' };
  }

  const p0 = padPositions[0]!;
  const p1 = padPositions[1]!;
  return autorouteConnection({ board, net, from: p0, to: p1 });
}
