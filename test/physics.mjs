/* "Consistent Physics: the game's physics must perform consistently across
   different monitor refresh rates (e.g. 144 Hz, 165 Hz)" — CrazyGames gameplay
   requirements.

   Headless Chromium renders at 60 Hz, so the refresh rate is faked instead:
   requestAnimationFrame is replaced before the game boots with a driver that
   hands the loop synthetic timestamps at a chosen cadence. The same simulated
   wall-clock is then run at 60, 144 and 165 Hz and the results compared. */
import { launch, GAME } from './browser.mjs';

const browser = await launch();
const SECONDS = 6;

async function runAt(hz){
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/sdk.crazygames.com/**', r => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  await page.addInitScript(hz => {
    let t = 0;
    const pending = [];
    window.requestAnimationFrame = cb => pending.push(cb);
    window.__pump = frames => {
      for (let i = 0; i < frames; i++) {
        t += 1000 / hz;
        pending.splice(0).forEach(cb => cb(t));
      }
    };
    window.__hz = hz;
  }, hz);

  await page.goto(GAME, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const out = await page.evaluate(seconds => {
    const NH = window.__NH;
    const hz = window.__hz;
    const car = NH.G.car;
    const dt = 1 / hz;
    const frames = Math.round(seconds * hz);

    /* The integrator is driven directly rather than through the frame loop.
       Letting the car free-run on the track instead measures the barrier and
       off-road recovery logic — chaotic, and not what this requirement is
       about. Here the only variable is the size of the timestep. */
    car.x = car.y = car.a = 0;
    car.vx = car.vy = 0;
    car.steer = 0; car.boostT = 0; car.offroad = 0; car.topBonus = 0;

    let straight = 0;
    for (let i = 0; i < frames; i++) car.drive(dt, 0, 1);   // full throttle, no steering
    straight = car.speed;

    /* And once more with a steady steering input, which exercises the angular
       integration and the lateral grip term as well. */
    car.x = car.y = car.a = 0;
    car.vx = car.vy = 0;
    car.steer = 0; car.boostT = 0; car.offroad = 0;
    for (let i = 0; i < frames; i++) car.drive(dt, 0.7, 1);
    return {
      hz, frames,
      straight: +straight.toFixed(3),
      cornering: +car.speed.toFixed(3),
      heading: +car.a.toFixed(3),
    };
  }, SECONDS);

  await ctx.close();
  return { ...out, errs };
}

const results = [];
for (const hz of [60, 144, 165]) results.push(await runAt(hz));

const base = results[0];
const pct = (v, b) => ((v - b) / (b || 1)) * 100;
const sign = n => (n >= 0 ? '+' : '') + n.toFixed(3) + '%';

console.log(`simulating ${SECONDS}s at each refresh rate, driving the integrator directly\n`);
for (const r of results) {
  console.log(
    `${String(r.hz).padStart(3)} Hz  ${String(r.frames).padStart(4)} steps` +
    `   straight ${String(r.straight).padStart(9)} (${sign(pct(r.straight, base.straight))})` +
    `   cornering ${String(r.cornering).padStart(9)} (${sign(pct(r.cornering, base.cornering))})` +
    `   heading ${String(r.heading).padStart(8)} (${sign(pct(r.heading, base.heading))})` +
    (r.errs.length ? `   ERRORS ${r.errs.join('; ')}` : '')
  );
}

const worst = Math.max(...results.flatMap(r => [
  Math.abs(pct(r.straight, base.straight)),
  Math.abs(pct(r.cornering, base.cornering)),
  Math.abs(pct(r.heading, base.heading)),
]));
console.log(`\nworst drift vs 60 Hz: ${worst.toFixed(3)}%  —  ${worst < 1 ? 'PASS' : 'INVESTIGATE'}`);

await browser.close();
