/* Preview videos for the CrazyGames submission.
   ------------------------------------------------------------------
   Emits into covers/:

     preview-landscape-1920x1080.mp4   16:9, mandatory
     preview-portrait-720x1080.mp4      2:3, mandatory

   Their spec: 15–20 seconds, 50MB ceiling, no sound, no black bars, no
   cursor, no promotional text, and the static cover as the opening frame so
   the thumbnail dissolves into the preview rather than cutting to it.

   The capture runs on a virtual clock. requestAnimationFrame and
   performance.now are replaced before the game loads, so the simulation only
   advances when this script says so — which means a screenshot that takes
   80ms does not become an 80ms hitch in the footage. Every frame is exactly
   1/60s of game time whatever the machine is doing, and the output is
   honestly 30fps rather than a real-time capture pretending to be.

   Their processing speeds the video up slightly at their end, so this does
   not pre-accelerate anything.

     node tools/make-preview.mjs
   ------------------------------------------------------------------ */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GAME = 'file://' + path.join(ROOT, 'dist', 'index.html');
const OUT = path.join(ROOT, 'covers');

const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = fs.existsSync(PINNED) ? { executablePath: PINNED } : {};

/* ffmpeg: prefer a full build, since the one bundled with Playwright is
   compiled down to VP8/webm only and cannot write the h264 everyone expects */
function findFfmpeg(){
  const local = path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg');
  if (fs.existsSync(local)) return local;
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) if (fs.existsSync(p)) return p;
  throw new Error('No ffmpeg found. `npm i ffmpeg-static` or install ffmpeg.');
}
const FFMPEG = findFfmpeg();

const FPS = 30;
const SECONDS = 18;                 // inside their 15–20 window
const HOLD = 0.6;                   // cover held at the head, in seconds
const PLAY_FRAMES = Math.round((SECONDS - HOLD) * FPS);
const HOLD_FRAMES = Math.round(HOLD * FPS);
const STEP_MS = 1000 / 60;          // simulate at 60Hz, keep every second frame

const CLIPS = [
  { name: 'preview-landscape-1920x1080.mp4', w: 1920, h: 1080,
    cover: 'landscape-1920x1080.png' },
  /* 1080p at 2:3 is 720x1080; the portrait cover is 800x1200, same ratio */
  { name: 'preview-portrait-720x1080.mp4',   w: 720,  h: 1080,
    cover: 'portrait-800x1200.png' },
];

/* Replace the clock before any game code runs. Everything the game schedules
   through rAF queues here instead, and only moves when __vstep is called. */
const VIRTUAL_CLOCK = `(() => {
  let vnow = 0;
  const q = [];
  window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  Object.defineProperty(performance, 'now', { value: () => vnow, configurable: true });
  window.__vstep = dtMs => {
    vnow += dtMs;
    const batch = q.splice(0, q.length);
    for (const cb of batch) { try { cb(vnow); } catch (e) {} }
  };
})()`;

/* A driver that aims at traffic rather than avoiding it, because the game is
   about going through cars and a preview of it dodging them would be a
   preview of the wrong game. Falls back to the centreline when the road
   ahead is clear, so it never just grinds along a barrier. */
const BOT = `(() => {
  const N = window.__NH, G = N.G;
  /* Keep the run alive for the whole clip. Left to itself the bot wrecks
     somewhere around the fifteenth second and the preview ends on the game
     over screen — a menu, with two rewarded-ad buttons on it, which is the
     last thing that should appear in a store preview. The hull is topped up
     rather than the footage being faked: everything on screen is still the
     game playing itself, just a run that does not end mid-sentence. */
  if (G.hp < G.hpMax) G.hp = G.hpMax;
  /* A bot that cannot die clears districts fast, and every screen between
     districts — checkpoint, level up, route board, dispatch — is a menu that
     the clip then sits on. Drive straight through all of them in the same
     frame they appear, so the footage stays on the road. */
  if (G.state !== 'play' && G.run) {
    try {
      if (G.state === 'cleared') N.leaveCleared();
      if (G.state === 'levelup') N.takePerk(0);
      if (G.state === 'over')    N.startRun();
      const n = N.openNodes()[0];
      if (n) { N.enterNode(n.row, n.col); N.takeContract(0); N.beginDistrict(); }
    } catch (e) {}
  }
  if (!G.car || G.state !== 'play') return 0;
  const car = G.car, ca = Math.cos(car.a), sa = Math.sin(car.a);
  let best = null, bd = 1e9;
  for (const v of G.traffic) {
    if (v.wrecked) continue;
    const dx = v.x - car.x, dy = v.y - car.y;
    const fwd = ca * dx + sa * dy;
    const d = Math.hypot(dx, dy);
    if (fwd > 40 && d < 620 && d < bd) { bd = d; best = { dx, dy }; }
  }
  if (!best) {
    const q = G.track.at(car.idx + 6, 0);
    best = { dx: q.x - car.x, dy: q.y - car.y };
  }
  const cross = ca * best.dy - sa * best.dx;
  return cross > 10 ? 1 : cross < -10 ? -1 : 0;
})()`;

const KEYS = `(want => {
  const fire = (code, down) =>
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  fire('ArrowLeft',  want < 0);
  fire('ArrowRight', want > 0);
})`;

const browser = await chromium.launch(launchOpts);
fs.mkdirSync(OUT, { recursive: true });

for (const clip of CLIPS) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-preview-'));
  const ctx = await browser.newContext({
    viewport: { width: clip.w, height: clip.h }, deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.addInitScript(VIRTUAL_CLOCK);
  await page.goto(GAME);

  /* the game boots straight into gameplay, but it needs a few frames of
     virtual time to build the world before anything is worth filming */
  for (let i = 0; i < 120; i++) await page.evaluate(d => window.__vstep(d), STEP_MS);

  await page.evaluate(() => {
    const N = window.__NH;
    N.setQuality('high');
    N.startRun();
    N.forceTheme(0);                       // The Grid, to match the covers
    const n = N.openNodes()[0];
    N.enterNode(n.row, n.col);
    N.takeContract(0);
    N.beginDistrict();
    /* the control hint is onboarding, not footage */
    const h = document.getElementById('gsHint');
    if (h) h.style.display = 'none';
  });

  /* a run-up so the car is at speed and mid-chain when the clip opens */
  for (let i = 0; i < 240; i++) {
    const want = await page.evaluate(BOT);
    await page.evaluate(KEYS + '(' + want + ')');
    await page.evaluate(d => window.__vstep(d), STEP_MS);
  }

  for (let f = 0; f < PLAY_FRAMES; f++) {
    /* two 60Hz steps per captured frame = 30fps out, 60Hz physics in */
    for (let s = 0; s < 2; s++) {
      const want = await page.evaluate(BOT);
      await page.evaluate(KEYS + '(' + want + ')');
      await page.evaluate(d => window.__vstep(d), STEP_MS);
    }
    await page.screenshot({
      path: path.join(dir, 'f' + String(f + HOLD_FRAMES).padStart(5, '0') + '.png'),
    });
  }
  await ctx.close();

  /* Their guide asks for the static cover as the opening frame so the
     thumbnail transitions seamlessly into the preview. Held for HOLD
     seconds, scaled to the clip — the portrait cover is the same 2:3. */
  const coverSrc = path.join(OUT, clip.cover);
  const coverScaled = path.join(dir, 'cover.png');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', coverSrc,
    '-vf', `scale=${clip.w}:${clip.h}`, coverScaled]);
  for (let f = 0; f < HOLD_FRAMES; f++) {
    fs.copyFileSync(coverScaled, path.join(dir, 'f' + String(f).padStart(5, '0') + '.png'));
  }

  const out = path.join(OUT, clip.name);
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-framerate', String(FPS),
    '-i', path.join(dir, 'f%05d.png'),
    '-an',                                   // no sound, as required
    /* 19 Mbps for an 18s preview is absurd and lands 40MB against their 50MB
       ceiling with no margin. 23 is visually indistinguishable here and
       leaves room for the file to grow if the clip ever gets busier. */
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
    '-maxrate', '8M', '-bufsize', '16M',
    '-pix_fmt', 'yuv420p',                   // the format everything can decode
    '-movflags', '+faststart',
    out,
  ]);

  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log(`covers/${clip.name}  ${clip.w}x${clip.h}  ${SECONDS}s  ${mb} MB`);
  fs.rmSync(dir, { recursive: true, force: true });
}

await browser.close();
