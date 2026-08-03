/* "Readable Content: text and images must be legible on devices with a
   devicePixelRatio:1, on responsive iframe sizes (16x9 ratio) and mobile
   screens" — CrazyGames gameplay requirements, which then list the iframe
   sizes that matter most to their audience.

   Renders gameplay at each of them at DPR 1 and writes the frames to
   press/iframe-sizes/ for eyeballing, reporting the computed pixel size of the
   smallest HUD type at each. */
import { launch, GAME } from './browser.mjs';
import fs from 'fs';

const SIZES = [
  [907, 510, 'desktop windowed'],
  [1216, 684, 'desktop windowed'],
  [1077, 606, 'desktop windowed'],
  [821, 462, 'desktop windowed — smallest'],
  [1366, 768, 'desktop fullscreen'],
  [1920, 1080, 'desktop fullscreen'],
  [1536, 864, 'desktop fullscreen'],
  [1280, 720, 'desktop fullscreen'],
  [800, 450, 'mobile'],
  [1080, 607, 'tablet'],
];

const OUT = new URL('../press/iframe-sizes/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const browser = await launch();
console.log('rendering at devicePixelRatio 1\n');

for (const [w, h, note] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.route('**/sdk.crazygames.com/**', r => r.abort());
  const page = await ctx.newPage();
  await page.goto(GAME, { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const m = await page.evaluate(() => {
    const px = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
    };
    return {
      unit: getComputedStyle(document.getElementById('stage')).getPropertyValue('--u').trim(),
      label: px('.hudTop .lbl'),      // the smallest type in the HUD
      score: px('#score'),
      speed: px('.spdv'),
      state: window.__NH?.G?.state,
    };
  });

  const file = `${OUT}${w}x${h}.png`;
  await page.screenshot({ path: file });
  const flag = m.label !== null && m.label < 9 ? '  <-- small type' : '';
  console.log(
    `${String(w).padStart(4)}x${String(h).padEnd(4)}  ${note.padEnd(28)}` +
    `unit ${m.unit.padStart(7)}  label ${String(m.label).padStart(5)}px` +
    `  score ${String(m.score).padStart(5)}px  speed ${String(m.speed).padStart(5)}px  [${m.state}]${flag}`
  );
  await ctx.close();
}

console.log(`\nframes written to press/iframe-sizes/`);
await browser.close();
