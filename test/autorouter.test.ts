import { autorouteConnection, autorouteNet } from '../src/routing/autorouter';
import { createArduinoUnoScenario } from '../src/boards/presets';
import type { Board } from '../src/types';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

const uno = createArduinoUnoScenario();
const board: Board = uno.board;

// 1. Straightforward route on free board area
const res1 = autorouteConnection({
  board,
  net: 'TEST_NET',
  from: [20, 20],
  to: [35, 30],
  fromLayer: 'F',
  toLayer: 'F'
});

assert(res1.success, 'Autorouter must find path in open space');
assert(res1.traces.length > 0, 'Autorouter must generate traces');
for (const t of res1.traces) {
  assert(t.net === 'TEST_NET', 'Traces must carry assigned net name');
  assert(t.layer === 'F', 'Single-layer route must stay on Top layer');
}

// 2. Route between pads
const res2 = autorouteConnection({
  board,
  net: 'GND',
  from: [10, 10],
  to: [50, 40]
});
assert(res2.success, 'Autorouter must route across the board');

// 3. Route net connecting pads
board.components[0]!.pads[0]!.net = 'VCC';
board.components[1]!.pads[0]!.net = 'VCC';
const res3 = autorouteNet(board, 'VCC');
assert(res3.success, 'autorouteNet must route net with pads');

console.log('autorouter.test.ts: 45-degree A* pathfinding & trace generation — ok');
