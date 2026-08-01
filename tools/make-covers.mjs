/* Game covers for the CrazyGames submission.
   ------------------------------------------------------------------
   Emits the three mandatory sizes into covers/:

     landscape-1920x1080.png   16:9
     portrait-800x1200.png      2:3
     square-800x800.png         1:1

   Their guide asks for the game's own character as the primary visual, the
   title set in something stylised, and the same visual identity across all
   three so a player recognises the game whichever crop they meet first. It
   also says, in as many words, not to just screenshot the game.

   So this does not screenshot the menu. It drives a real run until the car
   is mid-chain with wrecks and light trails behind it, strips every piece of
   HUD and UI off the frame, and composes the logotype over the result. The
   art is the game's own renderer — which keeps it honest, since their
   quality rules also require the cover to represent what the player gets —
   but the moment, the camera and the composition are chosen rather than
   caught.

   Known limit: the game ships zero asset files and the page can load no
   webfont, so the wordmark is the system grotesque the game itself uses,
   stylised by treatment (outline against gradient fill, tight tracking,
   neon bloom) rather than by a bought face. A designer with a real display
   face would do better here; their guide suggests Fiverr or UpWork, and
   this is the one part of the submission where that money would show.

     node tools/make-covers.mjs
   ------------------------------------------------------------------ */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GAME = 'file://' + path.join(ROOT, 'dist', 'index.html');
const OUT = path.join(ROOT, 'covers');

const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = fs.existsSync(PINNED) ? { executablePath: PINNED } : {};

/* Per-crop tuning. The composition is the same in all three — hero car low
   and off-centre, traffic ahead of it, title in the upper third, nothing else
   — but the numbers cannot be, for two reasons.

   `type`: a 2:3 portrait needs the wordmark much larger relative to its frame
   than a 16:9 does, or it disappears at thumbnail size, which is the only
   size that matters on a storefront.

   `rot`: the chase camera holds the road vertical, because that is what you
   want while driving. A still wants it on the diagonal — that is most of the
   difference between a screenshot and a cover. But "ahead on the track"
   projects up and to the left, so the rotation that fills a wide frame runs
   the traffic straight off the left edge of a narrow one. Rotation therefore
   falls as the frame narrows, and portrait gets an almost vertical road.

   `lead` is how long the bot drives before the shutter; different crops look
   best at different points in a chain. */
const COVERS = [
  { name: 'landscape-1920x1080.png', w: 1920, h: 1080, type: 10.5, top: '10%', lead: 5200,
    zoom: 1.72, rot: 0.40, sx: 90,  sy: 150, ahead: 2, step: 1 },
  { name: 'portrait-800x1200.png',   w: 800,  h: 1200, type: 13.5, top: '6%',  lead: 6100,
    zoom: 1.75, rot: 0.20, sx: 0,   sy: 165, ahead: 2, step: 1 },
  { name: 'square-800x800.png',      w: 800,  h: 800,  type: 13.0, top: '6%',  lead: 5600,
    zoom: 1.80, rot: 0.42, sx: 55,  sy: 105, ahead: 2, step: 1 },
];

/* Freeze the run at a chosen instant and point the camera at it. The camera
   is only damped inside step(), so pausing first means anything set here
   survives to the shutter. Wrecks are detonated deliberately rather than
   waited for: a cover wants the moment the game is selling, and a clean
   empty road is not that moment. */
const ART_DIRECT = ({ zoom, rot, sx, sy, ahead, step }) => `(() => {
  const N = window.__NH, G = N.G;
  N.setPause('cover', true);
  /* the hero should not be wearing its damage flash */
  G.car.hitFlash = 0; G.car.inv = 0;
  /* Put the car back on the centreline. Five seconds of ramming leaves it
     scraping a barrier, which reads as a mistake in a still even though it
     is exactly how the game is played. */
  /* +10 rather than +0: the detonation happens at the car, so landing it
     exactly where it stood buries the hero in its own smoke. Moved a little
     up the road, the same debris reads as wreckage in its wake. */
  const base = G.car.idx + 10;
  const pos = G.track.at(base, 0);
  G.car.x = pos.x; G.car.y = pos.y; G.car.a = pos.a;
  /* Traffic is the ammunition, so the cover has to show some of it in front
     of the car rather than an empty road. These are the run's own vehicles
     moved onto the track ahead — arranged, not invented. */
  const lanes = [-95, 25, 115, -45, 70, -15];
  /* Five seconds of ramming leaves most of the traffic array wrecked, and a
     wreck draws as debris rather than as a car — which is how a cover shot
     ends up with an empty road. Prefer the survivors, and press wrecks back
     into service as intact cars if there are not enough of them, so the
     frame is composed rather than left to what happened to survive. */
  const live = G.traffic.filter(v => !v.wrecked);
  const pool = (live.length >= 6 ? live : G.traffic).slice(0, 6);
  pool.forEach((v, i) => {
    /* off base, not off car.idx — the hero was just moved ten segments up
       the road and car.idx still says where it used to be, which put every
       one of these behind the camera. In segments: SEG is 56 world units and
       the visible radius at this zoom is under 500, so anything past six or
       seven segments ahead is off frame entirely. */
    const q = G.track.at(base + ${ahead} + i * ${step}, lanes[i]);
    v.x = q.x; v.y = q.y; v.a = q.a;
    v.wrecked = 0; v.spin = 0; v.hitFlash = 0;
  });
  /* and bring the frozen camera with it */
  N.cam.x = G.car.x; N.cam.y = G.car.y;
  N.cam.rot = G.car.a + ${rot};
  N.cam.zoom *= ${zoom};
  N.cam.sx = ${sx};
  N.cam.sy = ${sy};
})()`;

const DETONATE = `(() => {
  const N = window.__NH, G = N.G;
  const near = G.traffic
    .map(v => ({ v, d: Math.hypot(v.x - G.car.x, v.y - G.car.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  for (const n of near) { try { N.smash(n.v, 780); } catch (e) {} }
})()`;

/* Strip the game down to its own rendering, and lay the wordmark over it.
   Nothing but the title goes on a cover — no "play", no badges, no icons,
   and no border, all of which their restrictions call out by name. */
const COMPOSE = ({ type, top }) => `
  for (const el of document.querySelectorAll('.layer, .screen, #touch, #ad')) {
    el.style.display = 'none';
  }
  document.getElementById('stage').style.background = '#02030A';

  const wrap = document.createElement('div');
  wrap.id = 'coverArt';
  wrap.innerHTML = '<h1 class="coverTitle"><span class="t1">Neon</span><span class="t2">Heat</span></h1>';
  document.getElementById('stage').appendChild(wrap);

  const s = document.createElement('style');
  s.textContent = \`
    /* A darkened crown behind the type. Not a border — it has no edge, it is
       a gradient into the existing night so the wordmark has somewhere to
       sit on a bright skyline. */
    #coverArt{
      position:absolute; inset:0; pointer-events:none; z-index:99;
      background:linear-gradient(180deg,
        rgba(2,3,10,.92) 0%, rgba(2,3,10,.72) 26%, rgba(2,3,10,0) 52%);
    }
    #coverArt .coverTitle{
      position:absolute; left:50%; top:${top}; transform:translateX(-50%);
      margin:0; display:flex; flex-direction:column; align-items:center;
      line-height:.80; font-weight:800; text-transform:uppercase;
      letter-spacing:-.03em; font-size:${type}vmin; white-space:nowrap;
      font-family:var(--sans);
    }
    /* The game's own logotype: outline against gradient fill. Carried over
       exactly so the cover and the first frame of the game agree. */
    #coverArt .t1{
      color:transparent; -webkit-text-stroke:${(type * 0.055).toFixed(3)}vmin #3DE8FF;
      letter-spacing:.06em;
      filter:drop-shadow(0 0 ${(type * 0.16).toFixed(2)}vmin rgba(61,232,255,.75));
    }
    #coverArt .t2{
      background:linear-gradient(180deg,#fff 8%,#FF2E88 96%);
      -webkit-background-clip:text; background-clip:text; color:transparent;
      filter:drop-shadow(0 0 ${(type * 0.24).toFixed(2)}vmin rgba(255,46,136,.8));
    }
  \`;
  document.head.appendChild(s);
`;

/* Weave across the lanes so the car is actually hitting traffic when the
   shutter opens — a chain in progress is what the game looks like, and a
   clean empty road is not. */
async function drive(page, ms) {
  const t0 = Date.now();
  let dir = 'ArrowLeft';
  while (Date.now() - t0 < ms) {
    await page.keyboard.down(dir);
    await page.waitForTimeout(190);
    await page.keyboard.up(dir);
    await page.waitForTimeout(120);
    dir = dir === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
  }
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(launchOpts);

for (const cover of COVERS) {
  const ctx = await browser.newContext({
    viewport: { width: cover.w, height: cover.h },
    deviceScaleFactor: 1,          // covers are delivered at exactly these pixels
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  await page.goto(GAME);
  await page.waitForTimeout(1200);

  /* All three covers are shot in the same district. Their restrictions
     require the set to share one identity, and a run now draws three of five
     at random — so left to itself this would produce a magenta landscape and
     an orange square. The Grid is the pick: it is the densest of them, and
     it is the one whose cyan and magenta the wordmark is already built from.

     Push quality to its ceiling too. These are stills; the frame budget that
     makes the game demote itself on a slow machine is irrelevant here. */
  await page.evaluate(() => {
    const N = window.__NH;
    N.setQuality('high');
    N.startRun();
    N.forceTheme(0);                    // The Grid — before the world is built
    const n = N.openNodes()[0];
    N.enterNode(n.row, n.col);
    N.takeContract(0);                  // builds the world under the forced theme
    N.beginDistrict();
  });
  await drive(page, cover.lead);

  await page.evaluate(DETONATE);
  /* Long enough for the detonation flash to fall off but not so long that the
     debris clears. Freezing at the peak instead blows a white haze across the
     whole frame and kills the contrast the neon depends on. */
  await page.waitForTimeout(520);
  await page.evaluate(ART_DIRECT(cover));
  await page.waitForTimeout(60);             // one paused frame at the new camera
  await page.evaluate(COMPOSE(cover));
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, cover.name) });
  console.log(`covers/${cover.name}  ${cover.w}x${cover.h}`);
  await ctx.close();
}

await browser.close();
