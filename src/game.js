/* ============================================================
   NEON HEAT — playable prototype
   Every pixel is generated at runtime. No image assets, by design:
   procedural geometry + a real bloom chain is what makes a
   no-art-team game look expensive instead of amateur.
   ============================================================ */
(() => {
'use strict';

/* ---------------- math ---------------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const damp  = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rnd   = (a = 1, b = 0) => b + Math.random() * (a - b);
const rint  = (a, b) => Math.floor(rnd(a, b));
const fmt   = n => Math.floor(n).toLocaleString('en-US');
const hyp   = (x, y) => Math.sqrt(x * x + y * y);
/* shortest signed angular difference */
const adiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/* ---------------- palette ---------------- */
const CL = {
  void:'#05060E', ground:'#06080F', asphalt:'#131A2C', asphalt2:'#171F36',
  cyan:'#3DE8FF', magenta:'#FF2E88', red:'#FF3355', amber:'#FFB13D', ice:'#C6D2E8'
};

/* ---------------- persistence ---------------- */
const Save = {
  key:'neonheat.v1',
  data:{ best:0, deepest:0, coins:0, car:'viper', up:{ grip:0, nitro:0, armor:0, payout:0 }, owned:['viper'], runs:0 },
  load(){
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* storage blocked — run in-memory */ }
  },
  flush(){
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
  }
};
Save.load();

/* ---------------- ads ----------------
   Talks to the real CrazyGames SDK when hosted there; otherwise
   plays a simulated placement so the flow is demonstrable standalone. */
const Ads = {
  get sdk(){ return window.CrazyGames && window.CrazyGames.SDK; },
  rewarded(msg, done){
    if (this.sdk) {
      this.sdk.ad.requestAd('rewarded', {
        adFinished: () => done(true),
        adError:    () => done(false),
        adStarted:  () => {}
      });
      return;
    }
    simAd(msg, 3.2, () => done(true));
  },
  midroll(done){
    if (this.sdk) {
      this.sdk.ad.requestAd('midgame', {
        adFinished: done, adError: done, adStarted: () => {}
      });
      return;
    }
    simAd('Back in a moment', 2.4, done);
  }
};

const adEl = document.getElementById('ad');
const adFill = document.getElementById('adFill');
const adMsg = document.getElementById('adMsg');
let adT = 0, adDur = 0, adCb = null;

function simAd(msg, dur, cb){
  adMsg.textContent = msg;
  adT = 0; adDur = dur; adCb = cb;
  adFill.style.width = '0%';
  adEl.classList.add('on');
}
function adTick(dt){
  if (!adCb) return;
  adT += dt;
  adFill.style.width = clamp(adT / adDur, 0, 1) * 100 + '%';
  if (adT >= adDur) {
    adEl.classList.remove('on');
    const cb = adCb; adCb = null; cb();
  }
}

/* ---------------- cars ---------------- */
const CARS = [
  { id:'viper',   name:'Viper',   price:0,     len:46, wid:23, nose:.60, tail:.78,
    col:'#3DE8FF', col2:'#0A5A72', power:560, grip:7.4, top:620, armor:0, stats:[3,3,3] },
  { id:'katana',  name:'Katana',  price:6500,  len:44, wid:21, nose:.48, tail:.60,
    col:'#FF2E88', col2:'#6E0F3C', power:580, grip:9.0, top:630, armor:0, stats:[4,5,2] },
  { id:'brute',   name:'Brute',   price:22000, len:53, wid:27, nose:.82, tail:.92,
    col:'#FFB13D', col2:'#6B3F08', power:530, grip:6.2, top:590, armor:1, stats:[2,2,5] },
  { id:'phantom', name:'Phantom', price:60000, len:48, wid:22, nose:.44, tail:.54,
    col:'#DCF6FF', col2:'#28536F', power:620, grip:8.2, top:700, armor:0, stats:[5,4,2] }
];
const carById = id => CARS.find(c => c.id === id) || CARS[0];
const STAT_LABELS = ['Speed', 'Grip', 'Bulk'];

const UPGRADES = [
  { id:'grip',   name:'Grip',   base:900,  desc:'Slide control' },
  { id:'nitro',  name:'Nitro',  base:1100, desc:'Boost tank' },
  { id:'armor',  name:'Armor',  base:1400, desc:'Impact tolerance' },
  { id:'payout', name:'Payout', base:1800, desc:'Coins per run' }
];
const UP_MAX = 5;
const upCost = (u, lvl) => Math.round(u.base * Math.pow(1.85, lvl));

/* the spec the physics actually reads: car + upgrades folded together */
function activeSpec(){
  const c = carById(Save.data.car), u = Save.data.up;
  return Object.assign({}, c, {
    grip:  c.grip + u.grip * 0.42,
    nitroMax: 1 + u.nitro * 0.22,
    crashV: 430 + u.armor * 40 + c.armor * 110,
    payout: 1 + u.payout * 0.14
  });
}

/* ---------------- quality ----------------
   CrazyGames traffic skews to low-end laptops and mid-range phones, so the
   expensive passes are switchable and the game demotes itself if frames slip. */
const QF = { bloom:1, wide:1, city:1, windows:1, glow:1, grain:1, dpr:1.5, tier:'high' };
function setQuality(t){
  QF.tier = t;
  const high = t === 'high';
  QF.wide = QF.windows = QF.grain = high ? 1 : 0;
  QF.bloom = 1; QF.city = 1; QF.glow = 1;
  /* the bloom composite is fill-rate bound, so pixels are the lever */
  QF.dpr = high ? 1.5 : 1;
  if (typeof resize === 'function') resize();
}

/* ---------------- canvas ---------------- */
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const stage = document.getElementById('stage');
let W = 1280, H = 720, DPR = 1;

/* quarter-res buffers for the bloom chain */
const bufA = document.createElement('canvas'), bA = bufA.getContext('2d');
const bufB = document.createElement('canvas'), bB = bufB.getContext('2d');
let vignette = null, grain = null;

function resize(){
  const r = stage.getBoundingClientRect();
  W = Math.max(320, Math.round(r.width));
  H = Math.max(180, Math.round(r.height));
  DPR = Math.min(window.devicePixelRatio || 1, QF.dpr);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  bufA.width = bufB.width = Math.max(1, Math.round(W / 4));
  bufA.height = bufB.height = Math.max(1, Math.round(H / 4));
  /* In portrait the narrow axis governs legibility: height/100 on a 390x844
     phone gives 8.4px units inside a 390px-wide column, which overflows. */
  const portrait = W / H < 1.15;
  const u = portrait ? clamp(W / 54, 4, 10) : clamp(H / 100, 3.2, 11);
  stage.style.setProperty('--u', u.toFixed(2) + 'px');
  buildOverlays();
}

/* Vignette and film grain are both static per-pixel effects, so they are
   pre-composited into three full-screen plates that the frame cycles
   through. One source-over blit per frame instead of a blend-mode pattern
   fill, which profiled as the single most expensive pass in the game. */
let plates = [], plateI = 0;

function buildOverlays(){
  if (!grain) {
    grain = document.createElement('canvas');
    grain.width = grain.height = 128;
    const gg = grain.getContext('2d');
    const img = gg.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
      img.data[i+3] = Math.random() * 13;
    }
    gg.putImageData(img, 0, 0);
  }

  plates = [];
  for (let k = 0; k < 3; k++) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    const rg = g.createRadialGradient(W/2, H*0.5, Math.min(W,H)*0.16, W/2, H*0.5, Math.max(W,H)*0.72);
    rg.addColorStop(0,   'rgba(0,0,0,0)');
    rg.addColorStop(0.6, 'rgba(2,3,10,0.16)');
    rg.addColorStop(1,   'rgba(1,2,7,0.62)');
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);

    g.save();
    g.translate(rint(-64, 64), rint(-64, 64));
    g.fillStyle = g.createPattern(grain, 'repeat');
    g.fillRect(-128, -128, W + 256, H + 256);
    g.restore();

    plates.push(c);
  }
  vignette = plates[0];
}

window.addEventListener('resize', resize);

/* ---------------- input ---------------- */
const keys = Object.create(null);
const touch = { left:0, right:0, drift:0, nitro:0 };
const IN = { steer:0, drift:0, nitro:0 };

addEventListener('keydown', e => {
  keys[e.code] = 1;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  NHAudio.resume();
  if (e.code === 'Enter') {
    if (G.state === 'menu' || G.state === 'over') startRun();
    else if (G.state === 'brief') beginDistrict();
  }
  if (G.state === 'draft' && /^Digit[123]$/.test(e.code)) takeOffer(+e.code.slice(5) - 1);
  if (e.code === 'KeyM') setMute(NHAudio.toggleMute());
  if (e.code === 'Escape' && (G.state === 'play' || G.state === 'brief')) toMenu();
});
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });

addEventListener('pointerdown', () => NHAudio.resume(), { passive: true });

const touchEl = document.getElementById('touch');
const hasTouch = matchMedia('(hover:none)').matches || navigator.maxTouchPoints > 0;
touchEl.querySelectorAll('.tbtn').forEach(b => {
  const k = b.dataset.k;
  const on  = e => { e.preventDefault(); touch[k] = 1; b.classList.add('down'); };
  const off = e => { e.preventDefault(); touch[k] = 0; b.classList.remove('down'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('pointerleave', off);
});

function readInput(){
  const l = keys.ArrowLeft  || keys.KeyA || touch.left;
  const r = keys.ArrowRight || keys.KeyD || touch.right;
  IN.steer = (r ? 1 : 0) - (l ? 1 : 0);
  IN.drift = (keys.Space || keys.ArrowDown || keys.KeyS || touch.drift) ? 1 : 0;
  IN.nitro = (keys.ShiftLeft || keys.ShiftRight || keys.KeyW || keys.ArrowUp || touch.nitro) ? 1 : 0;
}

/* ============================================================
   TRACK
   A centreline advanced by a smoothed random walk. Buildings and
   lamps are baked per node at generation time so the city is
   stable as you drive past it.
   ============================================================ */
const SEG = 56;

class Track {
  constructor(){
    this.pts = [];
    this.ang = -Math.PI / 2;
    this.curv = 0; this.tCurv = 0;
    this.hw = 280; this.tHw = 280;
    this.x = 0; this.y = 0; this.n = 0;
    for (let i = 0; i < 260; i++) this.extend();
  }
  extend(){
    if (this.n % 24 === 0) {
      this.tCurv = Math.random() < 0.22 ? 0 : rnd(-0.062, 0.062);
    }
    if (this.n % 46 === 0) this.tHw = rnd(245, 345);
    this.curv = lerp(this.curv, this.tCurv, 0.07);
    this.hw   = lerp(this.hw, this.tHw, 0.05);
    this.ang += this.curv;
    this.x += Math.cos(this.ang) * SEG;
    this.y += Math.sin(this.ang) * SEG;

    const p = { x:this.x, y:this.y, a:this.ang, w:this.hw, i:this.n, b:null, lamp:this.n % 4 === 0 };

    /* city blocks, both sides, set well back so they never crowd the road */
    if (this.n % 2 === 0) {
      p.b = [];
      for (const side of [-1, 1]) {
        if (Math.random() < 0.34) continue;
        const off = this.hw + rnd(80, 400);
        const nx = -Math.sin(this.ang), ny = Math.cos(this.ang);
        p.b.push({
          x: this.x + nx * off * side,
          y: this.y + ny * off * side,
          w: rnd(48, 118), d: rnd(48, 118),
          h: rnd(110, 480),
          a: this.ang + rnd(-0.25, 0.25),
          hue: Math.random() < 0.5 ? CL.cyan : CL.magenta,
          lit: Math.random() < 0.80,
          seed: Math.random() * 1000
        });
      }
    }
    this.pts.push(p);
    this.n++;
  }
  ensure(i){ while (this.pts.length < i + 220) this.extend(); }

  /* nearest node search, seeded from the caller's last known index */
  locate(x, y, hint){
    this.ensure(hint + 60);
    let bi = hint, bd = Infinity;
    const lo = Math.max(0, hint - 14), hi = Math.min(this.pts.length - 1, hint + 46);
    for (let i = lo; i <= hi; i++) {
      const p = this.pts[i];
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    const p = this.pts[bi];
    const dx = x - p.x, dy = y - p.y;
    /* signed lateral offset from the centreline */
    const lat = dx * -Math.sin(p.a) + dy * Math.cos(p.a);
    return { i:bi, p, lat };
  }
  /* world position at node i, offset laterally */
  at(i, lat){
    this.ensure(i);
    const p = this.pts[Math.max(0, Math.min(this.pts.length - 1, i))];
    return { x: p.x - Math.sin(p.a) * lat, y: p.y + Math.cos(p.a) * lat, a: p.a, p };
  }
}

/* ============================================================
   PARTICLES + DECALS
   ============================================================ */
const P = [];      // particles
const SKID = [];   // tyre decals

function spawn(x, y, vx, vy, life, r, col, add, grow){
  if (P.length > 420) P.shift();
  P.push({ x, y, vx, vy, life, max:life, r, col, add:!!add, grow: grow || 0 });
}
/* decal corners are baked at spawn so the draw pass is one batched path
   instead of a save/rotate/restore per mark */
function skid(x, y, a, w){
  if (SKID.length > 620) SKID.splice(0, 40);
  const c = Math.cos(a), s = Math.sin(a), L = 4;
  SKID.push({
    life:5.5,
    q:[ x - c*L - s*-w, y - s*L + c*-w,
        x + c*L - s*-w, y + s*L + c*-w,
        x + c*L - s*w,  y + s*L + c*w,
        x - c*L - s*w,  y - s*L + c*w ]
  });
}
function stepFX(dt){
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.life -= dt;
    if (p.life <= 0) { P.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.exp(-1.6 * dt); p.vy *= Math.exp(-1.6 * dt);
    p.r += p.grow * dt;
  }
  for (let i = SKID.length - 1; i >= 0; i--) {
    SKID[i].life -= dt;
    if (SKID[i].life <= 0) SKID.splice(i, 1);
  }
}

/* ============================================================
   VEHICLE
   ============================================================ */
class Vehicle {
  constructor(spec, kind){
    this.spec = spec;
    this.kind = kind;              // 'player' | 'traffic' | 'police'
    this.x = 0; this.y = 0; this.a = -Math.PI / 2;
    this.vx = 0; this.vy = 0;
    this.steer = 0; this.idx = 0;
    this.drift = 0; this.slip = 0;
    this.boost = 0; this.nitro = 1;
    this.dead = false; this.hitFlash = 0; this.offroad = 0;
    this.skidT = 0; this.smokeT = 0;
    this.nearFlag = false; this.lamp = Math.random() * TAU; this.driftHeld = 0;
    this.mods = null; this.topBonus = 0;
    this.inv = 0;
  }
  get speed(){ return hyp(this.vx, this.vy); }

  drive(dt, steerIn, throttle, driftIn, boostIn){
    const s = this.spec;
    /* only the player carries chip modifiers; traffic and pursuit run stock */
    const M = this.mods;
    this.steer = damp(this.steer, steerIn, 13, dt);

    /* Turn authority falls off with speed, and drifting buys it back.
       That asymmetry is the design: fast corners *require* the slide. */
    const sp = this.speed;
    const rate = (2.0 + (driftIn ? 0.9 : 0))
               * clamp(sp / 190, 0, 1)
               * lerp(1, 0.62, clamp(sp / 900, 0, 1));
    this.a += this.steer * rate * dt;

    const cs = Math.cos(this.a), sn = Math.sin(this.a);

    /* body frame: longitudinal + lateral velocity */
    let lon =  cs * this.vx + sn * this.vy;
    let lat = -sn * this.vx + cs * this.vy;

    const cap = (s.nitroMax || 1) * (M ? M.nitroCap : 1);
    let acc = throttle * s.power;
    if (boostIn && this.nitro > 0.02) {
      acc *= 1.75; this.boost = 1;
      this.nitro -= dt * 0.45 * (M ? M.nitroDrain : 1);
    } else {
      this.boost = 0;
      this.nitro = Math.min(cap, this.nitro + dt * 0.055 * (M ? M.nitroRegen : 1));
    }

    const top = s.top * (M ? M.topMul * (1 + this.topBonus) : 1) * (this.boost ? 1.15 : 1);
    lon += acc * dt;
    if (lon > top) lon = damp(lon, top, 3, dt);
    lon *= Math.exp(-(0.42 + this.offroad * 2.4) * dt);

    /* grip is what the whole game is built on: releasing it is the verb */
    const grip = (driftIn ? 2.4 : s.grip * (M ? M.gripMul : 1)) * (1 - this.offroad * 0.45);
    lat *= Math.exp(-grip * dt);

    this.vx = cs * lon - sn * lat;
    this.vy = sn * lon + cs * lat;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* Self-aligning torque. Without it a slide has no equilibrium and simply
       winds up into a spin — the car holds a stable angle instead, which is
       what makes a drift something you can steer rather than survive. */
    const phi = Math.atan2(lat, Math.max(60, Math.abs(lon)));
    const maxSlip = driftIn ? 0.60 : 0.26;
    const over = Math.abs(phi) - maxSlip;
    if (over > 0) this.a += Math.sign(phi) * Math.min(over, 0.7) * 7.5 * dt;

    this.slip = Math.abs(phi);
    const thresh = M ? M.driftThresh : 0.20;
    this.drift = damp(this.drift, (this.slip > thresh && sp > 200) ? 1 : 0, 12, dt);

    /* rear-wheel decals + smoke while sliding */
    if (this.drift > 0.4 && sp > 200) {
      this.skidT -= dt;
      if (this.skidT <= 0) {
        this.skidT = 0.016;
        for (const side of [-1, 1]) {
          const rx = this.x - cs * s.len * 0.30 - sn * s.wid * 0.42 * side;
          const ry = this.y - sn * s.len * 0.30 + cs * s.wid * 0.42 * side;
          skid(rx, ry, this.a, s.wid * 0.20);
        }
      }
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.026;
        const rx = this.x - cs * s.len * 0.34, ry = this.y - sn * s.len * 0.34;
        spawn(rx + rnd(-10,10), ry + rnd(-10,10),
              -cs * 60 + rnd(-70,70), -sn * 60 + rnd(-70,70),
              rnd(0.7, 1.25), rnd(9, 16), '190,205,235', false, 46);
      }
    }
    if (this.boost) {
      /* a plume, not a dotted line — spacing at 800 u/s needs several per frame */
      for (let k = 0; k < 3; k++) {
        const back = s.len * (0.5 + k * 0.06);
        const rx = this.x - cs * back + rnd(-4, 4);
        const ry = this.y - sn * back + rnd(-4, 4);
        spawn(rx, ry, -cs * 260 + rnd(-70, 70), -sn * 260 + rnd(-70, 70),
              rnd(0.13, 0.26), rnd(6, 13), k ? '255,150,60' : '255,225,170', true, -16);
      }
    }
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.inv = Math.max(0, this.inv - dt);
    this.lamp += dt * 9;
  }
}

/* ============================================================
   GAME
   ============================================================ */
const G = {
  state:'menu',      // menu | brief | play | draft | crash | over | garage
  ai:true,
  track:null, car:null, spec:null,
  traffic:[], police:[], boss:null, hazards:[],
  score:0, pending:0, chain:0, mult:1, sinceDrift:9,
  heat:0, tier:0, best:Save.data.best,
  coinsRun:0, topMult:1,
  crashT:0, slow:1, flash:0, revived:false,
  shake:0, dist:0,
  run:null, ghost:0, pulseWarn:0, offers:[]
};

const cam = { x:0, y:0, rot:-Math.PI/2, zoom:1, sx:0, sy:0 };

/* ---------------- the ladder ----------------
   Districts get longer, hungrier and hotter. Every third is a boss, where
   the quota is replaced by a pursuit unit you damage by banking into it. */
const DISTRICTS = [
  'Dockside', 'Sodium Row', 'The Spillway', 'Glasshouse', 'Nine Mile',
  'Cathedral Hill', 'Ashfield', 'The Verge', 'Terminus'
];
const BOSSES = [
  { id:'warden', name:'WARDEN',  sub:'Heavy Interdiction',
    blurb:'Rams hard and salts the road behind it.' },
  { id:'siren',  name:'SIREN',   sub:'Signals Division',
    blurb:'Pulses wipe a bank you have let grow too fat.' },
  { id:'reaper', name:'REAPER',  sub:'Pursuit Special',
    blurb:'Faster than you, and it brought friends.' }
];

function districtCfg(n){
  const boss = n % 3 === 0;
  const bi = Math.floor(n / 3) - 1;
  return {
    n, boss,
    name: boss ? BOSSES[bi % BOSSES.length].name : DISTRICTS[(n - 1) % DISTRICTS.length],
    bossDef: boss ? BOSSES[bi % BOSSES.length] : null,
    len: Math.round(420 + n * 34),
    quota: Math.round(2600 * Math.pow(1.38, n - 1)),
    bossHp: Math.round(6500 * Math.pow(1.55, Math.max(0, bi))),
    heatFloor: Math.min(2, Math.floor((n - 1) / 3))
  };
}

function newRun(){
  return {
    district: 0,
    chips: [], curses: [],
    M: NHChips.defaults(),
    cfg: null, quota: 0, banked: 0, startIdx: 0,
    cleared: 0, crumpleLeft: 0
  };
}

function newWorld(ai){
  G.track = new Track();
  G.spec = activeSpec();
  G.traffic = []; G.police = []; G.boss = null; G.hazards = [];
  P.length = 0; SKID.length = 0;
  G.car = new Vehicle(G.spec, 'player');
  G.car.mods = G.run ? G.run.M : NHChips.defaults();
  const st = G.track.at(6, 0);
  G.car.x = st.x; G.car.y = st.y; G.car.a = st.a;
  G.car.vx = Math.cos(st.a) * 300; G.car.vy = Math.sin(st.a) * 300;
  G.car.idx = 6; G.car.nitro = G.spec.nitroMax;
  G.pending = 0; G.chain = 0; G.mult = 1; G.sinceDrift = 9;
  G.heat = 0; G.tier = 0; G.topMult = G.topMult || 1;
  G.slow = 1; G.flash = 0; G.shake = 0; G.dist = 0;
  G.ghost = 0; G.pulseWarn = 0;
  G.ai = !!ai;
  cam.x = G.car.x; cam.y = G.car.y; cam.rot = G.car.a; cam.zoom = baseZoom();
  for (let i = 0; i < 9; i++) addTraffic(20 + i * 22);
}
/* Zoom is bounded by width as well as height, otherwise a portrait phone
   frames less than half the street and you cannot see what you are aiming at. */
const baseZoom = () => clamp(Math.min(H / 640, W / 900), 0.40, 1.5)
  * (G.run ? G.run.M.zoomMul : 1);
/* sit the car lower when there is vertical room to spare, to see further ahead */
const camY = () => H * (W / H < 1.15 ? 0.72 : 0.62);
const roadHalf = p => p.w * (G.run ? G.run.M.roadMul : 1);

function addTraffic(ahead){
  const idx = G.car.idx + ahead;
  G.track.ensure(idx + 10);
  const p = G.track.pts[idx];
  const lat = rnd(-1, 1) * roadHalf(p) * 0.60;
  const c = CARS[rint(0, CARS.length)];
  const spec = Object.assign({}, c, {
    col:'#7C8FBF', col2:'#181F33', power:300, grip:8, top:rnd(210, 330), nitroMax:1
  });
  const v = new Vehicle(spec, 'traffic');
  const pos = G.track.at(idx, lat);
  v.x = pos.x; v.y = pos.y; v.a = pos.a; v.idx = idx; v.lane = lat;
  v.vx = Math.cos(pos.a) * spec.top; v.vy = Math.sin(pos.a) * spec.top;
  G.traffic.push(v);
}

function addPolice(escort){
  const idx = Math.max(0, G.car.idx - 5);
  const pos = G.track.at(idx, rnd(-80, 80));
  const spec = Object.assign({}, CARS[2], {
    col:'#14203C', col2:'#080D1A', power:600, grip:7.0, top:660, nitroMax:1
  });
  const v = new Vehicle(spec, 'police');
  v.x = pos.x; v.y = pos.y; v.a = pos.a; v.idx = idx;
  v.vx = Math.cos(pos.a) * 420; v.vy = Math.sin(pos.a) * 420;
  G.police.push(v);
  if (!escort) toast('Heat rising — units inbound', 'red');
}

/* ---------------- bosses ----------------
   A boss is a pursuit unit with a health bar that only your *banks* can
   hurt. That keeps the fight on the game's actual verb — you cannot shoot
   it, you can only out-drive it and cash in under pressure. */
function addBoss(){
  const cfg = G.run.cfg, def = cfg.bossDef;
  const pos = G.track.at(Math.max(0, G.car.idx - 4), 0);
  const spec = Object.assign({}, CARS[2], {
    len:62, wid:32, nose:0.9, tail:0.95,
    col:'#FF3355', col2:'#3A0A14',
    power: def.id === 'reaper' ? 660 : 600,
    grip:7.2, top: def.id === 'reaper' ? 720 : 665, nitroMax:1
  });
  const v = new Vehicle(spec, 'boss');
  v.x = pos.x; v.y = pos.y; v.a = pos.a; v.idx = pos.p.i;
  v.vx = Math.cos(pos.a) * 460; v.vy = Math.sin(pos.a) * 460;
  v.hp = cfg.bossHp; v.maxHp = cfg.bossHp;
  v.def = def; v.atk = 3.2; v.charge = 0;
  G.boss = v;

  if (def.id === 'reaper') { addPolice(true); addPolice(true); }
  NHAudio.boss();
  toast(def.name + ' — ' + def.sub, 'red');
}

function bossDamage(amount){
  const b = G.boss;
  if (!b) return;
  b.hp -= amount;
  b.hitFlash = 1;
  G.shake = Math.max(G.shake, 12);
  NHAudio.bossHit();
  for (let i = 0; i < 22; i++) {
    const a = rnd(0, TAU), s = rnd(120, 460);
    spawn(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s,
          rnd(0.25, 0.6), rnd(3, 8), '255,90,110', true, -6);
  }
  if (b.hp <= 0) {
    for (let i = 0; i < 70; i++) {
      const a = rnd(0, TAU), s = rnd(140, 700);
      spawn(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s,
            rnd(0.4, 1.1), rnd(4, 12), i % 2 ? '255,170,80' : '255,70,90', true, -6);
    }
    G.flash = 1; G.shake = 30;
    G.boss = null;
    G.police.length = 0;
    clearDistrict();
  }
}

function stepBoss(dt){
  const b = G.boss, car = G.car;
  if (!b) return;
  const loc = G.track.locate(b.x, b.y, b.idx);
  b.idx = loc.i;
  b.offroad = Math.abs(loc.lat) > roadHalf(loc.p) ? 1 : 0;

  b.atk -= dt;
  const st = steerToward(b, car.x + car.vx * 0.3, car.y + car.vy * 0.3);

  if (b.def.id === 'warden') {
    /* telegraphed charge, then a hazard dropped in its wake */
    if (b.atk <= 0) { b.charge = 1.5; b.atk = 5.4; dropHazard(b); }
    if (b.charge > 0) b.charge -= dt;
  } else if (b.def.id === 'siren') {
    if (b.atk <= 0.9 && G.pulseWarn <= 0 && b.atk > 0) G.pulseWarn = b.atk;
    if (b.atk <= 0) {
      b.atk = 7.0; G.pulseWarn = 0;
      /* only punishes hoarding — bank little and often and it does nothing */
      if (G.pending > 2400) {
        G.pending = 0; G.chain = 0; G.mult = 1;
        toast('Bank wiped', 'red');
        NHAudio.curse();
        G.flash = 0.6;
      } else {
        toast('Pulse — bank held', 'pink');
      }
      G.shake = Math.max(G.shake, 14);
    }
  } else if (b.def.id === 'reaper') {
    if (b.atk <= 0) { b.atk = 4.4; b.charge = 1.1; }
    if (b.charge > 0) b.charge -= dt;
  }

  b.drive(dt, st, 1, Math.abs(st) > 0.6 && b.speed > 420 ? 1 : 0, b.charge > 0 ? 1 : 0);
  barrier(b, loc);

  if (G.state === 'play' && !G.ai) {
    const dx = b.x - car.x, dy = b.y - car.y, d = hyp(dx, dy);
    if (d < (b.spec.len + car.spec.len) * 0.38 && car.inv <= 0) {
      const nx = dx / (d || 1), ny = dy / (d || 1);
      const power = b.charge > 0 ? 420 : 260;
      car.vx -= nx * power; car.vy -= ny * power;
      b.vx += nx * 90; b.vy += ny * 90;
      G.shake = Math.max(G.shake, 22);
      car.hitFlash = 1; car.inv = 0.5;
      G.chain = Math.max(0, G.chain - 1.8);
      NHAudio.hit(1.2);
    }
  }
}

/* road hazards dropped by the WARDEN — hitting one kills your chain */
function dropHazard(b){
  const pos = G.track.at(b.idx + 2, rnd(-0.7, 0.7) * roadHalf(G.track.pts[b.idx] || { w:150 }));
  G.hazards.push({ x:pos.x, y:pos.y, a:pos.a, life:11, hit:0 });
  if (G.hazards.length > 14) G.hazards.shift();
}

function stepHazards(dt){
  const car = G.car;
  for (let i = G.hazards.length - 1; i >= 0; i--) {
    const h = G.hazards[i];
    h.life -= dt;
    if (h.life <= 0 || h.hit) { G.hazards.splice(i, 1); continue; }
    if (G.state !== 'play' || G.ai || car.inv > 0) continue;
    if (hyp(h.x - car.x, h.y - car.y) < 46) {
      h.hit = 1;
      G.chain = 0; G.pending = Math.floor(G.pending * 0.5);
      car.vx *= 0.72; car.vy *= 0.72;
      G.shake = Math.max(G.shake, 16);
      car.hitFlash = 1;
      NHAudio.hit(0.9);
      toast('Spike strip', 'red');
    }
  }
}

/* -------- steering helper shared by AI, traffic and police -------- */
function steerToward(v, tx, ty){
  const want = Math.atan2(ty - v.y, tx - v.x);
  return clamp(adiff(want, v.a) * 2.1, -1, 1);
}

/* -------- attract-mode / traffic autopilot -------- */
function autoDrive(v, dt, aggressive){
  const loc = G.track.locate(v.x, v.y, v.idx);
  v.idx = loc.i;
  const look = Math.round(clamp(v.speed / 90, 4, 12));
  const tgt = G.track.at(v.idx + look, v.lane || 0);
  const st = steerToward(v, tgt.x, tgt.y);
  /* the attract driver drifts through corners so the menu looks alive */
  const wantDrift = aggressive && Math.abs(st) > 0.20 && v.speed > 300;
  v.driftHeld = wantDrift ? 1 : 0;
  v.offroad = Math.abs(loc.lat) > roadHalf(loc.p) ? 1 : 0;
  v.drive(dt, st, 1, wantDrift ? 1 : 0, aggressive && Math.abs(st) < 0.2 ? 1 : 0);
  barrier(v, loc);
}

/* -------- barrier response -------- */
function barrier(v, loc){
  const lim = roadHalf(loc.p) - v.spec.wid * 0.5;
  if (Math.abs(loc.lat) <= lim) return 0;
  const side = Math.sign(loc.lat);
  const p = loc.p;
  const nx = -Math.sin(p.a) * side, ny = Math.cos(p.a) * side;
  const over = Math.abs(loc.lat) - lim;

  v.x -= nx * over; v.y -= ny * over;
  const into = v.vx * nx + v.vy * ny;      // velocity component into the wall
  if (into > 0) {
    /* absorb rather than rebound — a bouncy wall pinballs you across the road */
    v.vx -= nx * into * 0.92;
    v.vy -= ny * into * 0.92;
  }
  return into;
}

/* -------- scoring -------- */
function bank(){
  if (G.pending < 1) { G.chain = 0; G.mult = 1; return; }
  const M = G.run.M;
  const heatMul = 1 + G.tier * 0.35 + (G.tier >= 2 ? M.heatBonus : 0);
  const gained = Math.floor(G.pending * heatMul * M.bankMul);

  G.score += gained;
  G.run.banked += gained;
  G.heat = Math.min(3.0, G.heat + gained / 14000);
  NHAudio.bank(G.mult);

  /* chips that trigger on the cash-in, not on the drift */
  if (M.ghostOnBank) G.ghost = Math.max(G.ghost, M.ghostOnBank);
  if (M.shockOnBank) {
    for (const p of G.police) {
      const d = hyp(p.x - G.car.x, p.y - G.car.y);
      if (d < 420) {
        const nx = (p.x - G.car.x) / (d || 1), ny = (p.y - G.car.y) / (d || 1);
        p.vx += nx * 460; p.vy += ny * 460;
        p.a += rnd(-1.6, 1.6);
        p.hitFlash = 1;
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = rnd(0, TAU), s = rnd(250, 620);
      spawn(G.car.x, G.car.y, Math.cos(a) * s, Math.sin(a) * s,
            rnd(0.2, 0.45), rnd(4, 9), '120,220,255', true, -8);
    }
  }

  if (G.boss) { bossDamage(gained); toast('-' + fmt(gained) + ' integrity', 'red'); }
  else toast('Banked +' + fmt(gained), 'gold');

  G.pending = 0; G.chain = 0; G.mult = 1;

  /* quota districts clear the moment you meet the number */
  if (!G.boss && G.run.cfg && !G.run.cfg.boss && G.run.banked >= G.run.quota) clearDistrict();
}

function toast(text, cls){
  const el = document.createElement('div');
  el.className = 'toast' + (cls ? ' ' + cls : '');
  el.textContent = text;
  UI.toasts.appendChild(el);
  setTimeout(() => el.remove(), 1150);
  while (UI.toasts.children.length > 4) UI.toasts.firstChild.remove();
}

/* -------- crash -------- */
function crash(reason){
  if (G.state !== 'play' || G.car.inv > 0) return;

  /* Crumple Zone spends a charge instead of ending the run */
  if (G.run && G.run.crumpleLeft > 0) {
    G.run.crumpleLeft--;
    G.car.inv = 2.2;
    G.car.hitFlash = 1;
    G.pending = 0; G.chain = 0; G.mult = 1;
    G.shake = 22; G.flash = 0.7;
    G.car.vx *= 0.45; G.car.vy *= 0.45;
    NHAudio.hit(1.4);
    toast('Crumple zone spent', 'gold');
    return;
  }

  NHAudio.crash();
  G.state = 'crash';
  G.crashT = 0;
  G.flash = 1;
  G.shake = 26;
  G.pending = 0; G.chain = 0; G.mult = 1;
  G.car.hitFlash = 1;
  UI.hud.classList.add('off');
  for (let i = 0; i < 46; i++) {
    const a = rnd(0, TAU), s = rnd(120, 620);
    spawn(G.car.x, G.car.y, Math.cos(a) * s, Math.sin(a) * s,
          rnd(0.35, 0.95), rnd(3, 8), i % 3 ? '255,190,90' : '255,80,80', true, -5);
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd(0, TAU), s = rnd(30, 190);
    spawn(G.car.x, G.car.y, Math.cos(a) * s, Math.sin(a) * s,
          rnd(0.9, 1.8), rnd(14, 30), '120,130,150', false, 60);
  }
  G.crashReason = reason;
}

/* ============================================================
   SIMULATION STEP
   ============================================================ */
function step(dt){
  const T = G.track, car = G.car;
  const playing = G.state === 'play';

  if (playing) {
    readInput();
    const loc = T.locate(car.x, car.y, car.idx);
    car.idx = loc.i;
    car.offroad = Math.abs(loc.lat) > roadHalf(loc.p) ? 1 : 0;

    if (G.ai) autoDrive(car, dt, true);
    else {
      car.drive(dt, IN.steer, 1, IN.drift, IN.nitro);
      const into = barrier(car, loc);
      if (into > 40) {
        /* graze sparks; only a hard perpendicular hit ends the run */
        const n = Math.min(14, Math.floor(into / 26));
        for (let i = 0; i < n; i++) {
          const a = rnd(0, TAU), s = rnd(90, 340);
          spawn(car.x, car.y, Math.cos(a) * s, Math.sin(a) * s,
                rnd(0.2, 0.5), rnd(2, 5), '255,215,140', true, -4);
        }
        G.shake = Math.max(G.shake, Math.min(16, into / 22));
        if (Math.random() < 0.25) NHAudio.spark();
        if (into > G.spec.crashV) { crash('wall'); return; }
        if (G.run.M.brittle) { G.chain = 0; if (G.pending > 0) bank(); }
        else G.chain = Math.max(0, G.chain - dt * 2.5);
      }
    }
    G.dist += car.speed * dt;

    /* ---- drift scoring ----
       Points accrue only while the drift input is held, and pay out when it
       is released. Tying the payout to the button — not to the physics
       settling — is what makes the bet legible: you choose when to cash in. */
    const M = G.run.M;
    const held = G.ai ? car.driftHeld : IN.drift;
    const scoring = held && car.drift > 0.5 && car.speed > 210 && !car.offroad;
    if (scoring) {
      G.sinceDrift = 0;
      G.chain += dt;
      /* Afterburn rewards spending nitro mid-slide instead of hoarding it */
      if (car.boost && M.afterburn) G.chain += M.afterburn * dt;
      G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
      G.topMult = Math.max(G.topMult, G.mult);
      G.pending += car.speed * 0.40 * G.mult * dt * M.accrueMul;
    } else {
      G.sinceDrift += dt;
      if (G.sinceDrift > M.chainGrace && G.pending > 0) bank();
    }

    G.ghost = Math.max(0, G.ghost - dt);
    G.heat = Math.max(0, G.heat - dt * 0.038);
    G.tier = Math.max(G.run.cfg ? G.run.cfg.heatFloor + M.policeStart : 0, Math.floor(G.heat));
    G.tier = Math.min(3, G.tier);

    stepHazards(dt);
    if (G.boss) stepBoss(dt);

    /* reaching the checkpoint decides the district */
    if (G.run.cfg) {
      const travelled = car.idx - G.run.startIdx;
      if (travelled >= G.run.cfg.len) {
        if (G.run.cfg.boss) failDistrict('The unit got away');
        else if (G.run.banked >= G.run.quota) clearDistrict();
        else failDistrict('Quota missed');
        return;
      }
    }
  }

  /* ---- traffic ---- */
  for (let i = G.traffic.length - 1; i >= 0; i--) {
    const t = G.traffic[i];
    autoDrive(t, dt, false);
    if (t.idx < car.idx - 24 || t.idx > car.idx + 120) { G.traffic.splice(i, 1); continue; }

    const dx = t.x - car.x, dy = t.y - car.y, d = hyp(dx, dy);
    const touchR = (t.spec.len + car.spec.len) * 0.36;
    if (playing && !G.ai) {
      if (d < touchR && car.inv <= 0) {
        /* You close on traffic at ~400, so a 210 threshold made any contact
           fatal. Only a genuine high-speed impact ends the run; the rest
           bumps, costs chain, and grants a moment of grace so one nudge
           into a cluster cannot chain-kill. */
        const rel = hyp(t.vx - car.vx, t.vy - car.vy);
        if (rel > 380) { crash('traffic'); return; }
        const nx = dx / (d || 1), ny = dy / (d || 1);
        car.vx -= nx * 150; car.vy -= ny * 150;
        t.vx += nx * 150; t.vy += ny * 150;
        G.shake = Math.max(G.shake, 13);
        car.hitFlash = 1; car.inv = 0.35;
        NHAudio.hit(0.8);
        G.chain = Math.max(0, G.chain - 0.9);
      } else if (d < 105 && !t.nearFlag && car.speed > 260) {
        t.nearFlag = true;
        const M = G.run.M;
        if (G.chain > 0.25) {
          const bonus = 220 * G.mult * M.nearMul;
          G.pending += bonus;
          G.chain += 0.32;
          toast('Near miss +' + fmt(bonus), 'pink');
          NHAudio.nearMiss();
        }
        if (M.nearNitro) car.nitro = Math.min(G.spec.nitroMax * M.nitroCap, car.nitro + M.nearNitro);
        if (M.nearTop) car.topBonus += M.nearTop;
      }
      if (d > 140) t.nearFlag = false;
    }
  }
  while (G.traffic.length < Math.round(8 * (G.run ? G.run.M.trafficMul : 1))) addTraffic(rint(46, 118));

  /* ---- police ---- */
  if (playing && !G.ai && !G.boss) {
    while (G.police.length < G.tier) addPolice();
    while (G.police.length > G.tier) G.police.pop();
  }
  for (let i = G.police.length - 1; i >= 0; i--) {
    const p = G.police[i];
    const loc = T.locate(p.x, p.y, p.idx);
    p.idx = loc.i;
    p.offroad = Math.abs(loc.lat) > roadHalf(loc.p) ? 1 : 0;
    /* aim slightly ahead of the player so they cut the corner —
       unless Ghost Plates has them chasing a lost trail */
    const lost = G.ghost > 0;
    const st = lost
      ? steerToward(p, G.track.at(p.idx + 8, 0).x, G.track.at(p.idx + 8, 0).y)
      : steerToward(p, car.x + car.vx * 0.35, car.y + car.vy * 0.35);
    p.drive(dt, st, 1, Math.abs(st) > 0.6 && p.speed > 400 ? 1 : 0, 1);
    barrier(p, loc);

    if (playing && !G.ai) {
      const dx = p.x - car.x, dy = p.y - car.y, d = hyp(dx, dy);
      if (!lost && car.inv <= 0 && d < (p.spec.len + car.spec.len) * 0.36) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        car.vx -= nx * 240; car.vy -= ny * 240;
        p.vx += nx * 120; p.vy += ny * 120;
        G.shake = Math.max(G.shake, 18);
        car.hitFlash = 1;
        G.chain = Math.max(0, G.chain - 1.6);
        G.heat = Math.max(0, G.heat - 0.25);
        NHAudio.hit(1);
        toast('Rammed', 'red');
      }
    }
    if (p.idx < car.idx - 40) G.police.splice(i, 1);
  }

  /* ---- crash sequence ---- */
  if (G.state === 'crash') {
    G.crashT += dt;
    G.slow = damp(G.slow, 0.22, 4, dt);
    G.car.drive(dt, 0, 0, 1, 0);
    if (G.crashT > 1.15) endRun();
  } else {
    G.slow = damp(G.slow, 1, 6, dt);
  }

  stepFX(dt);

  /* ---- camera ---- */
  const lead = 0.22;
  const tx = car.x + car.vx * lead, ty = car.y + car.vy * lead;
  cam.x = damp(cam.x, tx, 7, dt);
  cam.y = damp(cam.y, ty, 7, dt);
  /* follow the velocity vector, not the nose — that is what sells a slide */
  const heading = car.speed > 90 ? Math.atan2(car.vy, car.vx) : car.a;
  cam.rot += adiff(heading, cam.rot) * (1 - Math.exp(-4.4 * dt));
  const spdZoom = 1 - clamp(car.speed / 1100, 0, 1) * 0.20;
  cam.zoom = damp(cam.zoom, baseZoom() * spdZoom * (G.state === 'crash' ? 1.18 : 1), 3, dt);

  G.shake = Math.max(0, G.shake - dt * 34);
  cam.sx = rnd(-1, 1) * G.shake;
  cam.sy = rnd(-1, 1) * G.shake;
  G.flash = Math.max(0, G.flash - dt * 2.4);

  T.ensure(car.idx + 140);
}

/* ============================================================
   RENDER
   ============================================================ */
function w2s(x, y){
  const th = -cam.rot - Math.PI / 2;
  const ct = Math.cos(th), st = Math.sin(th);
  const dx = x - cam.x, dy = y - cam.y;
  return [
    W / 2 + cam.sx + (dx * ct - dy * st) * cam.zoom,
    camY() + cam.sy + (dx * st + dy * ct) * cam.zoom
  ];
}
function applyCam(){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.translate(W / 2 + cam.sx, camY() + cam.sy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.rotate(-cam.rot - Math.PI / 2);
  ctx.translate(-cam.x, -cam.y);
}

function drawGround(){
  ctx.fillStyle = CL.ground;
  ctx.fillRect(cam.x - 4000, cam.y - 4000, 8000, 8000);

  /* world-aligned grid: cheap, and it reads as motion at speed */
  const R = hyp(W, H) / cam.zoom * 0.62;
  const S = 240;
  ctx.strokeStyle = 'rgba(70,120,190,0.075)';
  ctx.lineWidth = 1.4 / cam.zoom;
  ctx.beginPath();
  const x0 = Math.floor((cam.x - R) / S) * S, x1 = cam.x + R;
  for (let x = x0; x <= x1; x += S) { ctx.moveTo(x, cam.y - R); ctx.lineTo(x, cam.y + R); }
  const y0 = Math.floor((cam.y - R) / S) * S, y1 = cam.y + R;
  for (let y = y0; y <= y1; y += S) { ctx.moveTo(cam.x - R, y); ctx.lineTo(cam.x + R, y); }
  ctx.stroke();
}

function visibleRange(){
  const i = G.car.idx;
  const reach = Math.round(clamp(34 / cam.zoom * 1.6, 26, 70));
  return [Math.max(0, i - 12), Math.min(G.track.pts.length - 1, i + reach)];
}

function drawRoad(){
  const [a, b] = visibleRange();
  const pts = G.track.pts;

  ctx.beginPath();
  for (let i = a; i <= b; i++) {
    const p = pts[i];
    const hw = roadHalf(p);
    const nx = -Math.sin(p.a) * hw, ny = Math.cos(p.a) * hw;
    if (i === a) ctx.moveTo(p.x + nx, p.y + ny); else ctx.lineTo(p.x + nx, p.y + ny);
  }
  for (let i = b; i >= a; i--) {
    const p = pts[i];
    const hw = roadHalf(p);
    const nx = -Math.sin(p.a) * hw, ny = Math.cos(p.a) * hw;
    ctx.lineTo(p.x - nx, p.y - ny);
  }
  ctx.closePath();
  ctx.fillStyle = CL.asphalt;
  ctx.fill();

  /* the barriers spill light onto the surface they enclose */
  ctx.save();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let i = a; i <= b; i++) {
      const p = pts[i];
      const hw = roadHalf(p) * side;
      const nx = -Math.sin(p.a) * hw, ny = Math.cos(p.a) * hw;
      if (i === a) ctx.moveTo(p.x + nx, p.y + ny); else ctx.lineTo(p.x + nx, p.y + ny);
    }
    ctx.strokeStyle = hexA(side < 0 ? CL.cyan : CL.magenta, 0.10);
    ctx.lineWidth = 90;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  /* lane divider + centre dashes */
  ctx.strokeStyle = 'rgba(198,210,232,0.13)';
  ctx.lineWidth = 2.5;
  for (const f of [-0.34, 0.34]) {
    ctx.beginPath();
    for (let i = a; i <= b; i++) {
      const p = pts[i];
      const nx = -Math.sin(p.a) * roadHalf(p) * f, ny = Math.cos(p.a) * roadHalf(p) * f;
      if (i === a) ctx.moveTo(p.x + nx, p.y + ny); else ctx.lineTo(p.x + nx, p.y + ny);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(210,225,245,0.38)';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  for (let i = a; i < b; i++) {
    if (i % 4 > 1) continue;
    const p = pts[i], q = pts[i + 1];
    ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();

  /* neon barriers — the emissive layer the bloom pass feeds on */
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let i = a; i <= b; i++) {
      const p = pts[i];
      const hw = roadHalf(p) * side;
      const nx = -Math.sin(p.a) * hw, ny = Math.cos(p.a) * hw;
      if (i === a) ctx.moveTo(p.x + nx, p.y + ny); else ctx.lineTo(p.x + nx, p.y + ny);
    }
    const col = side < 0 ? CL.cyan : CL.magenta;
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexA(col, 0.30); ctx.lineWidth = 16; ctx.stroke();
    ctx.strokeStyle = col;             ctx.lineWidth = 5;  ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

/* three alpha buckets, one path each — 600 decals in 3 draw calls */
function drawSkids(){
  for (let b = 0; b < 3; b++) {
    const lo = b / 3 * 5.5, hi = (b + 1) / 3 * 5.5;
    let any = false;
    ctx.beginPath();
    for (const s of SKID) {
      if (s.life < lo || s.life >= hi) continue;
      const q = s.q;
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(q[2], q[3]);
      ctx.lineTo(q[4], q[5]);
      ctx.lineTo(q[6], q[7]);
      ctx.closePath();
      any = true;
    }
    if (!any) continue;
    ctx.fillStyle = 'rgba(3,5,12,' + (0.14 + b * 0.13).toFixed(2) + ')';
    ctx.fill();
  }
}

function drawParticles(){
  for (const p of P) {
    const t = clamp(p.life / p.max, 0, 1);
    ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    ctx.fillStyle = 'rgba(' + p.col + ',' + (t * (p.add ? 0.85 : 0.30)).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawHazards(){
  for (const h of G.hazards) {
    const fade = clamp(h.life / 1.6, 0, 1);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.a);
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(255,51,85,0.20)';
    ctx.fillRect(-9, -46, 18, 92);
    ctx.strokeStyle = CL.red;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(-9, -46, 18, 92);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,51,85,0.55)';
    ctx.beginPath();
    for (let y = -42; y <= 42; y += 12) { ctx.moveTo(-9, y); ctx.lineTo(9, y - 6); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/* --- procedural car: the only "asset" in the game --- */
function carPath(ctx, s){
  const L = s.len, Wd = s.wid;
  ctx.beginPath();
  ctx.moveTo(L * 0.5, -Wd * 0.5 * s.nose);
  ctx.quadraticCurveTo(L * 0.56, 0, L * 0.5, Wd * 0.5 * s.nose);
  ctx.lineTo(L * 0.18, Wd * 0.5);
  ctx.lineTo(-L * 0.32, Wd * 0.5);
  ctx.lineTo(-L * 0.5, Wd * 0.5 * s.tail);
  ctx.quadraticCurveTo(-L * 0.56, 0, -L * 0.5, -Wd * 0.5 * s.tail);
  ctx.lineTo(-L * 0.32, -Wd * 0.5);
  ctx.lineTo(L * 0.18, -Wd * 0.5);
  ctx.closePath();
}

function drawVehicle(v, opt){
  const s = v.spec;
  const o = opt || {};
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.a);

  /* underglow — reads as ground contact and feeds the bloom */
  if (o.glow !== false) {
    ctx.globalCompositeOperation = 'lighter';
    blitGlow(s.col, 0, 0, s.len * 0.9, s.wid * 1.4, 0.30);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* drop shadow */
  ctx.save();
  ctx.translate(4, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  carPath(ctx, s); ctx.fill();
  ctx.restore();

  /* wheels */
  ctx.fillStyle = '#12161F';
  const wr = s.len * 0.13, ww = s.wid * 0.14;
  for (const [fx, fy] of [[0.30, 0.54], [0.30, -0.54], [-0.30, 0.54], [-0.30, -0.54]]) {
    ctx.save();
    ctx.translate(s.len * fx, s.wid * fy);
    if (fx > 0) ctx.rotate(v.steer * 0.42);
    ctx.fillRect(-wr, -ww, wr * 2, ww * 2);
    ctx.restore();
  }

  /* body */
  const bg = ctx.createLinearGradient(0, -s.wid * 0.6, 0, s.wid * 0.6);
  bg.addColorStop(0, s.col2);
  bg.addColorStop(0.45, mix(s.col, s.col2, 0.55));
  bg.addColorStop(1, s.col2);
  carPath(ctx, s);
  ctx.fillStyle = bg; ctx.fill();

  /* rim light along the silhouette */
  ctx.strokeStyle = hexA(s.col, 0.95);
  ctx.lineWidth = 1.7; ctx.stroke();

  /* cockpit */
  ctx.beginPath();
  ctx.moveTo(s.len * 0.14, -s.wid * 0.30);
  ctx.lineTo(-s.len * 0.06, -s.wid * 0.36);
  ctx.lineTo(-s.len * 0.24, -s.wid * 0.26);
  ctx.lineTo(-s.len * 0.24, s.wid * 0.26);
  ctx.lineTo(-s.len * 0.06, s.wid * 0.36);
  ctx.lineTo(s.len * 0.14, s.wid * 0.30);
  ctx.closePath();
  const cg = ctx.createLinearGradient(s.len * 0.2, 0, -s.len * 0.3, 0);
  cg.addColorStop(0, 'rgba(200,235,255,0.30)');
  cg.addColorStop(1, 'rgba(10,16,32,0.85)');
  ctx.fillStyle = cg; ctx.fill();

  /* centre stripe */
  ctx.fillStyle = hexA(s.col, 0.22);
  ctx.fillRect(-s.len * 0.5, -s.wid * 0.055, s.len, s.wid * 0.11);

  ctx.globalCompositeOperation = 'lighter';

  /* exhaust flame — a drawn plume reads solid where particles alone stipple */
  if (v.boost) {
    const fl = s.len * (1.1 + Math.sin(v.lamp * 3) * 0.16);
    const fg = ctx.createLinearGradient(-s.len * 0.5, 0, -s.len * 0.5 - fl, 0);
    fg.addColorStop(0,    'rgba(255,246,220,0.85)');
    fg.addColorStop(0.28, 'rgba(255,168,66,0.55)');
    fg.addColorStop(1,    'rgba(255,90,30,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-s.len * 0.48, -s.wid * 0.30);
    ctx.quadraticCurveTo(-s.len * 0.5 - fl * 0.6, -s.wid * 0.16, -s.len * 0.5 - fl, 0);
    ctx.quadraticCurveTo(-s.len * 0.5 - fl * 0.6, s.wid * 0.16, -s.len * 0.48, s.wid * 0.30);
    ctx.closePath();
    ctx.fill();
  }

  /* headlights + cones */
  for (const sy of [-1, 1]) {
    ctx.fillStyle = 'rgba(220,245,255,0.95)';
    ctx.fillRect(s.len * 0.44, sy * s.wid * 0.30 - s.wid * 0.05, s.len * 0.06, s.wid * 0.11);
  }
  if (o.lights !== false) {
    const lg = ctx.createLinearGradient(s.len * 0.5, 0, s.len * 2.6, 0);
    lg.addColorStop(0, 'rgba(190,230,255,0.20)');
    lg.addColorStop(1, 'rgba(190,230,255,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(s.len * 0.5, -s.wid * 0.4);
    ctx.lineTo(s.len * 2.6, -s.wid * 1.5);
    ctx.lineTo(s.len * 2.6, s.wid * 1.5);
    ctx.lineTo(s.len * 0.5, s.wid * 0.4);
    ctx.closePath(); ctx.fill();
  }

  /* tail lights, brighter while sliding */
  const tb = 0.55 + v.drift * 0.45;
  ctx.fillStyle = 'rgba(255,60,70,' + tb.toFixed(2) + ')';
  for (const sy of [-1, 1]) {
    ctx.fillRect(-s.len * 0.5, sy * s.wid * 0.28 - s.wid * 0.05, s.len * 0.05, s.wid * 0.11);
  }

  /* police bar */
  if (v.kind === 'police' || v.kind === 'boss') {
    const f = Math.sin(v.lamp) > 0;
    ctx.fillStyle = f ? 'rgba(80,140,255,0.95)' : 'rgba(255,50,70,0.95)';
    ctx.fillRect(-s.len * 0.08, -s.wid * 0.5, s.len * 0.1, s.wid);
    blitGlow(f ? '#508CFF' : '#FF3246', 0, 0, s.len * 1.5, s.len * 1.5, 0.40);
  }

  if (v.hitFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (v.hitFlash * 0.6).toFixed(2) + ')';
    carPath(ctx, s); ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/* --- pseudo-3D city: footprints extruded away from screen centre --- */
function drawCity(){
  const [a, b] = visibleRange();
  const pts = G.track.pts;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const cx = W / 2 + cam.sx, cy = camY() + cam.sy;

  const list = [];
  for (let i = b; i >= a; i--) {
    const p = pts[i];
    if (!p.b) continue;
    for (const bd of p.b) list.push(bd);
  }

  for (const bd of list) {
    const ca = Math.cos(bd.a), sa = Math.sin(bd.a);
    const hw = bd.w * 0.5, hd = bd.d * 0.5;
    const corners = [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([lx, ly]) =>
      w2s(bd.x + lx * ca - ly * sa, bd.y + lx * sa + ly * ca));

    /* skip anything fully offscreen */
    let vis = false;
    for (const c of corners) if (c[0] > -300 && c[0] < W + 300 && c[1] > -300 && c[1] < H + 300) { vis = true; break; }
    if (!vis) continue;

    const k = bd.h * 0.00058 * cam.zoom;
    const top = corners.map(c => [c[0] + (c[0] - cx) * k, c[1] + (c[1] - cy) * k]);

    /* footprint, so the block sits on the ground instead of floating */
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.fillStyle = '#04060C';
    ctx.fill();

    /* side faces — only the ones turned away from centre are visible.
       Each gets a base-to-roof gradient plus floor lines reading as windows. */
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const b0 = corners[i], b1 = corners[j], t0 = top[i], t1 = top[j];
      /* winding test: skip faces pointing back toward the camera centre */
      const ex = b1[0] - b0[0], ey = b1[1] - b0[1];
      const mx = (b0[0] + b1[0]) * 0.5 - cx, my = (b0[1] + b1[1]) * 0.5 - cy;
      if (ex * my - ey * mx < 0) continue;

      ctx.beginPath();
      ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]);
      ctx.lineTo(t1[0], t1[1]); ctx.lineTo(t0[0], t0[1]);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#141A2D' : '#0F1424';
      ctx.fill();

      if (bd.lit && QF.windows) {
        ctx.save();
        ctx.clip();
        /* dashed rows read as lit windows; solid rows read as wireframe */
        ctx.strokeStyle = hexA(bd.hue, 0.34);
        ctx.lineWidth = Math.max(0.8, 1.6 * cam.zoom);
        ctx.setLineDash([Math.max(1.5, 3 * cam.zoom), Math.max(3, 6 * cam.zoom)]);
        ctx.lineDashOffset = bd.seed;
        ctx.beginPath();
        const floors = 3 + Math.floor(bd.h / 120);
        for (let f = 1; f < floors; f++) {
          const t = f / floors;
          ctx.moveTo(lerp(b0[0], t0[0], t), lerp(b0[1], t0[1], t));
          ctx.lineTo(lerp(b1[0], t1[0], t), lerp(b1[1], t1[1], t));
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    /* roof */
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(top[i][0], top[i][1]);
    ctx.closePath();
    ctx.fillStyle = '#1A2138';
    ctx.fill();

    /* neon roofline — the city's whole read comes from this one stroke */
    if (bd.lit) {
      ctx.strokeStyle = hexA(bd.hue, 1);
      ctx.lineWidth = Math.max(1.2, 2.4 * cam.zoom);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(bd.hue, 0.32);
      ctx.lineWidth = Math.max(2, 9 * cam.zoom);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* depth fog: the top of the screen is the far distance, so fade it out */
  const fog = ctx.createLinearGradient(0, 0, 0, camY() * 0.84);
  fog.addColorStop(0,    'rgba(5,6,14,0.72)');
  fog.addColorStop(0.45, 'rgba(5,6,14,0.30)');
  fog.addColorStop(1,    'rgba(5,6,14,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, camY() * 0.84);
}

function drawLamps(){
  const [a, b] = visibleRange();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = a; i <= b; i++) {
    const p = G.track.pts[i];
    if (!p.lamp) continue;
    for (const side of [-1, 1]) {
      const x = p.x - Math.sin(p.a) * (roadHalf(p) + 16) * side;
      const y = p.y + Math.cos(p.a) * (roadHalf(p) + 16) * side;
      blitGlow(side < 0 ? CL.cyan : CL.magenta, x, y, 46, 46, 0.30);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* --- post: bright-pass, blur, additive composite --- */
function bloom(){
  if (!QF.bloom) return;
  const bw = bufA.width, bh = bufA.height;
  bA.setTransform(1, 0, 0, 1, 0, 0);
  bA.globalCompositeOperation = 'source-over';
  bA.filter = 'none';
  bA.clearRect(0, 0, bw, bh);
  bA.drawImage(cv, 0, 0, bw, bh);

  /* square luminance: keeps the neon, drops the asphalt */
  bB.setTransform(1, 0, 0, 1, 0, 0);
  bB.globalCompositeOperation = 'source-over';
  bB.filter = 'none';
  bB.clearRect(0, 0, bw, bh);
  bB.drawImage(bufA, 0, 0);
  bB.globalCompositeOperation = 'multiply';
  bB.drawImage(bufA, 0, 0);
  bB.globalCompositeOperation = 'source-over';

  /* tight tap */
  bA.clearRect(0, 0, bw, bh);
  bA.filter = 'blur(4px)';
  bA.drawImage(bufB, 0, 0);
  bA.filter = 'none';

  /* wide tap for atmospheric haze, added into bufA at quarter res so the
     upscale to the main canvas — the expensive part — happens exactly once */
  if (QF.wide) {
    bB.clearRect(0, 0, bw, bh);
    bB.filter = 'blur(9px)';
    bB.drawImage(bufA, 0, 0);
    bB.filter = 'none';
    bA.globalCompositeOperation = 'lighter';
    bA.globalAlpha = 0.55;
    bA.drawImage(bufB, 0, 0);
    bA.globalAlpha = 1;
    bA.globalCompositeOperation = 'source-over';
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.95;
  ctx.drawImage(bufA, 0, 0, cv.width, cv.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/* A chase you cannot see is just a random shove. Anything hunting you that
   is off screen gets a chevron pinned to the edge, pointing at it. */
function drawThreats(){
  if (G.state !== 'play' && G.state !== 'crash') return;
  const list = G.boss ? G.police.concat([G.boss]) : G.police;
  if (!list.length) return;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const cx = W / 2, cy = camY(), pad = Math.max(24, W * 0.055);

  for (const v of list) {
    const [sx, sy] = w2s(v.x, v.y);
    const inView = sx > pad && sx < W - pad && sy > pad && sy < H - pad;
    if (inView) continue;

    const dx = sx - cx, dy = sy - cy;
    const ang = Math.atan2(dy, dx);
    /* clamp onto the inset viewport rectangle */
    const hw = W / 2 - pad, hh = H / 2 - pad;
    const t = Math.min(hw / Math.abs(Math.cos(ang) || 1e-6), hh / Math.abs(Math.sin(ang) || 1e-6));
    const px = cx + Math.cos(ang) * t, py = cy + Math.sin(ang) * t;

    const dist = hyp(v.x - G.car.x, v.y - G.car.y);
    const near = clamp(1 - dist / 1400, 0.18, 1);
    const isBoss = v.kind === 'boss';
    const size = (isBoss ? 16 : 12) * (0.8 + near * 0.5);

    ctx.save();
    ctx.translate(clamp(px, pad, W - pad), clamp(py, pad, H - pad));
    ctx.rotate(ang);
    ctx.globalAlpha = 0.35 + near * 0.6;
    ctx.fillStyle = isBoss ? CL.red : '#FF6A80';
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.72);
    ctx.lineTo(-size * 0.35, 0);
    ctx.lineTo(-size * 0.7, size * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function post(){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (plates.length) {
    /* cycling the plate every third frame animates the grain without cost */
    if (QF.grain) plateI = (plateI + 1) % (plates.length * 3);
    ctx.drawImage(plates[Math.floor(plateI / 3)], 0, 0, W, H);
  }
  if (G.flash > 0.01) {
    ctx.fillStyle = 'rgba(255,240,220,' + (G.flash * 0.55).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function render(){
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = CL.void;
  ctx.fillRect(0, 0, cv.width, cv.height);

  applyCam();
  drawGround();
  drawRoad();
  drawSkids();
  drawLamps();
  drawHazards();
  for (const t of G.traffic) drawVehicle(t, { lights:false });
  for (const p of G.police) drawVehicle(p);
  if (G.boss) drawVehicle(G.boss);
  drawVehicle(G.car);
  drawParticles();

  if (QF.city) drawCity();
  bloom();
  drawThreats();
  post();
}

/* Radial falloffs are the single most common shape in the scene and the
   most expensive to build. Bake one sprite per colour and blit it. */
const glowCache = new Map();
function glowSprite(col){
  let s = glowCache.get(col);
  if (s) return s;
  const R = 64;
  s = document.createElement('canvas');
  s.width = s.height = R * 2;
  const g = s.getContext('2d');
  const rg = g.createRadialGradient(R, R, 1, R, R, R);
  rg.addColorStop(0,   hexA(col, 1));
  rg.addColorStop(0.4, hexA(col, 0.34));
  rg.addColorStop(1,   hexA(col, 0));
  g.fillStyle = rg;
  g.fillRect(0, 0, R * 2, R * 2);
  glowCache.set(col, s);
  return s;
}
function blitGlow(col, x, y, rx, ry, alpha){
  const s = glowSprite(col);
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = 1;
}

/* ---- small colour helpers ---- */
function hexA(hex, a){
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function mix(a, b, t){
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

/* ============================================================
   UI
   ============================================================ */
const $ = id => document.getElementById(id);
const UI = {
  hud:$('hud'), score:$('score'), coins:$('coins'),
  combo:$('combo'), cmult:$('cmult'), cpts:$('cpts'), cfill:$('cfill'),
  heat:$('heat'), spd:$('spd'), nfill:$('nfill'), toasts:$('toasts'),
  menu:$('menu'), over:$('over'), garage:$('garage'),
  brief:$('brief'), draft:$('draft'),
  obj:$('obj'), objLbl:$('objLbl'), objVal:$('objVal'), objFill:$('objFill'),
  objDist:$('objDist'), dchip:$('dchip'), build:$('build')
};
const heatPips = UI.heat.querySelectorAll('i');

let shownScore = 0;
function syncHUD(){
  shownScore = lerp(shownScore, G.score, 0.2);
  UI.score.textContent = fmt(shownScore);
  UI.coins.textContent = fmt(Save.data.coins + G.coinsRun);
  UI.spd.textContent = Math.round(G.car.speed * 0.52);
  UI.nfill.style.width = clamp(G.car.nitro / (G.spec.nitroMax || 1), 0, 1) * 100 + '%';

  const active = G.pending > 0 || G.chain > 0.05;
  UI.combo.classList.toggle('on', active);
  UI.combo.classList.toggle('hot', G.mult > 5);
  UI.cmult.innerHTML = '&times;' + G.mult.toFixed(1);
  UI.cpts.textContent = fmt(G.pending);
  UI.cfill.style.width = clamp(G.mult / 9.9, 0, 1) * 100 + '%';

  UI.heat.classList.toggle('on', G.heat > 0.05 || G.tier > 0);
  UI.heat.classList.toggle('max', G.tier >= 3);
  heatPips.forEach((el, i) => el.classList.toggle('lit', i < G.tier));

  /* objective rail: quota progress, or the boss's remaining integrity */
  const run = G.run, cfg = run && run.cfg;
  if (cfg) {
    UI.dchip.textContent = 'District ' + cfg.n;
    const bossing = !!G.boss;
    UI.obj.classList.toggle('boss', bossing);
    if (bossing) {
      UI.objLbl.textContent = G.boss.def.name;
      UI.objVal.textContent = Math.max(0, Math.ceil(G.boss.hp / G.boss.maxHp * 100)) + '%';
      UI.objFill.style.width = clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100 + '%';
    } else {
      UI.objLbl.textContent = 'Quota';
      UI.objVal.textContent = fmt(Math.min(run.banked, run.quota)) + ' / ' + fmt(run.quota);
      UI.objFill.style.width = clamp(run.banked / run.quota, 0, 1) * 100 + '%';
    }
    const travelled = clamp((G.car.idx - run.startIdx) / cfg.len, 0, 1);
    UI.objDist.style.width = travelled * 100 + '%';
  }
}

/* the build rail — a roguelite is unreadable if you cannot see your own deck */
function renderBuild(){
  const run = G.run;
  if (!run) { UI.build.innerHTML = ''; return; }
  const counts = {};
  for (const id of run.chips) counts[id] = (counts[id] || 0) + 1;
  let html = '';
  for (const id in counts) {
    const c = NHChips.byId(id);
    html += '<i class="' + c.rarity + '">' + c.name +
            (counts[id] > 1 ? '<b>&times;' + counts[id] + '</b>' : '') + '</i>';
  }
  for (const id of run.curses) {
    const c = NHChips.curseById(id);
    html += '<i class="curse">' + c.name + '</i>';
  }
  UI.build.innerHTML = html;
}

/* The pads overlay the whole stage, so they must only exist while driving —
   otherwise they sit on top of the draft cards and swallow taps. */
function syncTouch(){
  touchEl.classList.toggle('on', hasTouch && G.state === 'play');
}

function show(el){ el.classList.remove('hide'); }
function hide(el){ el.classList.add('hide'); }

function toMenu(){
  G.state = 'menu';
  G.run = null;
  newWorld(true);
  show(UI.menu); hide(UI.over); hide(UI.garage);
  UI.hud.classList.add('off');
  $('menuBest').textContent = 'District ' + (Save.data.deepest || 1) +
    (Save.data.best ? '  ·  ' + fmt(Save.data.best) : '');
}

function startRun(){
  hide(UI.menu); hide(UI.over); hide(UI.garage); hide(UI.draft);
  G.run = newRun();
  G.score = 0; G.topMult = 1; G.coinsRun = 0; G.revived = false;
  shownScore = 0;
  nextDistrict();
}

/* ---- district lifecycle ---- */
function nextDistrict(){
  const run = G.run;
  run.district++;
  run.cfg = districtCfg(run.district);
  run.quota = run.cfg.quota;
  run.banked = 0;
  run.crumpleLeft = run.M.crumple;

  newWorld(false);
  run.startIdx = G.car.idx;
  G.car.topBonus = 0;
  G.heat = run.cfg.heatFloor + run.M.policeStart;
  G.tier = Math.min(3, Math.floor(G.heat));

  showBrief();
}

function showBrief(){
  const cfg = G.run.cfg;
  G.state = 'brief';
  UI.hud.classList.add('off');
  $('bkicker').textContent = cfg.boss ? 'Pursuit unit' : 'District ' + cfg.n;
  $('bname').textContent = cfg.name;
  $('bobj').innerHTML = cfg.boss
    ? cfg.bossDef.blurb + '<br><b>Bank into it until its integrity breaks.</b>'
    : 'Bank <b>' + fmt(cfg.quota) + '</b> before the checkpoint.';
  $('bsub').textContent = cfg.boss ? cfg.bossDef.sub : 'Heat floor ' + cfg.heatFloor;
  UI.brief.classList.toggle('bossBrief', !!cfg.boss);
  renderBuild();
  show(UI.brief);
  NHAudio.resume();
}

function beginDistrict(){
  hide(UI.brief);
  G.state = 'play';
  UI.hud.classList.remove('off');
  if (G.run.cfg.boss) addBoss();
}

function clearDistrict(){
  if (G.state !== 'play') return;
  G.run.cleared++;
  G.state = 'draft';
  G.pending = 0; G.chain = 0; G.mult = 1;
  UI.hud.classList.add('off');
  NHAudio.clear();
  G.flash = 0.5;
  showDraft();
}

function failDistrict(why){
  if (G.state !== 'play') return;
  G.state = 'crash';
  G.crashT = 0;
  G.crashReason = why;
  G.flash = 0.8; G.shake = 18;
  G.pending = 0; G.chain = 0; G.mult = 1;
  UI.hud.classList.add('off');
  NHAudio.curse();
}

/* ---- the draft ---- */
function showDraft(){
  const run = G.run;
  G.offers = NHChips.roll(run.chips, run.district, run.curses);
  const wrap = $('dcards');
  wrap.innerHTML = '';
  $('dsub').textContent = 'District ' + run.district + ' cleared — ' + fmt(run.banked) + ' banked';

  G.offers.forEach((offer, i) => {
    const c = offer.chip;
    const el = document.createElement('button');
    el.className = 'dcard ' + c.rarity + (offer.curse ? ' oc' : '');
    el.innerHTML =
      (offer.curse ? '<div class="octag">Overclocked</div>' : '') +
      '<div class="drar">' + c.rarity + ' &middot; ' + c.tag + '</div>' +
      '<div class="dname">' + c.name + '</div>' +
      '<div class="ddesc">' + c.desc + '</div>' +
      (offer.curse
        ? '<div class="dcurse"><span>' + offer.curse.name + '</span>' + offer.curse.desc + '</div>'
        : '');
    el.onclick = () => takeOffer(i);
    wrap.appendChild(el);
  });
  show(UI.draft);
}

function takeOffer(i){
  const offer = G.offers[i];
  if (!offer) return;
  const run = G.run;
  run.chips.push(offer.chip.id);
  if (offer.curse) { run.curses.push(offer.curse.id); NHAudio.curse(); }
  else NHAudio.chip();
  run.M = NHChips.build(run.chips, run.curses);
  hide(UI.draft);
  nextDistrict();
}

function endRun(){
  G.state = 'over';
  const isBest = G.score > Save.data.best;
  if (isBest) Save.data.best = G.score;
  const reached = G.run ? G.run.district : 1;
  if (reached > (Save.data.deepest || 0)) Save.data.deepest = reached;
  /* clearing districts is the achievement, so it pays on top of raw score */
  G.coinsRun = Math.floor((G.score / 80 + (G.run ? G.run.cleared * 90 : 0)) * G.spec.payout);
  Save.data.runs++;
  Save.flush();

  const kick = G.crashReason === 'traffic' ? 'Wrecked'
             : G.crashReason === 'wall' ? 'Wall'
             : G.crashReason || 'Busted';
  $('ovKicker').textContent = kick;
  $('ovRank').textContent = G.run
    ? 'Reached district ' + G.run.district + ' — ' + G.run.cleared + ' cleared'
    : '';
  $('ovScore').textContent = fmt(G.score);
  $('ovBest').textContent = fmt(Save.data.best);
  $('ovCombo').innerHTML = '&times;' + G.topMult.toFixed(1);
  $('ovCoins').textContent = fmt(G.coinsRun);
  $('ovBadge').classList.toggle('hide', !isBest);
  /* one revive per run, and only when the run was worth saving */
  $('btnRevive').disabled = G.revived || G.score < 400;
  $('btnDouble').disabled = false;

  const showOver = () => { show(UI.over); };
  if (Save.data.runs % 3 === 0) Ads.midroll(showOver); else showOver();
}

function commitCoins(mult){
  Save.data.coins += Math.floor(G.coinsRun * mult);
  G.coinsRun = 0;
  Save.flush();
}

/* ---- buttons ---- */
function setMute(m){ $('btnMute').textContent = m ? 'Sound off' : 'Sound on'; }
$('btnMute').onclick   = e => { e.stopPropagation(); setMute(NHAudio.toggleMute()); };
$('btnGo').onclick     = () => beginDistrict();
$('btnPlay').onclick   = () => { NHAudio.resume(); startRun(); };
$('btnAgain').onclick  = () => { commitCoins(1); startRun(); };
$('btnMenu').onclick   = () => { commitCoins(1); toMenu(); };
$('btnGarage').onclick = () => { hide(UI.menu); show(UI.garage); renderGarage(); };
$('btnBack').onclick   = () => { hide(UI.garage); show(UI.menu); };
$('btnRace').onclick   = () => startRun();

$('btnRevive').onclick = () => {
  Ads.rewarded('Reviving your run', ok => {
    if (!ok) return;
    hide(UI.over);
    G.revived = true;
    G.state = 'play';
    G.run.crumpleLeft = Math.max(G.run.crumpleLeft, G.run.M.crumple);
    UI.hud.classList.remove('off');
    /* drop back on the centreline a little ahead, briefly untouchable */
    const pos = G.track.at(G.car.idx + 4, 0);
    G.car.x = pos.x; G.car.y = pos.y; G.car.a = pos.a;
    G.car.vx = Math.cos(pos.a) * 380; G.car.vy = Math.sin(pos.a) * 380;
    G.car.inv = 2.4; G.car.hitFlash = 0;
    G.police.length = 0;
    G.heat = Math.max(0, G.heat - 1);
    G.slow = 1;
    toast('Back in the race', 'gold');
  });
};

$('btnDouble').onclick = () => {
  Ads.rewarded('Doubling your coins', ok => {
    if (!ok) return;
    commitCoins(2);
    $('btnDouble').disabled = true;
    $('ovCoins').textContent = '0';
    toast('Coins doubled', 'gold');
    renderGarage();
  });
};

/* ---- garage ---- */
function drawPreview(cvs, spec){
  const g = cvs.getContext('2d');
  const w = cvs.width, h = cvs.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  const grd = g.createRadialGradient(w/2, h/2, 2, w/2, h/2, w * 0.5);
  grd.addColorStop(0, hexA(spec.col, 0.16));
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);

  const sc = Math.min(w / (spec.len * 1.3), h / (spec.wid * 1.7));
  g.translate(w / 2, h / 2);
  g.scale(sc, sc);
  /* drawVehicle targets the module-level ctx, so previews get their own pass */
  previewCar(g, { spec });
}
function previewCar(g, v){
  const s = v.spec;
  g.save();
  const bg = g.createLinearGradient(0, -s.wid * 0.6, 0, s.wid * 0.6);
  bg.addColorStop(0, s.col2);
  bg.addColorStop(0.45, mix(s.col, s.col2, 0.55));
  bg.addColorStop(1, s.col2);
  g.fillStyle = '#12161F';
  const wr = s.len * 0.13, ww = s.wid * 0.14;
  for (const [fx, fy] of [[0.30,0.54],[0.30,-0.54],[-0.30,0.54],[-0.30,-0.54]])
    g.fillRect(s.len * fx - wr, s.wid * fy - ww, wr * 2, ww * 2);
  carPath(g, s);
  g.fillStyle = bg; g.fill();
  g.strokeStyle = hexA(s.col, 0.95); g.lineWidth = 1.6; g.stroke();
  g.beginPath();
  g.moveTo(s.len * 0.14, -s.wid * 0.30);
  g.lineTo(-s.len * 0.06, -s.wid * 0.36);
  g.lineTo(-s.len * 0.24, -s.wid * 0.26);
  g.lineTo(-s.len * 0.24, s.wid * 0.26);
  g.lineTo(-s.len * 0.06, s.wid * 0.36);
  g.lineTo(s.len * 0.14, s.wid * 0.30);
  g.closePath();
  const cg = g.createLinearGradient(s.len * 0.2, 0, -s.len * 0.3, 0);
  cg.addColorStop(0, 'rgba(200,235,255,0.32)');
  cg.addColorStop(1, 'rgba(10,16,32,0.85)');
  g.fillStyle = cg; g.fill();
  g.fillStyle = hexA(s.col, 0.25);
  g.fillRect(-s.len * 0.5, -s.wid * 0.055, s.len, s.wid * 0.11);
  g.restore();
}

function renderGarage(){
  $('gCoins').textContent = fmt(Save.data.coins);

  const wrap = $('gCars');
  wrap.innerHTML = '';
  for (const c of CARS) {
    const owned = Save.data.owned.includes(c.id);
    const sel = Save.data.car === c.id;
    const broke = !owned && Save.data.coins < c.price;
    const el = document.createElement('div');
    el.className = 'car' + (sel ? ' sel' : '') + (owned ? '' : ' locked') + (broke ? ' broke' : '');
    el.innerHTML =
      '<canvas width="220" height="120"></canvas>' +
      '<div class="nm">' + c.name + '</div>' +
      '<div class="pr' + (owned ? ' owned' : '') + '">' + (owned ? (sel ? 'Equipped' : 'Owned') : fmt(c.price)) + '</div>' +
      '<div class="st">' + STAT_LABELS.map((lab, k) =>
        '<div class="row"><span>' + lab + '</span><b>' +
        Array.from({ length:5 }, (_, i) => '<i class="' + (i < c.stats[k] ? 'on' : '') + '"></i>').join('') +
        '</b></div>').join('') + '</div>';
    el.onclick = () => {
      if (owned) { Save.data.car = c.id; }
      else if (Save.data.coins >= c.price) {
        Save.data.coins -= c.price;
        Save.data.owned.push(c.id);
        Save.data.car = c.id;
        toast(c.name + ' unlocked', 'gold');
      } else {
        toast('Not enough coins', 'red');
        return;
      }
      Save.flush();
      G.spec = activeSpec();
      renderGarage();
    };
    wrap.appendChild(el);
    drawPreview(el.querySelector('canvas'), c);
  }

  const ups = $('gUps');
  ups.innerHTML = '';
  for (const u of UPGRADES) {
    const lvl = Save.data.up[u.id];
    const maxed = lvl >= UP_MAX;
    const cost = upCost(u, lvl);
    const afford = Save.data.coins >= cost;
    const el = document.createElement('div');
    el.className = 'up';
    el.innerHTML =
      '<div class="info"><div class="nm">' + u.name + '</div>' +
      '<div class="pips">' + Array.from({ length:UP_MAX }, (_, i) =>
        '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join('') + '</div></div>' +
      '<button ' + (maxed || !afford ? 'disabled' : '') + '>' + (maxed ? 'Max' : fmt(cost)) + '</button>';
    el.querySelector('button').onclick = () => {
      if (maxed || Save.data.coins < cost) return;
      Save.data.coins -= cost;
      Save.data.up[u.id]++;
      Save.flush();
      G.spec = activeSpec();
      renderGarage();
    };
    ups.appendChild(el);
  }
}

/* ============================================================
   LOOP
   ============================================================ */
let last = performance.now();
let ftAvg = 16, ftN = 0, demoted = false;
function frame(now){
  const raw = Math.min(0.033, (now - last) / 1000);
  const ms = now - last;
  last = now;

  /* one-way demotion: sustained slow frames drop the expensive passes */
  if (!demoted) {
    ftAvg = ftAvg * 0.94 + Math.min(ms, 120) * 0.06;
    if (++ftN > 140 && ftAvg > 30) { setQuality('low'); demoted = true; }
  }

  adTick(raw);
  if (!adCb) step(raw * G.slow);

  NHAudio.frame({
    playing: G.state === 'play',
    speed: G.car ? G.car.speed : 0,
    boost: G.car ? G.car.boost : 0,
    drift: G.car ? G.car.drift : 0,
    cops: G.police.length + (G.boss ? 2 : 0),
    /* arrangement follows how deep and how hot the run is */
    intensity: G.state === 'menu' ? 0
      : Math.min(3, (G.run ? Math.floor((G.run.district - 1) / 2) : 0) + G.tier + (G.boss ? 1 : 0))
  });

  syncHUD();
  syncTouch();
  render();
  requestAnimationFrame(frame);
}

resize();
newWorld(true);
hide(UI.brief); hide(UI.draft);
toMenu();
requestAnimationFrame(frame);

/* debug handle for tuning passes and automated playtests */
window.__NH = {
  G, cam, CARS, Save, QF, setQuality, startRun, toMenu,
  beginDistrict, takeOffer, districtCfg, nextDistrict, showDraft, bank,
  get offers(){ return G.offers; }
};

/* signal readiness to the CrazyGames loader when hosted */
if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
  try { window.CrazyGames.SDK.game.loadingStop(); } catch (e) {}
}
})();
