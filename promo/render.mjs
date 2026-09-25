// Renders index.html frame-by-frame with headless Chromium.
//   node render.mjs stills 0.5 1.8 2.9 ...   -> stills/t_<time>.png
//   node render.mjs frames [fps] [subframes] -> frames/f_00000.jpg (fps*subframes per second)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode = 'stills', ...args] = process.argv.slice(2);

const browser = await chromium.launch({
  args: ['--force-device-scale-factor=1', '--disable-lcd-text', '--font-render-hinting=none', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(pathToFileURL(path.join(here, 'index.html')).href);
await page.waitForFunction(() => window.READY === true);

if (mode === 'stills') {
  mkdirSync(path.join(here, 'stills'), { recursive: true });
  for (const a of args) {
    const t = parseFloat(a);
    await page.evaluate((t) => window.seek(t), t);
    await page.screenshot({ path: path.join(here, 'stills', `t_${t.toFixed(2)}.png`) });
    console.log('still', t);
  }
} else {
  const fps = Number(args[0] ?? 60);
  const sub = Number(args[1] ?? 1);
  const shutter = 0.6; // fraction of the frame interval the "shutter" is open
  const dir = path.join(here, 'frames');
  mkdirSync(dir, { recursive: true });
  const total = Math.round(15 * fps);
  const t0 = Date.now();
  let n = 0;
  for (let i = 0; i < total; i++) {
    for (let k = 0; k < sub; k++) {
      const t = (i + (sub > 1 ? (k / (sub - 1) - 0.5) * shutter : 0)) / fps;
      await page.evaluate((t) => window.seek(Math.max(0, Math.min(14.999, t))), t);
      await page.screenshot({ path: path.join(dir, `f_${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    }
    if (i % 60 === 0) console.log(`frame ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  console.log('done', n, 'images in', ((Date.now() - t0) / 1000).toFixed(1), 's');
}
await browser.close();
