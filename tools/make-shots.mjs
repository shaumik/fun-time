/* Gameplay screenshots for store pages.
   ------------------------------------------------------------------
   Emits 1920x1080 captures into press/.

   These are not covers. A cover strips the HUD and lays the wordmark over
   the art; a screenshot is meant to look like the game being played, so the
   HUD stays — the chain multiplier climbing and the pile-up counter running
   are the most persuasive things on screen, and hiding them would be hiding
   the pitch.

   Every shot is a real run driven by a bot that aims at traffic rather than
   avoiding it, so the chain in the HUD was actually earned. The moment is
   then staged: cars placed across the lanes ahead, one detonated, and the
   shutter opened mid-blast while the shockwave is still expanding.

   One shot per district, because a store page showing five different-looking
   places sells a deeper game than five shots of the same street.

     node tools/make-shots.mjs
   ------------------------------------------------------------------ */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GAME = 'file://' + path.join(ROOT, 'dist', 'index.html');
const OUT = path.join(ROOT, 'press');

const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = fs.existsSync(PINNED) ? { executablePath: PINNED } : {};

const SHOTS = [
  { name: '01-grid-pileup.png',    theme: 0, lead: 9000,  boss: null,
    zoom: 1.62, rot: 0.42, sx: 60, sy: 130 },
  { name: '02-redline-blast.png',  theme: 4, lead: 8000,  boss: null,
    zoom: 1.70, rot: 0.50, sx: 80, sy: 120 },
  { name: '03-skyport.png',        theme: 3, lead: 7000,  boss: null,
    zoom: 1.55, rot: 0.30, sx: 30, sy: 140 },
  { name: '04-undercity-boss.png', theme: 2, lead: 7000,  boss: 'bulwark',
    zoom: 1.50, rot: 0.35, sx: 40, sy: 100 },
  { name: '05-docks.png',          theme: 1, lead: 8000,  boss: null,
    zoom: 1.62, rot: 0.44, sx: 60, sy: 130 },
];

/* Aim at traffic, not away from it. The weaving bot the covers use is fine
   for scenery but never builds a chain, and the chain is the whole game. */
const BOT = `(() => {
  const N = window.__NH, G = N.G;
  if (G.hp < G.hpMax * 0.55) G.hp = G.hpMax;   // survive long enough to build one
  if (!G.car || G.state !== 'play') return 0;
  const car = G.car, ca = Math.cos(car.a), sa = Math.sin(car.a);
  let best = null, bd = 1e9;
  for (const v of G.traffic) {
    if (v.wrecked) continue;
    const dx = v.x - car.x, dy = v.y - car.y;
    if (ca*dx + sa*dy < 30) continue;
    const d = Math.hypot(dx, dy);
    if (d < 700 && d < bd) { bd = d; best = { dx, dy }; }
  }
  if (!best) { const q = G.track.at(car.idx + 6, 0); best = { dx:q.x-car.x, dy:q.y-car.y }; }
  const cross = ca*best.dy - sa*best.dx;
  return cross > 8 ? 1 : cross < -8 ? -1 : 0;
})()`;

const KEYS = `(w => { const f=(c,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c}));
  f('ArrowLeft', w<0); f('ArrowRight', w>0); })`;

const STAGE = ({ drift = 0.5 }) => `(() => {
  const N = window.__NH, G = N.G;
  const base = G.car.idx + 3;
  const pos = G.track.at(base, 0);
  G.car.x = pos.x; G.car.y = pos.y; G.car.a = pos.a + ${drift};
  G.car.drift = 1; G.car.slip = 0.6;
  G.car.boostT = Math.max(G.car.boostT, 1.5); G.car.boost = 1;

  const lanes = [-20, 95, -105, 45, 120, -60, 15];
  const live = G.traffic.filter(v => !v.wrecked);
  const pool = (live.length >= 7 ? live : G.traffic).slice(0, 7);
  pool.forEach((v, i) => {
    const q = G.track.at(base + 2 + i, lanes[i]);
    v.x = q.x; v.y = q.y; v.a = q.a;
    v.wrecked = 0; v.spin = 0; v.hitFlash = 0;
  });

  G.power.drones = 20;
  G.drones = [-1, 1].map((side, k) => {
    const q = G.track.at(base + 1, side * 78);
    return { x:q.x, y:q.y, side, vx:0, vy:0, target: pool[3+k] || pool[0] || null,
             dwell: 0.24, ang:0 };
  });
})()`;

const DETONATE = `(() => {
  const N = window.__NH, G = N.G;
  const near = G.traffic
    .filter(v => !v.wrecked && !G.drones.some(d => d.target === v))
    .map(v => ({ v, d: Math.hypot(v.x - G.car.x, v.y - G.car.y) }))
    .sort((a, b) => a.d - b.d)[0];
  if (near) { try { N.smash(near.v, 900); } catch (e) {} }
})()`;

const AIM = ({ zoom, rot, sx, sy }) => `(() => {
  const N = window.__NH, G = N.G;
  N.setPause('shot', true);
  N.cam.x = G.car.x; N.cam.y = G.car.y;
  N.cam.rot = G.car.a + ${rot};
  N.cam.zoom *= ${zoom};
  N.cam.sx = ${sx}; N.cam.sy = ${sy};
  /* the control hint is onboarding, not a screenshot */
  const h = document.getElementById('gsHint');
  if (h) h.style.display = 'none';
  /* Clear the transient toasts. They are correct in motion — each one is on
     screen for a second — but a still catches three at once stacked down the
     middle of the frame, and a screenshot full of "WRECK +1,072" reads as
     clutter rather than as feedback. The persistent HUD stays: score, chain
     multiplier, hull and speed are the things worth showing. */
  const t = document.getElementById('toasts');
  if (t) t.innerHTML = '';
})()`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(launchOpts);

for (const shot of SHOTS) {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(GAME);
  await page.waitForTimeout(1200);

  await page.evaluate(t => {
    const N = window.__NH;
    N.setQuality('high');
    N.startRun();
    N.forceTheme(t);
    const n = N.openNodes()[0];
    N.enterNode(n.row, n.col); N.takeContract(0); N.beginDistrict();
  }, shot.theme);

  if (shot.boss) {
    await page.evaluate(id => {
      const N = window.__NH, G = N.G;
      G.run.cfg.boss = true;
      G.run.cfg.bossDef = N.BOSSES.find(b => b.id === id) || N.BOSSES[0];
      G.run.cfg.bossHp = 12000;
      N.addBoss();
    }, shot.boss);
  }

  /* drive for real, so the chain in the HUD was earned rather than typed in */
  const t0 = Date.now();
  while (Date.now() - t0 < shot.lead) {
    const want = await page.evaluate(BOT);
    await page.evaluate(KEYS + '(' + want + ')');
    await page.waitForTimeout(28);
  }

  await page.evaluate(STAGE(shot));
  await page.evaluate(DETONATE);
  await page.waitForTimeout(280);
  await page.evaluate(AIM(shot));
  await page.waitForTimeout(80);

  await page.screenshot({ path: path.join(OUT, shot.name) });
  const chain = await page.evaluate(() => ({
    mult: +window.__NH.G.mult.toFixed(1), chain: window.__NH.G.chain,
    score: window.__NH.G.score, theme: window.__NH.theme().name,
  }));
  console.log(`press/${shot.name}  ${chain.theme}  x${chain.mult}  chain ${chain.chain}  score ${chain.score}`);
  await ctx.close();
}

await browser.close();
