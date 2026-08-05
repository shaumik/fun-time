/* Drive the real game through the real input path and log what a run feels
   like in numbers. Read-only: touches nothing in the repo.

   Three profiles, and the gap between the last two is the whole design:
     cruise — follows the road centre, never targets. Must die to the wall.
     hunt   — always the nearest car. Survives, but should plateau.
     reader — picks the line that takes the most cars in one pass. Must go
              2-3x deeper than hunt, or formations are not readable. */
import { launch, GAME } from './browser.mjs';

const MODE = process.argv[2] || 'reader';
const SECS = +(process.argv[3] || 240);

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route('**/sdk.crazygames.com/**', r => r.abort());
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(GAME, { waitUntil: 'load' });
await page.waitForTimeout(1500);

await page.evaluate((mode) => {
  const NH = window.__NH, G = NH.G;
  NH.MS.on = true;
  window.__log = [];
  window.__ev = [];
  let lastState = null, lastDistrict = null, lastLevel = 1, lastStage = -1;
  window.__passHist = [];
  let lastPass = 0;

  const fwd = (car, t) => Math.cos(car.a) * (t.x - car.x) + Math.sin(car.a) * (t.y - car.y);
  const lat = (car, t) => -Math.sin(car.a) * (t.x - car.x) + Math.cos(car.a) * (t.y - car.y);

  function live(){
    const car = G.car, out = [];
    for (const t of G.traffic) {
      if (t.wrecked) continue;
      if (t.arch === 'armored' && t.armour > 0) continue;   // the wrong target
      const f = fwd(car, t);
      if (f < 30 || f > 1600) continue;
      out.push({ t, f, l: lat(car, t) });
    }
    return out.sort((a, b) => a.f - b.f);
  }

  /* nearest car ahead */
  function hunt(){
    const c = live();
    return c.length ? c[0].t : null;
  }

  /* The line: score every candidate lateral offset by how many cars it can
     sweep in sequence, preferring lines that chain rather than lines that
     reach one car sooner. */
  function reader(){
    const cars = live();
    if (!cars.length) return null;
    let best = null, bestScore = -1;
    for (const cand of cars.slice(0, 6)) {
      let n = 0, cursor = cand;
      const used = new Set([cand.t]);
      // greedily walk forward: how many more cars sit within a reachable
      // lateral step of the one before it?
      for (let hop = 0; hop < 4; hop++) {
        let next = null, bestD = 1e9;
        for (const o of cars) {
          if (used.has(o.t)) continue;
          if (o.f <= cursor.f) continue;
          const dl = Math.abs(o.l - cursor.l), df = o.f - cursor.f;
          if (dl > 190 || df > 620) continue;
          const d = df + dl * 1.6;
          if (d < bestD) { bestD = d; next = o; }
        }
        if (!next) break;
        used.add(next.t); cursor = next; n++;
      }
      // prefer more cars on the line, then the closer entry point
      const score = n * 1000 - cand.f * 0.35 - Math.abs(cand.l) * 0.2;
      if (score > bestScore) { bestScore = score; best = cand.t; }
    }
    return best;
  }

  let committed = null;
  function drive(){
    if (G.state === 'play' && G.car) {
      const car = G.car;
      const ahead = G.track.at(car.idx + 12, 0);
      let tx = ahead.x, ty = ahead.y;
      /* commit: re-picking a target every frame makes the car weave between
         two cars and reach neither, which is a bot artefact, not a read */
      if (committed && (committed.wrecked || fwd(car, committed) < 25
                        || G.traffic.indexOf(committed) < 0)) committed = null;
      if (!committed) committed = mode === 'hunt' ? hunt() : mode === 'reader' ? reader() : null;
      const tgt = committed;
      if (tgt) { tx = tgt.x; ty = tgt.y; }
      const dx = tx - car.x, dy = ty - car.y;
      let ang = Math.atan2(dy, dx) - car.a;
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      NH.MS.steer = Math.max(-1, Math.min(1, ang * 2.4));
    }
    if (G.state === 'brief') NH.beginDistrict();
    if (G.state === 'levelup') NH.takePerk(Math.floor(Math.random() * 3));
    if (G.state === 'cleared') NH.leaveCleared();
    if (G.state === 'map') {
      const open = NH.openNodes ? NH.openNodes() : [];
      if (open && open.length) NH.enterNode(open[0].row, open[0].col);
    }
    if (G.state === 'depot') { const b = document.querySelector('#depotCards button'); if (b) b.click(); }
    if (G.state === 'contract') { if (NH.takeContract) NH.takeContract(0); }
    if (G.state === 'over') { window.__over = true; }

    // record the size of each completed pass
    if (G.pass < lastPass && lastPass > 0) window.__passHist.push(lastPass);
    lastPass = G.pass;

    const t = performance.now() / 1000;
    if (G.state === 'play' && G.run) {
      window.__log.push([+t.toFixed(2), G.run.district, G.stage, Math.round(G.score),
                Math.round(G.wallGap), Math.round(G.hp), G.run.level,
                G.pass, G.totalWreck,
                Math.round(((G.car.idx - G.run.startIdx) / G.run.cfg.len) * 100)]);
    }
    if (G.state !== lastState) { window.__ev.push([+t.toFixed(1), 'state:' + G.state]); lastState = G.state; }
    if (G.run && G.run.district !== lastDistrict) {
      window.__ev.push([+t.toFixed(1), 'district ' + G.run.district + ' type=' + (G.run.cfg && G.run.cfg.type)]);
      lastDistrict = G.run.district;
    }
    if (G.run && G.run.level !== lastLevel) { window.__ev.push([+t.toFixed(1), 'LEVEL ' + G.run.level]); lastLevel = G.run.level; }
    if (G.state === 'play' && G.stage !== lastStage) { window.__ev.push([+t.toFixed(1), 'stage ' + G.stage]); lastStage = G.stage; }
  }
  window.__drv = setInterval(drive, 16);
}, MODE);

const t0 = Date.now();
while ((Date.now() - t0) / 1000 < SECS) {
  await page.waitForTimeout(1000);
  if (await page.evaluate(() => window.__over || false)) break;
}

const out = await page.evaluate(() => ({
  ev: window.__ev, log: window.__log, passes: window.__passHist,
  G: { score: window.__NH.G.score, wrecks: window.__NH.G.totalWreck,
       cleared: window.__NH.G.run && window.__NH.G.run.cleared,
       district: window.__NH.G.run && window.__NH.G.run.district,
       reason: window.__NH.G.crashReason, state: window.__NH.G.state },
}));
const L = out.log;
const alive = L.length ? L[L.length - 1][0] - L[0][0] : 0;
const passes = out.passes;
const mean = passes.length ? (passes.reduce((a, b) => a + b, 0) / passes.length) : 0;
console.log('MODE', MODE, 'errors', errs.slice(0, 3));
console.log('survived %ss  depth=district %s (cleared %s)  wrecks=%s  died=%s',
  alive.toFixed(1), out.G.district, out.G.cleared, out.G.wrecks, out.G.reason || out.G.state);
console.log('passes: n=%s  mean=%s  max=%s  dist=%s',
  passes.length, mean.toFixed(2), Math.max(0, ...passes),
  JSON.stringify([1, 2, 3, 4, 5].map(k => passes.filter(p => p === k).length)));
console.log('--- events ---');
for (const e of out.ev) console.log(e[0].toFixed(1).padStart(7), e[1]);
console.log('t dist stage score gap mistakes lvl pass wrecks road%');
for (let i = 0; i < L.length; i += 45) console.log(L[i].join(' '));
await browser.close();
