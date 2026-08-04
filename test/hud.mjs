/* HUD layout under a full load, in portrait.

   The HUD is a three-column rail that reflows into a stack on a phone, and
   most of what it carries is optional: the perk list grows with every level,
   the convoy counter and the wreck-chain banner appear and leave, the heat
   pips fill in. Each of those was laid out while the others were absent.

   A player fifteen levels into a run on a 411px screen has all of them at
   once, and that is when the perk list starts printing over the level bar and
   the pile-up banner runs through both. It shipped that way, and it is not
   the sort of thing a screenshot of an early run ever shows you.

   So this drives a real run deep enough to carry the whole HUD and then asks
   the DOM whether any two live blocks occupy the same pixels. */
import { launch, GAME } from './browser.mjs';

const HUD = ['build', 'obj', 'combo', 'xp', 'wreckChain', 'convoy', 'heat',
             'score', 'coins', 'dchip', 'toasts'];
/* Two blocks may graze by a few pixels through padding without reading as a
   collision; this is about text landing on text. */
const SLOP = 4;

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 411, height: 867 },
                                       deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));

await page.goto(GAME, { waitUntil: 'load' });
await page.waitForTimeout(1500);

/* Drive. Perks are taken as they are offered and the score is pushed along,
   because reaching level 15 honestly takes longer than a test should. */
const t0 = Date.now();
while (Date.now() - t0 < 40000) {
  const k = Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight';
  await page.keyboard.down(k); await page.waitForTimeout(120 + Math.random() * 220);
  await page.keyboard.up(k);   await page.waitForTimeout(90 + Math.random() * 160);
  await page.evaluate(() => {
    const N = window.__NH;
    if (N.G.state === 'levelup') N.takePerk(0);
    if (N.G.state === 'over') document.getElementById('btnAgain')?.click();
    N.G.score += 9000; N.addXP(60);
  });
}

const out = await page.evaluate(({ HUD, SLOP }) => {
  const live = id => {
    const e = document.getElementById(id);
    if (!e) return null;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (!r.width || !r.height || s.display === 'none' ||
        s.visibility === 'hidden' || +s.opacity === 0) return null;
    return { id, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  };
  const boxes = HUD.map(live).filter(Boolean);
  const hits = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > SLOP && oy > SLOP)
        hits.push({ a: a.id, b: b.id, ox: Math.round(ox), oy: Math.round(oy) });
    }
  /* and nothing may reach past the cabinet edge */
  const stage = document.getElementById('stage').getBoundingClientRect();
  const spill = [];
  document.querySelectorAll('#hud *').forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (r.left < stage.left - 1 || r.right > stage.right + 1)
      spill.push((e.id || e.className) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  return { hits, spill: spill.slice(0, 6),
           level: window.__NH.G.run && window.__NH.G.run.level,
           perks: (document.getElementById('build') || {}).childElementCount || 0 };
}, { HUD, SLOP });

console.log('reached level ' + out.level + ' with ' + out.perks + ' perks on the rail');
console.log(out.hits.length
  ? 'FAIL  HUD blocks overlapping: ' + JSON.stringify(out.hits)
  : 'PASS  no HUD blocks overlap');
console.log(out.spill.length
  ? 'FAIL  HUD reaching outside the stage: ' + JSON.stringify(out.spill)
  : 'PASS  HUD stays inside the stage');
console.log('pageerrors:', errs.length ? errs : 'none');

await browser.close();
process.exit(out.hits.length || out.spill.length ? 1 : 0);
