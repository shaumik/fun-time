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
  data:{ best:0, coins:0, car:'viper', up:{ grip:0, nitro:0, armor:0, payout:0 }, owned:['viper'], runs:0 },
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
    col:'#3DE8FF', col2:'#0A5A72', power:660, grip:7.4, top:770, armor:0, stats:[3,3,3] },
  { id:'katana',  name:'Katana',  price:6500,  len:44, wid:21, nose:.48, tail:.60,
    col:'#FF2E88', col2:'#6E0F3C', power:685, grip:9.0, top:780, armor:0, stats:[4,5,2] },
  { id:'brute',   name:'Brute',   price:22000, len:53, wid:27, nose:.82, tail:.92,
    col:'#FFB13D', col2:'#6B3F08', power:625, grip:6.2, top:735, armor:1, stats:[2,2,5] },
  { id:'phantom', name:'Phantom', price:60000, len:48, wid:22, nose:.44, tail:.54,
    col:'#DCF6FF', col2:'#28536F', power:735, grip:8.2, top:870, armor:0, stats:[5,4,2] }
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
    crashV: 300 + u.armor * 34 + c.armor * 90,
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
  stage.style.setProperty('--u', (H / 100) + 'px');
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
const touch = { left:0, right:0, drift:0 };
const IN = { steer:0, drift:0, nitro:0 };

addEventListener('keydown', e => {
  keys[e.code] = 1;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter') {
    if (G.state === 'menu') startRun();
    else if (G.state === 'over') startRun();
  }
  if (e.code === 'Escape' && G.state === 'play') toMenu();
});
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });

const touchEl = document.getElementById('touch');
if (matchMedia('(hover:none)').matches) touchEl.classList.add('on');
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
  IN.nitro = (keys.ShiftLeft || keys.ShiftRight || keys.KeyW || keys.ArrowUp) ? 1 : 0;
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
    this.hw = 155; this.tHw = 155;
    this.x = 0; this.y = 0; this.n = 0;
    for (let i = 0; i < 260; i++) this.extend();
  }
  extend(){
    if (this.n % 24 === 0) {
      this.tCurv = Math.random() < 0.22 ? 0 : rnd(-0.062, 0.062);
    }
    if (this.n % 46 === 0) this.tHw = rnd(155, 235);
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
    this.inv = 0;
  }
  get speed(){ return hyp(this.vx, this.vy); }

  drive(dt, steerIn, throttle, driftIn, boostIn){
    const s = this.spec;
    this.steer = damp(this.steer, steerIn, 13, dt);

    /* Turn authority falls off with speed, and drifting buys it back.
       That asymmetry is the design: fast corners *require* the slide. */
    const sp = this.speed;
    const rate = (2.0 + (driftIn ? 1.5 : 0))
               * clamp(sp / 190, 0, 1)
               * lerp(1, 0.62, clamp(sp / 900, 0, 1));
    this.a += this.steer * rate * dt;

    const cs = Math.cos(this.a), sn = Math.sin(this.a);

    /* body frame: longitudinal + lateral velocity */
    let lon =  cs * this.vx + sn * this.vy;
    let lat = -sn * this.vx + cs * this.vy;

    let acc = throttle * s.power;
    if (boostIn && this.nitro > 0.02) { acc *= 1.75; this.boost = 1; this.nitro -= dt * 0.45; }
    else { this.boost = 0; this.nitro = Math.min(s.nitroMax || 1, this.nitro + dt * 0.055); }

    const top = s.top * (this.boost ? 1.22 : 1);
    lon += acc * dt;
    if (lon > top) lon = damp(lon, top, 3, dt);
    lon *= Math.exp(-(0.42 + this.offroad * 2.4) * dt);

    /* grip is what the whole game is built on: releasing it is the verb */
    const grip = (driftIn ? 1.45 : s.grip) * (1 - this.offroad * 0.45);
    lat *= Math.exp(-grip * dt);

    this.vx = cs * lon - sn * lat;
    this.vy = sn * lon + cs * lat;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.slip = Math.abs(Math.atan2(lat, Math.max(60, Math.abs(lon))));
    this.drift = damp(this.drift, (this.slip > 0.20 && sp > 240) ? 1 : 0, 12, dt);

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
  state:'menu',      // menu | play | crash | over | garage
  ai:true,
  track:null, car:null, spec:null,
  traffic:[], police:[],
  score:0, pending:0, chain:0, mult:1, sinceDrift:9,
  heat:0, tier:0, best:Save.data.best,
  coinsRun:0, topMult:1,
  crashT:0, slow:1, flash:0, revived:false,
  shake:0, dist:0
};

const cam = { x:0, y:0, rot:-Math.PI/2, zoom:1, sx:0, sy:0 };

function newWorld(ai){
  G.track = new Track();
  G.spec = activeSpec();
  G.traffic = []; G.police = [];
  P.length = 0; SKID.length = 0;
  G.car = new Vehicle(G.spec, 'player');
  const st = G.track.at(6, 0);
  G.car.x = st.x; G.car.y = st.y; G.car.a = st.a;
  G.car.vx = Math.cos(st.a) * 300; G.car.vy = Math.sin(st.a) * 300;
  G.car.idx = 6; G.car.nitro = G.spec.nitroMax;
  G.score = 0; G.pending = 0; G.chain = 0; G.mult = 1; G.sinceDrift = 9;
  G.heat = 0; G.tier = 0; G.coinsRun = 0; G.topMult = 1;
  G.slow = 1; G.flash = 0; G.shake = 0; G.revived = false; G.dist = 0;
  G.ai = !!ai;
  cam.x = G.car.x; cam.y = G.car.y; cam.rot = G.car.a; cam.zoom = baseZoom();
  for (let i = 0; i < 9; i++) addTraffic(20 + i * 22);
}
const baseZoom = () => clamp(H / 420, 1.0, 2.3);

function addTraffic(ahead){
  const idx = G.car.idx + ahead;
  G.track.ensure(idx + 10);
  const p = G.track.pts[idx];
  const lat = rnd(-1, 1) * p.w * 0.60;
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

function addPolice(){
  const idx = Math.max(0, G.car.idx - 8);
  const pos = G.track.at(idx, rnd(-80, 80));
  const spec = Object.assign({}, CARS[2], {
    col:'#14203C', col2:'#080D1A', power:700, grip:7.0, top:820, nitroMax:1
  });
  const v = new Vehicle(spec, 'police');
  v.x = pos.x; v.y = pos.y; v.a = pos.a; v.idx = idx;
  v.vx = Math.cos(pos.a) * 420; v.vy = Math.sin(pos.a) * 420;
  G.police.push(v);
  toast('Heat rising — units inbound', 'red');
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
  const wantDrift = aggressive && Math.abs(st) > 0.30 && v.speed > 320;
  v.driftHeld = wantDrift ? 1 : 0;
  v.offroad = Math.abs(loc.lat) > loc.p.w ? 1 : 0;
  v.drive(dt, st, 1, wantDrift ? 1 : 0, aggressive && Math.abs(st) < 0.2 ? 1 : 0);
  barrier(v, loc);
}

/* -------- barrier response -------- */
function barrier(v, loc){
  const lim = loc.p.w - v.spec.wid * 0.5;
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
  const gained = Math.floor(G.pending * (1 + G.tier * 0.35));
  G.score += gained;
  G.heat = Math.min(3.0, G.heat + gained / 14000);
  toast('Banked +' + fmt(gained), 'gold');
  G.pending = 0; G.chain = 0; G.mult = 1;
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
    car.offroad = Math.abs(loc.lat) > loc.p.w ? 1 : 0;

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
        if (into > G.spec.crashV) { crash('wall'); return; }
        G.chain = Math.max(0, G.chain - dt * 2.5);
      }
    }
    G.dist += car.speed * dt;

    /* ---- drift scoring ----
       Points accrue only while the drift input is held, and pay out when it
       is released. Tying the payout to the button — not to the physics
       settling — is what makes the bet legible: you choose when to cash in. */
    const held = G.ai ? car.driftHeld : IN.drift;
    const scoring = held && car.drift > 0.5 && car.speed > 250 && !car.offroad;
    if (scoring) {
      G.sinceDrift = 0;
      G.chain += dt;
      G.mult = Math.min(9.9, 1 + G.chain * 0.42);
      G.topMult = Math.max(G.topMult, G.mult);
      G.pending += car.speed * 0.30 * G.mult * dt;
    } else {
      G.sinceDrift += dt;
      if (G.sinceDrift > 0.42 && G.pending > 0) bank();
    }
    G.heat = Math.max(0, G.heat - dt * 0.038);
    G.tier = Math.floor(G.heat);
  }

  /* ---- traffic ---- */
  for (let i = G.traffic.length - 1; i >= 0; i--) {
    const t = G.traffic[i];
    autoDrive(t, dt, false);
    if (t.idx < car.idx - 24 || t.idx > car.idx + 120) { G.traffic.splice(i, 1); continue; }

    const dx = t.x - car.x, dy = t.y - car.y, d = hyp(dx, dy);
    const touchR = (t.spec.len + car.spec.len) * 0.36;
    if (playing && !G.ai) {
      if (d < touchR) {
        const rel = hyp(t.vx - car.vx, t.vy - car.vy);
        if (rel > 210) { crash('traffic'); return; }
        const nx = dx / (d || 1), ny = dy / (d || 1);
        car.vx -= nx * 130; car.vy -= ny * 130;
        t.vx += nx * 130; t.vy += ny * 130;
        G.shake = Math.max(G.shake, 11);
        car.hitFlash = 1;
        G.chain = Math.max(0, G.chain - 0.9);
      } else if (d < 92 && !t.nearFlag && car.speed > 300) {
        t.nearFlag = true;
        if (G.chain > 0.25) {
          G.pending += 220 * G.mult;
          G.chain += 0.32;
          toast('Near miss +' + fmt(220 * G.mult), 'pink');
        }
      }
      if (d > 140) t.nearFlag = false;
    }
  }
  while (G.traffic.length < 10) addTraffic(rint(46, 118));

  /* ---- police ---- */
  if (playing && !G.ai) {
    while (G.police.length < G.tier) addPolice();
    while (G.police.length > G.tier) G.police.pop();
  }
  for (let i = G.police.length - 1; i >= 0; i--) {
    const p = G.police[i];
    const loc = T.locate(p.x, p.y, p.idx);
    p.idx = loc.i;
    p.offroad = Math.abs(loc.lat) > loc.p.w ? 1 : 0;
    /* aim slightly ahead of the player so they cut the corner */
    const st = steerToward(p, car.x + car.vx * 0.35, car.y + car.vy * 0.35);
    p.drive(dt, st, 1, Math.abs(st) > 0.6 && p.speed > 400 ? 1 : 0, 1);
    barrier(p, loc);

    if (playing && !G.ai) {
      const dx = p.x - car.x, dy = p.y - car.y, d = hyp(dx, dy);
      if (d < (p.spec.len + car.spec.len) * 0.36) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        car.vx -= nx * 240; car.vy -= ny * 240;
        p.vx += nx * 120; p.vy += ny * 120;
        G.shake = Math.max(G.shake, 18);
        car.hitFlash = 1;
        G.chain = Math.max(0, G.chain - 1.6);
        G.heat = Math.max(0, G.heat - 0.25);
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
    H * 0.62 + cam.sy + (dx * st + dy * ct) * cam.zoom
  ];
}
function applyCam(){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.translate(W / 2 + cam.sx, H * 0.62 + cam.sy);
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
    const nx = -Math.sin(p.a) * p.w, ny = Math.cos(p.a) * p.w;
    if (i === a) ctx.moveTo(p.x + nx, p.y + ny); else ctx.lineTo(p.x + nx, p.y + ny);
  }
  for (let i = b; i >= a; i--) {
    const p = pts[i];
    const nx = -Math.sin(p.a) * p.w, ny = Math.cos(p.a) * p.w;
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
      const nx = -Math.sin(p.a) * p.w * side, ny = Math.cos(p.a) * p.w * side;
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
      const nx = -Math.sin(p.a) * p.w * f, ny = Math.cos(p.a) * p.w * f;
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
      const nx = -Math.sin(p.a) * p.w * side, ny = Math.cos(p.a) * p.w * side;
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
  if (v.kind === 'police') {
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
  const cx = W / 2 + cam.sx, cy = H * 0.62 + cam.sy;

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
  const fog = ctx.createLinearGradient(0, 0, 0, H * 0.52);
  fog.addColorStop(0,    'rgba(5,6,14,0.72)');
  fog.addColorStop(0.45, 'rgba(5,6,14,0.30)');
  fog.addColorStop(1,    'rgba(5,6,14,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, H * 0.52);
}

function drawLamps(){
  const [a, b] = visibleRange();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = a; i <= b; i++) {
    const p = G.track.pts[i];
    if (!p.lamp) continue;
    for (const side of [-1, 1]) {
      const x = p.x - Math.sin(p.a) * (p.w + 16) * side;
      const y = p.y + Math.cos(p.a) * (p.w + 16) * side;
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
  for (const t of G.traffic) drawVehicle(t, { lights:false });
  for (const p of G.police) drawVehicle(p);
  drawVehicle(G.car);
  drawParticles();

  if (QF.city) drawCity();
  bloom();
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
  menu:$('menu'), over:$('over'), garage:$('garage')
};
const heatPips = UI.heat.querySelectorAll('i');

let shownScore = 0;
function syncHUD(){
  shownScore = lerp(shownScore, G.score, 0.2);
  UI.score.textContent = fmt(shownScore);
  UI.coins.textContent = fmt(Save.data.coins + G.coinsRun);
  UI.spd.textContent = Math.round(G.car.speed * 0.42);
  UI.nfill.style.width = clamp(G.car.nitro / (G.spec.nitroMax || 1), 0, 1) * 100 + '%';

  const active = G.pending > 0 || G.chain > 0.05;
  UI.combo.classList.toggle('on', active);
  UI.combo.classList.toggle('hot', G.mult > 5);
  UI.cmult.innerHTML = '&times;' + G.mult.toFixed(1);
  UI.cpts.textContent = fmt(G.pending);
  UI.cfill.style.width = clamp(G.mult / 9.9, 0, 1) * 100 + '%';

  UI.heat.classList.toggle('on', G.heat > 0.05);
  UI.heat.classList.toggle('max', G.tier >= 3);
  heatPips.forEach((el, i) => el.classList.toggle('lit', i < G.tier));
}

function show(el){ el.classList.remove('hide'); }
function hide(el){ el.classList.add('hide'); }

function toMenu(){
  G.state = 'menu';
  newWorld(true);
  show(UI.menu); hide(UI.over); hide(UI.garage);
  UI.hud.classList.add('off');
  $('menuBest').textContent = fmt(Save.data.best);
}

function startRun(){
  hide(UI.menu); hide(UI.over); hide(UI.garage);
  newWorld(false);
  G.state = 'play';
  UI.hud.classList.remove('off');
  shownScore = 0;
}

function endRun(){
  G.state = 'over';
  const isBest = G.score > Save.data.best;
  if (isBest) Save.data.best = G.score;
  G.coinsRun = Math.floor(G.score / 80 * G.spec.payout);
  Save.data.runs++;
  Save.flush();

  $('ovKicker').textContent = G.crashReason === 'traffic' ? 'Wrecked' : 'Wall';
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
$('btnPlay').onclick   = () => startRun();
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
  syncHUD();
  render();
  requestAnimationFrame(frame);
}

resize();
newWorld(true);
toMenu();
requestAnimationFrame(frame);

/* debug handle for tuning passes and automated playtests */
window.__NH = { G, cam, CARS, Save, QF, setQuality, startRun, toMenu };

/* signal readiness to the CrazyGames loader when hosted */
if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
  try { window.CrazyGames.SDK.game.loadingStop(); } catch (e) {}
}
})();
