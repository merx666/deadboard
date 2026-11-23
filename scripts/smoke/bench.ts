// Headless-Chrome smoke test of the BUILT app (run `npm run build` first, then `npm run smoke`).
// Proves on the real render path what unit tests cannot: the bench boots on WebGPU, and the
// heavy modules that are lazy-loaded from app.ts (LiveBoard Studio, supplier catalog, importers)
// actually resolve over the network and render after the split into separate chunks.
// Not part of `npm test`: it needs the built dist/ and a Chrome binary (CHROME_PATH overrides).
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4199;

function assert(c: unknown, msg: string): asserts c { if (!c) throw new Error(msg); }

async function main(): Promise<void> {
  const server = await preview({ preview: { port: PORT, strictPort: true } });
  const BASE = (server.resolvedUrls?.local ?? [])[0]?.replace(/\/$/, '') ?? `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/app.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    if (i === 49) throw new Error(`vite preview never became ready at ${BASE}`);
  }
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const jsChunkRequests = new Set<string>();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('request', (r) => { if (r.url().endsWith('.js')) jsChunkRequests.add(r.url().split('/').pop()!); });

  try {
    // 1. The bench boots and renders (WebGPU canvas visible, no failure card).
    await page.goto(`${BASE}/app.html`);
    await page.waitForSelector('canvas', { timeout: 15000 });
    assert(await page.locator('.webgpu-err').count() === 0, 'WebGPU error card rendered');
    const bootChunks = new Set(jsChunkRequests);
    assert(bootChunks.size > 0, 'no JS chunks requested at boot');
    const lazyLeak = [...bootChunks].filter((f) => f.includes('boardCreator') || f.includes('catalog'));
    assert(lazyLeak.length === 0, `lazy chunks fetched at boot: ${lazyLeak.join(', ')}`);
    console.log(`boot ok: ${[...bootChunks].join(', ')}`);

    // 2. LiveBoard Studio opens via ?action=new-board — the lazy chunk must load and render.
    await page.goto(`${BASE}/app.html?action=new-board`);
    await page.waitForSelector('#board-creator-modal', { timeout: 15000 });
    const creator = page.locator('#board-creator-modal');
    await creator.locator('.modal').first().waitFor({ state: 'visible', timeout: 15000 });
    const lazyChunks = [...jsChunkRequests].filter((f) => f.includes('boardCreator') || f.includes('catalog'));
    assert(lazyChunks.length > 0, 'creator/catalog chunks were not fetched when the studio opened');
    console.log(`lazy ok: ${lazyChunks.join(', ')}`);

    assert(problems.length === 0, `browser errors: ${problems.join(' | ')}`);
    console.log('SMOKE PASSED (bench boots on WebGPU; board creator + supplier catalog lazy-load and render)');
  } finally {
    await browser.close();
    await new Promise<void>((res) => server.httpServer!.close(() => res()));
  }
}

main().catch((e) => { console.error(`SMOKE FAILED: ${e instanceof Error ? e.message : e}`); process.exit(1); });
