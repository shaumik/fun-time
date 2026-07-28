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
  data:{ best:0, deepest:0, ctrl:'swipe', coins:0, car:'viper',
         up:{ engine:0, grip:0, armor:0, impact:0, nitro:0, payout:0 }, gear:[], runs:0,
         engineSfx:1, lastDaily:'', dailyStreak:0, board:[] },
  load(){
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) Object.assign(this.data, JSON.parse(raw));
      if (!Array.isArray(this.data.gear)) this.data.gear = [];   // saves predating hardware
      /* saves predating the single-car change carry only four tracks */
      for (const k of ['engine','grip','armor','impact','nitro','payout'])
        if (typeof this.data.up[k] !== 'number') this.data.up[k] = 0;
      if (typeof this.data.lastDaily !== 'string') this.data.lastDaily = '';
      if (typeof this.data.dailyStreak !== 'number') this.data.dailyStreak = 0;
      if (!Array.isArray(this.data.board)) this.data.board = [];
    } catch (e) { /* storage blocked — run in-memory */ }
  },
  flush(){
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
  }
};
Save.load();


/* ============================================================
   HANGAR — permanent hardware
   The chips you draft inside a run are wiped when the run ends. This is the
   other half of the roguelite contract: a run that went badly still pays for
   something you keep, so the next attempt starts from further along. Bought
   once, always fitted, and each one changes a verb rather than a number.
   ============================================================ */
const GEAR = [
  { id:'prow',       name:'Ram Prow',      price:2400,
    desc:'Wrecks pay +25% and cost a fifth less hull.' },
  { id:'welder',     name:'Scrap Welder',  price:4200,
    desc:'Hull repairs itself whenever no chain is running.' },
  { id:'turbine',    name:'Turbine Intake', price:7000,
    desc:'Grabbing a Boost adds two links to a live chain.' },
  { id:'missile',    name:'Harpoon Rack',  price:12000,
    desc:'Auto-fires every 9s: detonates the nearest car ahead, free.' },
  { id:'shockplate', name:'Shock Plating', price:20000,
    desc:'Every fifth link in a chain detonates everything around you.' },
  { id:'blackbox',   name:'Black Box',     price:32000,
    desc:'Start every district with a Ram Plate already fitted.' }
];
const Hangar = {
  has: id => Save.data.gear.includes(id),
  /* A first run in a bare car on an empty board is the weakest possible
     first impression, and it is the one every new player gets. The Ram Prow
     is free: it costs the economy almost nothing and it means the opening
     minute shows the game doing the thing the game is about. */
  grantStarter(){
    if (Save.data.gear.length || Save.data.runs > 0) return false;
    Save.data.gear.push('prow');
    Save.flush();
    return true;
  },
  buy(id){
    const g = GEAR.find(x => x.id === id);
    if (!g || this.has(id) || Save.data.coins < g.price) return false;
    Save.data.coins -= g.price;
    Save.data.gear.push(id);
    Save.flush();
    return true;
  }
};

/* ============================================================
   CRAZYGAMES SDK
   The SDK is present only when the game is served from their portal.
   Everywhere else — local files, the shareable build — every call
   degrades to a simulated placement so the flow stays demonstrable.
   ============================================================ */
const Ads = {
  sdk: null,
  ready: false,
  /* The user module *is* client-side, unlike the leaderboard API. If the
     player is signed in on the portal we can put their name on their own
     board; everywhere else it stays anonymous and nothing breaks. */
  playerName: '',
  async readUser(){
    try {
      const u = this.sdk && this.sdk.user && await this.sdk.user.getUser();
      if (u && u.username) this.playerName = u.username;
    } catch (e) { /* not signed in, or no user module — anonymous is fine */ }
  },
  playing: false,      // mirrors gameplayStart/Stop so we never double-fire

  async boot(){
    const SDK = window.CrazyGames && window.CrazyGames.SDK;
    if (!SDK) return;                       // not hosted on CrazyGames
    try {
      /* v3 is promise-based and unusable until init resolves */
      await SDK.init();
      this.sdk = SDK;
      this.ready = true;
      /* the whole game is inline, so loading begins and ends immediately */
      this.call(() => SDK.game.loadingStart());
      this.call(() => SDK.game.loadingStop());
      this.bindSettings(SDK);
      this.readUser();
    } catch (e) {
      this.sdk = null; this.ready = false;
    }
  },

  /* every SDK call is best-effort: a throw here must never break the game */
  call(fn){ if (!this.ready) return; try { fn(); } catch (e) {} },

  /* Portal audio settings. The exact accessor has moved between SDK
     versions, so read defensively rather than pinning one path, and apply
     whatever the change listener hands back. */
  bindSettings(SDK){
    const read = s => {
      const src = s || (SDK.game && SDK.game.settings) || SDK.settings || {};
      return !!src.muteAudio;
    };
    const apply = s => { NHAudio.setSiteMute(read(s)); setMute(); };
    try { apply(); } catch (e) {}
    const host = (SDK.game && SDK.game.addSettingsChangeListener) ? SDK.game : SDK;
    try {
      if (host && host.addSettingsChangeListener) host.addSettingsChangeListener(apply);
    } catch (e) {}
  },

  /* Their QA checks that gameplay is bracketed — it gates ad eligibility
     and stops the portal counting menu time as play. */
  gameplay(on){
    if (!this.ready || this.playing === on) return;
    this.playing = on;
    this.call(() => on ? this.sdk.game.gameplayStart() : this.sdk.game.gameplayStop());
  },

  /* used sparingly, per their guidance: a boss down or a new personal best */
  celebrate(){ this.call(() => this.sdk.game.happytime()); },

  request(type, msg, simSecs, done){
    if (!this.ready) { simAd(msg, simSecs, () => done(true)); return; }

    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      adPause(false);
      done(ok);
    };
    /* Pause and mute before the request, not on adStarted: an ad that opens
       instantly would otherwise get a frame or two of game audio over it. */
    adPause(true);
    /* if the network stalls and neither callback ever fires, do not
       leave the player staring at a frozen game */
    const guard = setTimeout(() => finish(false), 25000);

    try {
      this.sdk.ad.requestAd(type, {
        adStarted:  () => adPause(true),
        adFinished: () => finish(true),
        adError:    () => finish(false)
      });
    } catch (e) { finish(false); }
  },

  rewarded(msg, done){ this.request('rewarded', msg, 3.2, done); },
  midroll(done){ this.request('midgame', 'Back in a moment', 2.4, () => done()); }
};

/* ---------------- pause ----------------
   Several things can suspend play — an ad, a backgrounded tab, a blurred
   iframe. Track them by reason so the last one to clear resumes the game. */
const pauseReasons = new Set();
function setPause(reason, on){
  const before = pauseReasons.size;
  if (on) pauseReasons.add(reason); else pauseReasons.delete(reason);
  const now = pauseReasons.size;
  if ((before > 0) === (now > 0)) return;
  const paused = now > 0;
  G.paused = paused;
  NHAudio.duck(paused);
  if (paused) Ads.gameplay(false);
  for (const k in keys) keys[k] = 0;   // never resume with a key stuck down
}
const adPause = on => setPause('ad', on);

/* A hidden tab still fires rAF in some browsers and keeps the audio graph
   running in others; stop both rather than trusting either. */
function setVisible(on){
  setPause('hidden', !on);
  NHAudio.setActive(on);
}
addEventListener('visibilitychange', () => setVisible(!document.hidden));
addEventListener('blur',  () => setPause('blur', true));
addEventListener('focus', () => setPause('blur', false));

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


/* ============================================================
   DISTRICTS OF THE CITY
   Every act drove through the same cyan-and-magenta downtown, so a run that
   was numerically escalating looked identical the whole way up — which is
   what makes a roguelite feel like one level repeated. Each act now has its
   own ground, asphalt, barrier colours, skyline and air. The generator is
   unchanged; only what it is dressed in moves.
   ============================================================ */
const THEMES = [
  { id:'downtown', name:'The Grid',
    ground:'#06080F', asphalt:'#131A2C', left:'#3DE8FF', right:'#FF2E88',
    bldA:'#3DE8FF', bldB:'#FF2E88', face1:'#141A2D', face2:'#0F1424',
    h:[110, 480], size:[48, 118], gap:0.34, lit:0.80, back:[80, 400],
    air:null },
  { id:'docks', name:'Sunken Docks',
    ground:'#080A0B', asphalt:'#1B1A18', left:'#FFB13D', right:'#2FE08A',
    bldA:'#FFB13D', bldB:'#6FE3C0', face1:'#1E1C18', face2:'#141310',
    /* long low sheds instead of towers, and more sky between them */
    h:[90, 280], size:[110, 240], gap:0.46, lit:0.45, back:[110, 520],
    air:{ rgb:'150,170,180', rate:0.14, size:[16, 38], life:[1.8, 3.2], drift:26 } },
  { id:'undercity', name:'The Undercity',
    ground:'#04030A', asphalt:'#141026', left:'#B07CFF', right:'#F2F6FF',
    bldA:'#B07CFF', bldB:'#7FA6FF', face1:'#171233', face2:'#0D0A1E',
    /* close, tall and constant — it should read as a tunnel, not a skyline */
    h:[420, 900], size:[70, 150], gap:0.10, lit:0.92, back:[46, 190],
    air:{ rgb:'190,160,255', rate:0.7, size:[2, 5], life:[0.5, 1.1], drift:-190 } }
];
let TH = THEMES[0];
function setTheme(act){ TH = THEMES[(Math.max(1, act) - 1) % THEMES.length]; }

/* ---------------- cars ----------------
   One player car. Four selectable chassis were four stat rolls that said the
   same thing the tuning tracks already say, so the choice was between numbers
   rather than between ways to play — and it made the tuning tracks weaker to
   compensate. The silhouettes stay: they are the traffic and pursuit pool. */
const PLAYER = {
  id:'viper', name:'Viper', len:46, wid:23, nose:.60, tail:.78,
  col:'#3DE8FF', col2:'#0A5A72', power:560, grip:7.4, top:620, armor:0
};
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
/* Six tracks rather than four: engine and impact carry what the chassis
   choice used to, so removing it costs the player nothing. `read` states the
   fitted value, because a row of pips is not a spec. */
const UPGRADES = [
  { id:'engine', name:'Engine', base:1000, desc:'Top speed',
    read: l => Math.round(PLAYER.top * (1 + l * 0.05) * 0.52) + ' km/h' },
  { id:'grip',   name:'Grip',   base:900,  desc:'Slide control',
    read: l => (PLAYER.grip + l * 0.42).toFixed(1) + ' g' },
  { id:'armor',  name:'Hull',   base:1400, desc:'Hull capacity',
    read: l => (100 + l * 16) + ' hp' },
  { id:'impact', name:'Impact', base:1600, desc:'Wreck payout',
    read: l => '+' + Math.round(l * 10) + '%' },
  { id:'nitro',  name:'Boost',  base:1100, desc:'Power-up duration',
    read: l => '\u00d7' + (1 + l * 0.24).toFixed(2) },
  { id:'payout', name:'Salvage', base:1800, desc:'Coins per run',
    read: l => '\u00d7' + (1 + l * 0.14).toFixed(2) }
];
const UP_MAX = 5;
const upCost = (u, lvl) => Math.round(u.base * Math.pow(1.85, lvl));

/* the spec the physics actually reads: car + upgrades folded together */
function activeSpec(){
  const u = Save.data.up;
  return Object.assign({}, PLAYER, {
    grip:     PLAYER.grip + u.grip * 0.42,
    top:      PLAYER.top * (1 + u.engine * 0.05),
    boostMul: 1 + u.nitro * 0.24,
    wreckMul: 1 + u.impact * 0.10,
    crashV:   430,
    hull:     u.armor * 16,
    payout:   1 + u.payout * 0.14
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
  if (typeof applyBackingStore === 'function') applyBackingStore();
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

/* ---------------- resolution ----------------
   This renderer is fill-rate bound: the bloom composite costs in direct
   proportion to backing-store pixels, so framerate tracks window area
   almost exactly. A maximised 1440p window is ~4x the pixels of a 720p
   one. Rather than pick a fixed cap that is wrong on most machines, the
   backing store is scaled adaptively to hold the frame budget, and CSS
   scales the result back up to fill the stage. */
const MAX_PIXELS = 2.6e6;      // hard ceiling regardless of how fast the GPU is
let renderScale = 1;           // adaptive, 0.5 .. 1

function applyBackingStore(){
  const want = Math.min(window.devicePixelRatio || 1, QF.dpr) * renderScale;
  const area = W * H;
  const capped = area * want * want > MAX_PIXELS
    ? Math.sqrt(MAX_PIXELS / area)
    : want;
  DPR = clamp(capped, 0.5, 3);
  cv.width  = Math.max(1, Math.round(W * DPR));
  cv.height = Math.max(1, Math.round(H * DPR));
  /* the bloom buffers follow the real backing store, not the CSS size */
  bufA.width  = bufB.width  = Math.max(1, Math.round(cv.width  / 4));
  bufA.height = bufB.height = Math.max(1, Math.round(cv.height / 4));
}

function resize(){
  const r = stage.getBoundingClientRect();
  const nw = Math.max(320, Math.round(r.width));
  const nh = Math.max(180, Math.round(r.height));
  const moved = nw !== W || nh !== H;
  W = nw; H = nh;
  applyBackingStore();
  /* In portrait the narrow axis governs legibility: height/100 on a 390x844
     phone gives 8.4px units inside a 390px-wide column, which overflows. */
  const portrait = W / H < 1.15;
  const u = portrait ? clamp(W / 54, 4, 10) : clamp(H / 100, 3.2, 11);
  stage.style.setProperty('--u', u.toFixed(2) + 'px');
  /* plates are drawn at CSS size, so a resolution tweak must not rebuild
     them — that is three full-screen canvases of work */
  if (moved || !plates.length) buildOverlays();
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
const $ = id => document.getElementById(id);
const keys = Object.create(null);
const touch = { left:0, right:0 };
const IN = { steer:0 };

addEventListener('keydown', e => {
  keys[e.code] = 1;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  NHAudio.resume();
  if (e.code === 'Enter') {
    if (G.state === 'board') closeBoard();
    else if (G.state === 'daily') closeDaily();
    else if (G.state === 'menu') $('btnPlay').onclick();
    else if (G.state === 'over') { commitCoins(1); toGarage(); }
    else if (G.state === 'garage') { hide(UI.garage); startRun(); }
    else if (G.state === 'brief') beginDistrict();
  }
  if (G.state === 'draft' && /^Digit[1234]$/.test(e.code)) takeOffer(+e.code.slice(5) - 1);
  if (e.code === 'KeyM') { NHAudio.toggleMute(); setMute(); }
  if (e.code === 'Escape' && ['play','brief','map','contract','depot'].includes(G.state)) toMenu();
});
addEventListener('keyup', e => { keys[e.code] = 0; });


addEventListener('pointerdown', () => NHAudio.resume(), { passive: true });
stage.addEventListener('pointerdown', gsDown);
stage.addEventListener('pointermove', gsMove);
stage.addEventListener('pointerup', gsUp);
stage.addEventListener('pointercancel', gsUp);
stage.addEventListener('lostpointercapture', gsUp);

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

/* ---------------- gesture steering ----------------
   Fixed pads mean hitting a target while your eyes are on the road, which
   is the wrong ask on a phone. The first finger down becomes a virtual stick
   wherever it lands, and steering is now the only thing it has to carry —
   the handbrake and the nitro pull are both gone, so there is one axis and
   nothing to aim at. */
const GS = {
  on:false, id:-1, ax:0, ay:0, x:0, y:0, steer:0, raw:0
};
/* Travel to full lock. This was W*0.13 — about 50px on a phone — which meant
   the difference between a lane change and full opposite lock was a thumb
   twitch. More travel is what buys you fine control. */
const gsMaxX = () => clamp(W * 0.26, 78, 190);

function gsReset(){ GS.on = false; GS.id = -1; GS.steer = 0; GS.raw = 0; }
function gsDown(e){
  /* Touch contacts only. A laptop with a touchscreen reports maxTouchPoints
     but is still driven with the keyboard — a mouse click there should not
     become a steering input. */
  if (e.pointerType === 'mouse' || !swipeMode()) return;
  const hint = $('gsHint');
  if (hint) hint.classList.remove('on');   // it has served its purpose
  if (!GS.on) {
    GS.on = true; GS.id = e.pointerId;
    GS.ax = GS.x = e.clientX; GS.ay = GS.y = e.clientY;
    GS.steer = 0; GS.raw = 0;
    /* capture so the stick keeps tracking if the thumb leaves the element */
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  }
}
function gsMove(e){
  if (!GS.on || e.pointerId !== GS.id) return;
  GS.x = e.clientX; GS.y = e.clientY;

  /* the anchor trails the finger, so the stick never saturates out of reach */
  const mx = gsMaxX();
  let dx = GS.x - GS.ax;
  if (dx >  mx) { GS.ax = GS.x - mx; dx =  mx; }
  if (dx < -mx) { GS.ax = GS.x + mx; dx = -mx; }
  /* Squared response with a small deadzone: near the centre the stick barely
     turns, so holding a line is possible, and full lock is still reachable at
     the end of the travel. A linear stick gives you neither. */
  const raw = clamp(dx / mx, -1, 1);
  GS.raw = raw;
  const a = Math.abs(raw), DZ = 0.07;
  const t = a < DZ ? 0 : (a - DZ) / (1 - DZ);
  GS.steer = Math.sign(raw) * (t * t * 0.72 + t * 0.28);
}
function gsUp(e){
  if (e.pointerId !== GS.id) return;
  try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
  GS.on = false; GS.id = -1; GS.steer = 0; GS.raw = 0;
}
function swipeMode(){ return hasTouch && Save.data.ctrl !== 'pads'; }

function readInput(){
  const l = keys.ArrowLeft  || keys.KeyA || touch.left;
  const r = keys.ArrowRight || keys.KeyD || touch.right;
  let steer = (r ? 1 : 0) - (l ? 1 : 0);
  if (swipeMode() && GS.on && !steer) steer = GS.steer;  // analogue, unlike the keyboard
  IN.steer = steer;
}

/* ============================================================
   TRACK
   A centreline advanced by a smoothed random walk. Buildings and
   lamps are baked per node at generation time so the city is
   stable as you drive past it.
   ============================================================ */
const SEG = 56;
const REVERSE_TOP = 190;   // how fast the car will back itself off a rail

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
        if (Math.random() < TH.gap) continue;
        const off = this.hw + rnd(TH.back[0], TH.back[1]);
        const nx = -Math.sin(this.ang), ny = Math.cos(this.ang);
        p.b.push({
          x: this.x + nx * off * side,
          y: this.y + ny * off * side,
          w: rnd(TH.size[0], TH.size[1]), d: rnd(TH.size[0], TH.size[1]),
          h: rnd(TH.h[0], TH.h[1]),
          a: this.ang + rnd(-0.25, 0.25),
          hue: Math.random() < 0.5 ? TH.bldA : TH.bldB,
          face1: TH.face1, face2: TH.face2,
          lit: Math.random() < TH.lit,
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
    this.boost = 0; this.boostT = 0;
    this.dead = false; this.hitFlash = 0; this.offroad = 0;
    this.skidT = 0; this.smokeT = 0;
    this.nearFlag = false; this.lamp = Math.random() * TAU; this.driftHeld = 0;
    this.mods = null; this.topBonus = 0; this.spin = 0; this.wrecked = 0;
    this.inv = 0;
  }
  get speed(){ return hyp(this.vx, this.vy); }

  drive(dt, steerIn, throttle){
    const s = this.spec;
    /* only the player carries chip modifiers; traffic and pursuit run stock */
    const M = this.mods;
    this.steer = damp(this.steer, steerIn, 13, dt);

    /* There is no handbrake any more, so turn authority has to stand on its
       own: it still tapers with speed, but nowhere near as far, because
       nothing is left to buy it back. Landing it between the old gripped and
       drifting rates matters: at the full drifting rate the car is twitchy
       and every correction overshoots into a barrier. */
    const sp = this.speed;
    const rate = 2.0
               * clamp(sp / 190, 0, 1)
               * lerp(1, 0.78, clamp(sp / 900, 0, 1));
    this.a += this.steer * rate * dt;

    /* The slide is automatic: lean hard on the wheel at speed and the tail
       comes round on its own. You no longer operate the drift, you provoke
       it — but it still looks and sounds like the same car. */
    const loose = Math.abs(this.steer) > 0.62 && sp > 420 ? 1 : 0;

    const cs = Math.cos(this.a), sn = Math.sin(this.a);

    /* body frame: longitudinal + lateral velocity */
    let lon =  cs * this.vx + sn * this.vy;
    let lat = -sn * this.vx + cs * this.vy;

    /* Boost is no longer a tank you meter out — it is a power-up that fires
       the moment you drive over it and runs itself down. */
    this.boostT = Math.max(0, this.boostT - dt);
    this.boost = this.boostT > 0 ? 1 : 0;
    let acc = throttle * s.power * (this.boost && throttle > 0 ? 1.9 : 1);

    const top = s.top * (M ? M.topMul * (1 + this.topBonus) : 1) * (this.boost ? 1.22 : 1);
    lon += acc * dt;
    if (lon > top) lon = damp(lon, top, 3, dt);
    if (lon < -REVERSE_TOP) lon = -REVERSE_TOP;   // backing out is slow on purpose
    lon *= Math.exp(-(0.42 + this.offroad * 2.4) * dt);

    /* grip is what the whole game is built on: releasing it is the verb */
    const grip = (loose ? 2.6 : s.grip * (M ? M.gripMul : 1)) * (1 - this.offroad * 0.45);
    lat *= Math.exp(-grip * dt);

    this.vx = cs * lon - sn * lat;
    this.vy = sn * lon + cs * lat;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* Self-aligning torque. Without it a slide has no equilibrium and simply
       winds up into a spin — the car holds a stable angle instead, which is
       what makes a drift something you can steer rather than survive. */
    const phi = Math.atan2(lat, Math.max(60, Math.abs(lon)));
    const maxSlip = loose ? 0.58 : 0.26;
    const over = Math.abs(phi) - maxSlip;
    if (over > 0) this.a += Math.sign(phi) * Math.min(over, 0.7) * 9.5 * dt;

    this.slip = Math.abs(phi);
    this.drift = damp(this.drift, (this.slip > 0.20 && sp > 200) ? 1 : 0, 12, dt);

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
  score:0, pending:0, chain:0, mult:1, chainT:0, chainMax:1,
  heat:0, tier:0, best:Save.data.best,
  coinsRun:0, topMult:1, totalWreck:0,
  crashT:0, slow:1, flash:0, revived:false,
  shake:0, dist:0,
  run:null, ghost:0, pulseWarn:0, offers:[], paused:false,
  hp:100, hpMax:100, freeze:0, hitCool:0,
  pickups:[], power:{ shield:0, surge:0, magnet:0, frenzy:0, slowmo:0, ball:0, arc:0, drones:0 }, missileT:0, shockAt:5,
  rockets:0, rocketT:0, lastingPlate:0, lastingClock:0, lastingPayday:0, worldSlow:1,
  ball:null, wells:[], arcs:[], ballHits:0, drones:[], scav:null, lastingScav:0,
  convoy:[], convoyState:'pending', convoyLeft:0,
  stuckT:0, reverseT:0
};

const cam = { x:0, y:0, rot:-Math.PI/2, zoom:1, sx:0, sy:0 };

/* ---------------- the ladder ----------------
   Districts get longer, hungrier and hotter. Every third is a boss, where
   the quota is replaced by a pursuit unit you damage by banking into it. */
const DISTRICTS = [
  'Dockside', 'Sodium Row', 'The Spillway', 'Glasshouse', 'Nine Mile',
  'Cathedral Hill', 'Ashfield', 'The Verge', 'Kiln Street', 'Low Basin',
  'Radial', 'Saltgate', 'Underpass 9', 'The Shallows', 'Foundry Line'
];
const DEPOT_NAMES = ['Lockup', 'Chop Shop', 'The Yard', 'Back Alley', 'Cold Store'];
const BOSSES = [
  { id:'warden', name:'WARDEN',  sub:'Heavy Interdiction',
    blurb:'Rams hard and salts the road behind it.' },
  { id:'siren',  name:'SIREN',   sub:'Signals Division',
    blurb:'Pulses wipe a bank you have let grow too fat.' },
  { id:'reaper', name:'REAPER',  sub:'Pursuit Special',
    blurb:'Faster than you, and it brought friends.' }
];

function districtCfg(n, type, act){
  const boss = type === 'boss';
  const bi = act - 1;
  const elite = type === 'elite';
  return {
    n, boss, elite, type,
    name: (G.run && G.run.node && G.run.node.name) ||
          (boss ? BOSSES[bi % BOSSES.length].name : DISTRICTS[(n - 1) % DISTRICTS.length]),
    bossDef: boss ? BOSSES[bi % BOSSES.length] : null,
    len: Math.round(400 + n * 26),
    /* Elites cost more and pay a rare chip; the route choice has to bite */
    quota: Math.round(7000 * Math.pow(1.32, n - 1) * (elite ? 1.45 : 1)),
    /* Wrecks bank far harder than the old drift-only income did, so a boss
       that used to be a two-chain fight now needs the headroom to last. */
    bossHp: Math.round(12000 * Math.pow(1.55, Math.max(0, bi))),
    heatFloor: Math.min(2, (act - 1) + (elite ? 1 : 0))
  };
}

/* ============================================================
   THE ROUTE
   A branching board per act, climbed bottom to top. Which node you take
   is the strategic layer: an Elite is harder but pays a rare chip, a
   Depot costs you a district of scoring but repairs your build. Without
   a visible route none of those are decisions.
   ============================================================ */
const NODE_ICON = { run:'▲', elite:'✦', depot:'⌂', boss:'☠' };
const NODE_CAP  = { run:'Run', elite:'Elite', depot:'Depot', boss:'Pursuit' };
const ROWS = 5;

/* What a node is worth, stated on its face. A fork between two nodes that
   read the same is not a choice, so every node carries its reward and its
   cost, and siblings in a row are forced to differ. */
const NODE_INFO = {
  run:   { reward:'1 chip',        rare:false, quotaMul:1.00, heat:0 },
  elite: { reward:'Rare chip · 4', rare:true,  quotaMul:1.45, heat:1 },
  depot: { reward:'Free chip or repair', rare:false, quotaMul:0, heat:0 },
  boss:  { reward:'Rare chip · act', rare:true, quotaMul:1.15, heat:1 }
};

function makeRoute(act){
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    if (r === ROWS - 1) { rows.push([{ type:'boss' }]); continue; }
    /* Draw distinct types rather than retrying a random pick: a fork whose
       branches read the same is not a choice, and the row before the boss
       only has two kinds to offer, so it can never hold three. */
    /* A Depot is worthless before you own anything: nothing to strip, and a
       free chip is not worth skipping your first scoring district for. So
       the opening fork is safe-vs-greedy, and Depots only appear once a
       build exists to repair. The row before the boss is the classic
       rest-or-push decision, so it drops Run. */
    const kinds = r === 0            ? ['run', 'elite']
                : r === 1            ? ['run', 'elite']
                : r === ROWS - 2     ? ['depot', 'elite']
                                     : ['run', 'elite', 'depot'];
    const n = Math.min(r === 0 ? 2 : (Math.random() < 0.5 ? 3 : 2), kinds.length);
    const bag = kinds.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = rint(0, i + 1);
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    /* bias the shuffle so Run stays the common case when it is on offer */
    if (n < bag.length && bag.indexOf('run') >= n && Math.random() < 0.55) {
      bag[rint(0, n)] = 'run';
    }
    rows.push(bag.slice(0, n).map(t => ({ type: t })));
  }
  /* connect each node forward, then guarantee every node is reachable so
     the board never contains a dead branch */
  for (let r = 0; r < ROWS - 1; r++) {
    const a = rows[r], b = rows[r + 1];
    a.forEach((node, i) => {
      const centre = a.length === 1 ? 0
        : Math.round(i / (a.length - 1) * (b.length - 1));
      const set = new Set([centre]);
      if (Math.random() < 0.62 && centre > 0) set.add(centre - 1);
      if (Math.random() < 0.62 && centre < b.length - 1) set.add(centre + 1);
      node.next = [...set];
    });
    b.forEach((_, j) => {
      if (a.some(n => n.next.includes(j))) return;
      const i = a.length === 1 ? 0
        : Math.min(a.length - 1, Math.round(j / Math.max(1, b.length - 1) * (a.length - 1)));
      a[i].next.push(j);
    });
  }
  /* Every place on the board gets its own name. Three nodes all reading
     "Glasshouse" made the map look generated, which it is, but it should
     not look it. */
  const pool = DISTRICTS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rint(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const depots = DEPOT_NAMES.slice();
  for (let i = depots.length - 1; i > 0; i--) {
    const j = rint(0, i + 1);
    [depots[i], depots[j]] = [depots[j], depots[i]];
  }
  let pi = 0, di = 0;
  rows.forEach((row, r) => row.forEach((n, c) => {
    n.row = r; n.col = c; n.done = false;
    const info = NODE_INFO[n.type];
    const idx = r + 1 + (act - 1) * (ROWS - 1);
    n.name = n.type === 'boss' ? BOSSES[(act - 1) % BOSSES.length].name
           : n.type === 'depot' ? depots[di++ % depots.length]
           : pool[pi++ % pool.length];
    n.reward = info.reward;
    n.rare = info.rare;
    n.heat = info.heat;
    /* Advertise exactly what districtCfg will set. These used to be two
       different formulas indexed two different ways — the board by row, the
       district by districts actually played — so taking a Depot desynced them
       and every node after it lied about its quota. */
    n.district = idx;
    n.quota = n.type === 'boss' || n.type === 'depot'
      ? 0
      : districtCfg(idx, n.type, act).quota;
  }));
  return rows;
}

function newRun(){
  return {
    act: 1, route: makeRoute(1), row: -1, col: -1,
    node: null, district: 0,
    chips: [], curses: [], contract: null,
    M: NHChips.defaults(), L: NHChips.levelDefaults(),
    cfg: null, quota: 0, banked: 0, startIdx: 0,
    cleared: 0, crumpleLeft: 0
  };
}

/* A Depot offers a repair only when there is something to repair, so the
   label has to be read at draw time rather than baked in at generation. */
function nodeReward(node){
  if (node.type !== 'depot') return node.reward;
  return (G.run && G.run.curses.length) ? 'Free chip or strip a curse' : 'Free chip';
}

/* which nodes the player may take from where they are standing */
function openNodes(){
  const run = G.run;
  if (!run) return [];
  if (run.row < 0) return run.route[0].map((_, c) => ({ row:0, col:c }));
  const cur = run.route[run.row][run.col];
  if (run.row >= ROWS - 1) return [];
  return (cur.next || []).map(c => ({ row: run.row + 1, col: c }));
}

function newWorld(ai){
  /* the theme has to be chosen before the generator runs — the skyline is
     baked per node at generation time, not at draw time */
  setTheme(G.run ? G.run.act : 1);
  G.track = new Track();
  G.spec = activeSpec();
  G.traffic = []; G.police = []; G.boss = null; G.hazards = []; G.pickups = []; G.convoy = [];
  P.length = 0; SKID.length = 0;
  G.car = new Vehicle(G.spec, 'player');
  G.car.mods = G.run ? G.run.M : NHChips.defaults();
  const st = G.track.at(6, 0);
  G.car.x = st.x; G.car.y = st.y; G.car.a = st.a;
  G.car.vx = Math.cos(st.a) * 300; G.car.vy = Math.sin(st.a) * 300;
  G.car.idx = 6; G.car.boostT = 0;
  G.pending = 0; G.chain = 0; G.mult = 1; G.chainT = 0; G.shockAt = 5;
  G.heat = 0; G.tier = 0; G.topMult = G.topMult || 1;
  G.slow = 1; G.flash = 0; G.shake = 0; G.dist = 0;
  G.ghost = 0; G.pulseWarn = 0;
  G.freeze = 0; G.hitCool = 0; G.hurt = 0;
  G.pickups = []; G.power.shield = 0; G.power.surge = 0; G.shockAt = 5;
  G.power.magnet = 0; G.power.frenzy = 0; G.power.slowmo = 0; G.worldSlow = 1;
  G.power.ball = 0; G.power.arc = 0; G.ball = null; G.wells = []; G.arcs = []; G.ballHits = 0;
  G.power.drones = 0; G.drones = []; G.scav = null; G.lastingScav = 0;
  G.rockets = 0; G.rocketT = 0;
  /* the lasting pickups are exactly that — for *this* district only */
  G.lastingPlate = 0; G.lastingClock = 0; G.lastingPayday = 0; G.lastingScav = 0;
  G.convoy = []; G.convoyState = 'pending'; G.convoyLeft = 0;
  G.stuckT = 0; G.reverseT = 0;
  G.missileT = Hangar.has('missile') ? 4 : 0;
  if (Hangar.has('blackbox')) G.power.shield = 7;
  G.hpMax = Math.round(100 * (G.run ? G.run.M.hullMax : 1) + (G.spec.hull || 0));
  G.hp = G.hpMax;
  G.ai = !!ai;
  cam.x = G.car.x; cam.y = G.car.y; cam.rot = G.car.a; cam.zoom = baseZoom();
  for (let i = 0; i < 18; i++) addTraffic(14 + i * 11);
}
/* Zoom is bounded by width as well as height, otherwise a portrait phone
   frames less than half the street and you cannot see what you are aiming at. */
const baseZoom = () => clamp(Math.min(H / 640, W / 900), 0.40, 1.5)
  * (G.run ? G.run.M.zoomMul : 1);
/* sit the car lower when there is vertical room to spare, to see further ahead */
const camY = () => H * (W / H < 1.15 ? 0.72 : 0.62);
const roadHalf = p => p.w * (G.run ? G.run.M.roadMul : 1);
/* level conditions set by the chosen contract, reset when the district ends */
const LVL = () => (G.run && G.state === 'play' ? G.run.L : NHChips.levelDefaults());

const LANES = [-0.62, -0.21, 0.21, 0.62];

function addTraffic(ahead){
  const idx = G.car.idx + ahead;
  G.track.ensure(idx + 10);
  const p = G.track.pts[idx];
  /* Three lanes rather than a uniform scatter. A scatter is a fog you steer
     through; lanes give the player a readable target to aim at and a readable
     gap to thread, which are the only two things you can do with a car. */
  const lat = (LANES[rint(0, LANES.length)] + rnd(-0.07, 0.07)) * roadHalf(p);
  const c = CARS[rint(0, CARS.length)];
  const spec = Object.assign({}, c, {
    col:'#7C8FBF', col2:'#181F33', power:300, grip:8, top:rnd(210, 330)
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
    col:'#14203C', col2:'#080D1A', power:600, grip:7.0, top:660
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
    grip:7.2, top: def.id === 'reaper' ? 720 : 665
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
    Ads.celebrate();
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

  if (b.charge > 0) b.boostT = Math.max(b.boostT, 0.2);
  b.drive(dt, st, 1);
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
      burnChain(1.2);
      damage(b.charge > 0 ? 26 : 18, 'boss');
      hitstop(0.06, 24);
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

/* Air. A colour change alone still reads as the same road repainted; what
   sells a different place is something moving through it that was not there
   before. Fog banks drift across the docks, embers fall through the
   undercity, and the downtown has neither. */
function stepAir(dt){
  const air = TH.air;
  if (!air || !QF.grain) return;
  const car = G.car;
  G.airT = (G.airT || 0) - dt;
  if (G.airT > 0) return;
  G.airT = 1 / (air.rate * 26);
  const ahead = G.track.at(car.idx + rint(6, 30), rnd(-1, 1) * 900);
  spawn(ahead.x, ahead.y,
        Math.cos(ahead.a + Math.PI / 2) * air.drift + rnd(-20, 20),
        Math.sin(ahead.a + Math.PI / 2) * air.drift + rnd(-20, 20),
        rnd(air.life[0], air.life[1]), rnd(air.size[0], air.size[1]),
        air.rgb, air.drift < 0, 0);
}

function stepHazards(dt){
  const car = G.car;
  for (let i = G.hazards.length - 1; i >= 0; i--) {
    const h = G.hazards[i];
    if (h.life < 9000) h.life -= dt;   // seeded strips are permanent for the district
    if (h.life <= 0 || h.hit) { G.hazards.splice(i, 1); continue; }
    if (G.state !== 'play' || G.ai || car.inv > 0) continue;
    if (hyp(h.x - car.x, h.y - car.y) < 46) {
      h.hit = 1;
      G.chain = 0; G.pending = Math.floor(G.pending * 0.5);
      car.vx *= 0.72; car.vy *= 0.72;
      G.shake = Math.max(G.shake, 16);
      car.hitFlash = 1;
      damage(12, 'strip');
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
  v.offroad = Math.abs(loc.lat) > roadHalf(loc.p) ? 1 : 0;
  if (aggressive && Math.abs(st) < 0.2) v.boostT = Math.max(v.boostT, 0.2);
  v.drive(dt, st, 1);
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

/* ============================================================
   IMPACT
   Traffic is ammunition, not an obstacle. Slamming a car banks points at
   the current multiplier, shoves you forward, and extends the chain — but
   it costs hull. Dodging still pays, and pays more, because threading the
   gap is the harder skill; it just does not cost anything. Two live ways
   to treat every car on the road is the whole loop.
   ============================================================ */
function hitstop(secs, shake){
  G.freeze = Math.max(G.freeze, secs);
  G.shake = Math.max(G.shake, shake);
}

function damage(amount, reason){
  if (G.car.inv > 0 && reason !== 'wall') return;
  G.hp -= amount;
  G.hurt = 1;
  if (G.hp <= 0) { G.hp = 0; crash(reason); }
}

/* the payoff for driving through something rather than around it */
function smash(v, rel){
  const car = G.car;
  const power = clamp(rel / 520, 0.35, 1.7);
  const M = G.run.M;

  G.totalWreck++;
  /* This car pays at the multiplier the chain has already earned, and only
     then does the chain grow — so the first wreck is worth ×1 and every one
     after it is worth more than the last. */
  const gain = Math.round(260 * power * G.mult * M.bankMul * M.wreckMul
             * (G.run.L.wreckPay || 1) * (G.power.frenzy > 0 ? 2 : 1));
  G.pending += gain;

  G.chain += 1 + (car.boost ? M.boostChain : 0);
  G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  G.topMult = Math.max(G.topMult, G.mult);
  G.chainT = G.chainMax = chainTime();

  /* Ram Plate eats the hull cost outright — that is what the pickup is for */
  if (!G.power.shield) damage(Math.round(9 * power * (M.hullCost || 1)), 'traffic');

  /* kinetic transfer: you come out of a hit faster, not slower */
  const cs = Math.cos(car.a), sn = Math.sin(car.a);
  car.vx += cs * 120 * power; car.vy += sn * 120 * power;

  /* the victim leaves the road */
  const nx = (v.x - car.x), ny = (v.y - car.y);
  const d = hyp(nx, ny) || 1;
  v.vx += nx / d * 620 * power; v.vy += ny / d * 620 * power;
  v.spin = (Math.random() < 0.5 ? -1 : 1) * (5 + power * 7);
  v.wrecked = 1; v.hitFlash = 1;

  hitstop(0.055 + power * 0.045, 18 + power * 16);
  G.flash = Math.max(G.flash, 0.35 * power);
  NHAudio.smash(power);
  car.hitFlash = 1;
  G.hitCool = 0.1;

  for (let i = 0; i < 26; i++) {
    const a = rnd(0, TAU), sp = rnd(140, 620) * power;
    spawn(v.x, v.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.3, 0.85), rnd(3, 8),
          i % 3 ? '255,196,120' : '255,120,90', true, -6);
  }
  for (let i = 0; i < 10; i++) {
    const a = rnd(0, TAU), sp = rnd(40, 180);
    spawn(v.x, v.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.6, 1.3), rnd(9, 18), '140,150,170', false, 40);
  }
  /* the pile-up counter already carries the streak; repeating it in the
     toast just doubles the noise now that wrecks come several a second */
  if (G.lastingPayday > 0) G.coinsRun += 12 * G.lastingPayday;
  toast('Wreck +' + fmt(gain), 'gold');
  if (Hangar.has('shockplate') && G.chain >= G.shockAt) { G.shockAt = G.chain + 5; shockwave(); }
  arcFrom(v);
}


/* Getting hit burns clock, not links. Docking the chain itself would drop
   the multiplier by an amount the player never sees coming; taking time off
   the clock says exactly what it costs — you have less of it to reach the
   next car. */
function burnChain(secs){
  if (G.chainT <= 0) return;
  G.chainT = Math.max(0, G.chainT - secs);
  if (G.chainT === 0 && G.pending > 0) bank();
}

/* seconds on the chain clock, floored so a stack of curses cannot make it
   impossible to link two cars together */
function chainTime(){
  return Math.max(1.4, (G.run ? G.run.M.chainTime : 3.2) + (G.lastingClock || 0));
}

/* Shock Plating: every fifth link in a chain detonates everything close by.
   Free wrecks, so it pays into the same chain rather than starting a new one. */
function shockwave(){
  const car = G.car;
  G.flash = Math.max(G.flash, 0.5);
  hitstop(0.06, 24);
  NHAudio.smash(1.4);
  for (let i = 0; i < 40; i++) {
    const a = rnd(0, TAU), sp = rnd(300, 780);
    spawn(car.x, car.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.25, 0.6), rnd(4, 10), '120,220,255', true, -8);
  }
  for (const t of G.traffic) {
    if (t.wrecked) continue;
    const d = hyp(t.x - car.x, t.y - car.y);
    if (d > 260) continue;
    const nx = (t.x - car.x) / (d || 1), ny = (t.y - car.y) / (d || 1);
    t.vx += nx * 700; t.vy += ny * 700;
    t.spin = rnd(-11, 11); t.wrecked = 1; t.hitFlash = 1;
    G.totalWreck++;
    G.pending += Math.round(180 * G.mult);
  }
  toast('Shock plating!', 'pink');
}


/* ============================================================
   POWER-UPS
   Everything on this list fires the instant you drive over it. Nothing is
   held, metered or aimed — the road hands you the effect and you decide
   whether it is worth the line you have to take to reach it.
   ============================================================ */
/* `lasting` marks the ones that run to the end of the district rather than on
   a timer. They are deliberately rare: a permanent upgrade you find on the
   road is a much bigger event than a few seconds of speed, and finding two in
   a district should feel lucky rather than routine. */
const POWERS = [
  { id:'boost',   name:'Boost',      col:'#FFB13D', rgb:'255,177,61',  glyph:'\u00bb', w:26 },
  { id:'repair',  name:'Repair',     col:'#2FE08A', rgb:'47,224,138',  glyph:'+',       w:18 },
  { id:'shield',  name:'Ram Plate',  col:'#3DE8FF', rgb:'61,232,255',  glyph:'\u25c7', w:15 },
  { id:'surge',   name:'Surge',      col:'#FF2E88', rgb:'255,46,136',  glyph:'\u2605', w:12 },
  { id:'magnet',  name:'Magnet',     col:'#8CF3FF', rgb:'140,243,255', glyph:'\u25c9', w:16 },
  { id:'rockets', name:'Bazooka',    col:'#FF6B4A', rgb:'255,107,74',  glyph:'\u25b2', w:14 },
  { id:'frenzy',  name:'Frenzy',     col:'#FFD166', rgb:'255,209,102', glyph:'\u25c6', w:12 },
  { id:'slowmo',  name:'Adrenaline', col:'#DCF6FF', rgb:'220,246,255', glyph:'\u25d4', w:13 },
  { id:'ball',    name:'Wrecking Ball', col:'#FF8A3D', rgb:'255,138,61', glyph:'\u25cf', w:12 },
  { id:'arc',     name:'Arc Welder',    col:'#7FE9FF', rgb:'127,233,255', glyph:'\u21af', w:11 },
  { id:'well',    name:'Singularity',   col:'#B07CFF', rgb:'176,124,255', glyph:'\u25cc', w:9 },
  { id:'drones',  name:'Escort Drones', col:'#5BFFC9', rgb:'91,255,201',  glyph:'\u2b1f', w:12 },
  { id:'plating', name:'Reinforced', col:'#7BF5B0', rgb:'123,245,176', glyph:'\u25a0', w:7,  lasting:1 },
  { id:'clock',   name:'Overclock',  col:'#C6A8FF', rgb:'198,168,255', glyph:'\u221e', w:7,  lasting:1 },
  { id:'payday',  name:'Payday',     col:'#FFC53D', rgb:'255,197,61',  glyph:'\u00a4', w:6,  lasting:1 },
  { id:'scav',    name:'Scavenger',  col:'#FF9ED2', rgb:'255,158,210', glyph:'\u27f2', w:6,  lasting:1 }
];
const powerById = id => POWERS.find(p => p.id === id);

function addPickup(ahead){
  const idx = G.car.idx + ahead;
  G.track.ensure(idx + 10);
  const p = G.track.pts[idx];
  let total = 0;
  for (const k of POWERS) total += k.w;
  let r = Math.random() * total, kind = POWERS[0];
  for (const k of POWERS) { r -= k.w; if (r <= 0) { kind = k; break; } }
  const pos = G.track.at(idx, (LANES[rint(0, LANES.length)] + rnd(-0.05, 0.05)) * roadHalf(p));
  G.pickups.push({ kind, x:pos.x, y:pos.y, idx, spin:rnd(0, TAU), got:0 });
}

function takePickup(k){
  const M = G.run.M;
  const car = G.car;
  switch (k.id) {
    case 'boost':
      car.boostT = Math.max(car.boostT, 2.4 * M.boostTime * (G.spec.boostMul || 1));
      /* Turbine Intake turns the boost into chain fuel as well as speed */
      if (Hangar.has('turbine') && G.chain >= 1) {
        G.chain += 2;
        G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
        G.chainT = G.chainMax = chainTime();
      }
      break;
    case 'repair':
      G.hp = Math.min(G.hpMax, G.hp + Math.round(G.hpMax * 0.25));
      break;
    case 'shield':
      G.power.shield = Math.max(G.power.shield, 7 * M.powerTime);
      break;
    case 'surge':
      /* the clock stops dead, so a Surge is a licence to be greedy */
      G.power.surge = Math.max(G.power.surge, 5 * M.powerTime);
      if (G.chainT > 0) G.chainT = G.chainMax = chainTime();
      break;
    case 'magnet':
      /* drags traffic onto your line — the chain becomes trivial for a
         moment, which is exactly what you want a power-up to feel like */
      G.power.magnet = Math.max(G.power.magnet, 8 * M.powerTime);
      break;
    case 'rockets':
      /* a burst, unlike the Harpoon rack's steady 9s cycle */
      G.rockets += 4;
      G.rocketT = Math.min(G.rocketT || 0.5, 0.5);
      break;
    case 'frenzy':
      G.power.frenzy = Math.max(G.power.frenzy, 8 * M.powerTime);
      break;
    case 'plating':
      /* rest of the district: a bigger hull, filled */
      G.hpMax += 30;
      G.hp = G.hpMax;
      G.lastingPlate++;
      break;
    case 'clock':
      /* rest of the district: more seconds on every chain */
      G.lastingClock += 1.2;
      if (G.chainT > 0) G.chainT = G.chainMax = chainTime();
      break;
    case 'slowmo':
      /* the world slows; you do not. Slowing the player too would take the
         thrill out of the thing the power-up is supposed to celebrate. */
      G.power.slowmo = Math.max(G.power.slowmo, 5 * M.powerTime);
      break;
    case 'ball': {
      /* a real pendulum, thrown out behind you */
      G.power.ball = Math.max(G.power.ball, 11 * M.powerTime);
      G.ball = { x:car.x, y:car.y, vx:0, vy:0, ang:car.a + Math.PI };
      break;
    }
    case 'arc':
      G.power.arc = Math.max(G.power.arc, 9 * M.powerTime);
      break;
    case 'well': {
      /* Planted up the road rather than under you. Dropped at the car it
         harvested almost nothing — you are doing 700 a second and everything
         behind you is already wrecked, so the well spent its life on empty
         asphalt. Ahead, oncoming traffic drives into it. */
      const at = G.track.at(car.idx + 14, 0);
      G.wells.push({ x:at.x, y:at.y, t:5.0, r:0 });
      break;
    }
    case 'drones': {
      G.power.drones = Math.max(G.power.drones, 11 * M.powerTime);
      /* one per shoulder, each acquiring independently */
      G.drones = [-1, 1].map(side => ({
        x:car.x, y:car.y, side, vx:0, vy:0, target:null, dwell:0, ang:0
      }));
      break;
    }
    case 'scav':
      /* rest of the district: a second drone runs the errands */
      G.lastingScav++;
      if (!G.scav) G.scav = { x:car.x, y:car.y, hold:null };
      break;
    case 'payday':
      /* rest of the district: wrecks pay the garage as well as the score,
         which is the only pickup that reaches past the end of the run */
      G.lastingPayday++;
      break;
  }
  G.flash = Math.max(G.flash, 0.3);
  NHAudio.pickup(k.id === 'boost' ? 1 : 0);
  toast(k.name + (k.lasting ? ' — rest of the district' : '!'),
        k.lasting ? 'pink' : k.id === 'repair' ? 'gold' : k.id === 'surge' ? 'pink' : '');
  for (let i = 0; i < 22; i++) {
    const a = rnd(0, TAU), sp = rnd(120, 460);
    spawn(k.x, k.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.25, 0.6), rnd(3, 8), k.rgb, true, -6);
  }
}

function stepPickups(dt){
  const car = G.car;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    k.spin += dt * 2.4;
    if (k.idx < car.idx - 12) { G.pickups.splice(i, 1); continue; }
    if (hyp(k.x - car.x, k.y - car.y) < 52) {
      takePickup(Object.assign({}, k.kind, { x:k.x, y:k.y }));
      G.pickups.splice(i, 1);
    }
  }
  const want = Math.round(4 * (G.run ? G.run.M.pickupRate : 1));
  while (G.pickups.length < want) addPickup(rint(34, 110));
}

/* timed effects, plus the hardware that runs on its own clock */
function stepPowers(dt){
  if (G.power.shield > 0) G.power.shield = Math.max(0, G.power.shield - dt);
  if (G.power.surge  > 0) G.power.surge  = Math.max(0, G.power.surge  - dt);
  if (G.power.magnet > 0) G.power.magnet = Math.max(0, G.power.magnet - dt);
  if (G.power.frenzy > 0) G.power.frenzy = Math.max(0, G.power.frenzy - dt);
  if (G.power.slowmo > 0) G.power.slowmo = Math.max(0, G.power.slowmo - dt);
  if (G.power.arc    > 0) G.power.arc    = Math.max(0, G.power.arc    - dt);
  if (G.power.ball   > 0) { G.power.ball = Math.max(0, G.power.ball - dt);
                            if (G.power.ball === 0) G.ball = null; }
  if (G.power.drones > 0) { G.power.drones = Math.max(0, G.power.drones - dt);
                            if (G.power.drones === 0) G.drones = []; }
  stepBall(dt); stepWells(dt); stepDrones(dt); stepScav(dt);
  for (let i = G.arcs.length - 1; i >= 0; i--)
    if ((G.arcs[i].t -= dt) <= 0) G.arcs.splice(i, 1);
  /* eased rather than switched, so it lands as a swell instead of a jolt */
  G.worldSlow = damp(G.worldSlow, G.power.slowmo > 0 ? 0.42 : 1, 7, dt);
  stepPickups(dt);
  stepMagnet(dt);
  stepRockets(dt);

  /* Scrap Welder: the hull creeps back while you are between chains, so
     hanging back to recover is a real alternative to pushing on */
  if (Hangar.has('welder') && G.chainT <= 0 && G.hp < G.hpMax) {
    G.hp = Math.min(G.hpMax, G.hp + dt * 4.5);
  }

  if (G.missileT > 0) {
    G.missileT -= dt;
    if (G.missileT <= 0) { fireMissile(); G.missileT = 9; }
  }
}




/* ============================================================
   ESCORT DRONES
   Two of them, holding station off each shoulder, each acquiring its own
   target and burning it down with a continuous beam. The distinction from
   the Harpoon rack and the Bazooka is that those are one-shot detonations on
   a cooldown — this is a beam that has to *dwell*, so it tracks its target
   across the road while you drive, and you can watch it working. Two drones
   means two beams sweeping independently, which is the whole spectacle.
   ============================================================ */
const BEAM_DWELL = 0.42;                 // seconds of contact to cut a car

function stepDrones(dt){
  if (G.power.drones <= 0 || !G.drones.length) return;
  const car = G.car, M = G.run.M;
  const cs = Math.cos(car.a), sn = Math.sin(car.a);

  for (const dr of G.drones) {
    /* station-keeping off a shoulder, slightly behind the nose */
    dr.ang += dt * 2.2;
    const bob = Math.sin(dr.ang) * 14;
    const tx = car.x - cs * 26 - sn * (112 + bob) * dr.side;
    const ty = car.y - sn * 26 + cs * (112 + bob) * dr.side;
    const k = 1 - Math.exp(-7 * dt);
    const px = dr.x, py = dr.y;
    dr.x = lerp(dr.x, tx, k);
    dr.y = lerp(dr.y, ty, k);
    dr.vx = (dr.x - px) / Math.max(dt, 1e-4);
    dr.vy = (dr.y - py) / Math.max(dt, 1e-4);

    /* drop a dead or distant target and acquire the nearest live one */
    if (dr.target && (dr.target.wrecked ||
        hyp(dr.target.x - dr.x, dr.target.y - dr.y) > 620)) {
      dr.target = null; dr.dwell = 0;
    }
    if (!dr.target) {
      /* Two beams on one car is two beams doing one beam's work. A side
         bias alone was not enough — measured, they shared a target every
         frame both were firing — so a car already being cut is only chosen
         when there is genuinely nothing else in range. */
      let best = null, bd = 1e9, spare = null, sd = 1e9;
      for (const t of G.traffic) {
        if (t.wrecked) continue;
        const d = hyp(t.x - dr.x, t.y - dr.y);
        if (d > 560) continue;
        const lat = -sn * (t.x - car.x) + cs * (t.y - car.y);
        const score = d + (Math.sign(lat) === dr.side ? 0 : 190);
        const taken = G.drones.some(o => o !== dr && o.target === t);
        if (taken) { if (score < sd) { sd = score; spare = t; } continue; }
        if (score < bd) { bd = score; best = t; }
      }
      dr.target = best || spare; dr.dwell = 0;
    }

    if (!dr.target) continue;
    dr.dwell += dt;
    /* the beam is hot enough to throw sparks off the panel it is cutting */
    if (Math.random() < 0.6) {
      const a = rnd(0, TAU), sp = rnd(60, 240);
      spawn(dr.target.x, dr.target.y, Math.cos(a) * sp, Math.sin(a) * sp,
            rnd(0.1, 0.28), rnd(2, 5), '150,255,220', true, -3);
    }
    if (dr.dwell < BEAM_DWELL) continue;

    const t = dr.target;
    const nx = (t.x - dr.x), ny = (t.y - dr.y), nd = hyp(nx, ny) || 1;
    t.vx += nx / nd * 560; t.vy += ny / nd * 560;
    t.spin = rnd(-12, 12); t.wrecked = 1; t.hitFlash = 1;
    G.totalWreck++;
    G.pending += Math.round(230 * G.mult * M.wreckMul * (G.power.frenzy > 0 ? 2 : 1));
    G.chain += 1;
    G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
    G.topMult = Math.max(G.topMult, G.mult);
    G.chainT = G.chainMax = chainTime();
    if (G.lastingPayday > 0) G.coinsRun += 12 * G.lastingPayday;
    G.flash = Math.max(G.flash, 0.24);
    NHAudio.smash(0.85);
    for (let i = 0; i < 22; i++) {
      const a = rnd(0, TAU), sp = rnd(140, 580);
      spawn(t.x, t.y, Math.cos(a) * sp, Math.sin(a) * sp,
            rnd(0.2, 0.55), rnd(3, 8), '91,255,201', true, -5);
    }
    arcFrom(t);
    dr.target = null; dr.dwell = 0;
  }
}

/* ============================================================
   SCAVENGER
   Runs the errands. It is the only pickup that changes your *route* rather
   than your firepower: with it aboard you stop swerving three lanes for a
   Boost, because the drone fetches it and brings it back.
   ============================================================ */
function stepScav(dt){
  if (G.lastingScav <= 0 || !G.scav) return;
  const car = G.car, s = G.scav;

  if (!s.hold) {
    let best = null, bd = 1e9;
    for (const k of G.pickups) {
      const d = hyp(k.x - s.x, k.y - s.y);
      if (d < bd && d < 1100) { bd = d; best = k; }
    }
    if (best) {
      const k = 1 - Math.exp(-2.6 * dt);
      s.x = lerp(s.x, best.x, k);
      s.y = lerp(s.y, best.y, k);
      if (hyp(best.x - s.x, best.y - s.y) < 46) {
        const i = G.pickups.indexOf(best);
        if (i >= 0) G.pickups.splice(i, 1);
        s.hold = best.kind;
        NHAudio.pickup(0);
      }
    } else {
      /* nothing to fetch: fly escort off the nose */
      const cs = Math.cos(car.a), sn = Math.sin(car.a);
      const k = 1 - Math.exp(-3 * dt);
      s.x = lerp(s.x, car.x + cs * 120 + sn * 90, k);
      s.y = lerp(s.y, car.y + sn * 120 - cs * 90, k);
    }
  } else {
    const k = 1 - Math.exp(-4.5 * dt);
    s.x = lerp(s.x, car.x, k);
    s.y = lerp(s.y, car.y, k);
    if (hyp(car.x - s.x, car.y - s.y) < 60) {
      takePickup(Object.assign({}, s.hold, { x:car.x, y:car.y }));
      s.hold = null;
    }
  }
  if (Math.random() < 0.5) {
    spawn(s.x, s.y, rnd(-40, 40), rnd(-40, 40),
          rnd(0.15, 0.35), rnd(2, 4), '255,158,210', true, 0);
  }
}

/* ============================================================
   WRECKING BALL
   A genuine pendulum on a chain, not a bigger hitbox. It is integrated
   independently and constrained to a fixed radius from the car, so it lags
   on the straights, swings wide through a corner, and comes round hard when
   you flick the wheel. The interesting part is that you aim it by driving —
   weaving deliberately whips it across two lanes, which is a way to play the
   road that nothing else in the game asks for.
   ============================================================ */
const BALL_LEN = 190;

function stepBall(dt){
  if (G.power.ball <= 0 || !G.ball) return;
  const car = G.car, b = G.ball;

  /* It orbits rather than trails. A free pendulum on a chain settles
     directly behind the car, and behind the car is where everything is
     already wrecked — measured zero hits over three seconds of weaving. Spun
     around you it sweeps both adjacent lanes continuously, which is the
     whole point: you stop steering *into* cars and start steering *past*
     them. The easing keeps it heavy, so it still lags and whips through a
     corner instead of tracking like a rigid arm. */
  b.ang = (b.ang || 0) + 3.6 * dt;
  const tx = car.x + Math.cos(b.ang) * BALL_LEN;
  const ty = car.y + Math.sin(b.ang) * BALL_LEN;
  const k = 1 - Math.exp(-11 * dt);
  const px = b.x, py = b.y;
  b.x = lerp(b.x, tx, k);
  b.y = lerp(b.y, ty, k);
  b.vx = (b.x - px) / Math.max(dt, 1e-4);
  b.vy = (b.y - py) / Math.max(dt, 1e-4);

  const swing = hyp(b.vx - car.vx, b.vy - car.vy);
  const M = G.run.M;
  /* Swept, not sampled. Between the ball's orbital speed and the car's, the
     iron covers better than twenty units a frame — a point test measured a
     closest approach of 58 against a radius of 52 and never landed a single
     hit in nine seconds. Testing the segment it travelled removes the
     tunnelling entirely. */
  const sx = b.x - px, sy = b.y - py;
  const segLen2 = sx * sx + sy * sy;
  const BALL_R = 58;
  for (const t of G.traffic) {
    if (t.wrecked) continue;
    let u = segLen2 > 1e-6 ? ((t.x - px) * sx + (t.y - py) * sy) / segLen2 : 0;
    u = clamp(u, 0, 1);
    if (hyp(t.x - (px + sx * u), t.y - (py + sy * u)) > BALL_R) continue;
    /* the ball takes the hit, so this costs no hull at all */
    const nx = (t.x - b.x), ny = (t.y - b.y), nd = hyp(nx, ny) || 1;
    t.vx += nx / nd * 900; t.vy += ny / nd * 900;
    t.spin = rnd(-13, 13); t.wrecked = 1; t.hitFlash = 1;
    G.totalWreck++; G.ballHits = (G.ballHits || 0) + 1;
    G.pending += Math.round(300 * G.mult * M.wreckMul * (G.power.frenzy > 0 ? 2 : 1));
    G.chain += 1;
    G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
    G.topMult = Math.max(G.topMult, G.mult);
    G.chainT = G.chainMax = chainTime();
    if (G.lastingPayday > 0) G.coinsRun += 12 * G.lastingPayday;
    hitstop(0.045, 20);
    G.flash = Math.max(G.flash, 0.3);
    NHAudio.smash(clamp(swing / 900, 0.6, 1.6));
    for (let i = 0; i < 26; i++) {
      const a = rnd(0, TAU), sp = rnd(160, 700);
      spawn(t.x, t.y, Math.cos(a) * sp, Math.sin(a) * sp,
            rnd(0.25, 0.7), rnd(4, 9), i % 3 ? '255,180,110' : '255,120,80', true, -6);
    }
    arcFrom(t);
  }
  /* sparks off the chain, so it reads as iron rather than a floating dot */
  if (Math.random() < 0.35) {
    const f = Math.random();
    spawn(car.x + (b.x - car.x) * f, car.y + (b.y - car.y) * f,
          rnd(-90, 90), rnd(-90, 90), rnd(0.15, 0.35), rnd(2, 4), '255,190,120', true, 30);
  }
}

/* ============================================================
   ARC WELDER
   Every wreck throws current at whatever is nearest, and those wrecks throw
   it on again. One well-placed hit in dense traffic takes a whole cluster,
   which turns a crowded lane from a problem into the reason you went there.
   ============================================================ */
function arcFrom(src, depth){
  if (G.power.arc <= 0) return;
  const hops = depth || 0;
  if (hops >= 3) return;
  const M = G.run.M;
  let best = null, bd = 1e9;
  for (const t of G.traffic) {
    if (t.wrecked || t === src) continue;
    const d = hyp(t.x - src.x, t.y - src.y);
    if (d < bd && d < 340) { bd = d; best = t; }
  }
  if (!best) return;

  G.arcs.push({ ax:src.x, ay:src.y, bx:best.x, by:best.y, t:0.22 });
  const nx = (best.x - src.x) / (bd || 1), ny = (best.y - src.y) / (bd || 1);
  best.vx += nx * 380; best.vy += ny * 380;
  best.spin = rnd(-9, 9); best.wrecked = 1; best.hitFlash = 1;
  G.totalWreck++;
  G.pending += Math.round(190 * G.mult * M.wreckMul * (G.power.frenzy > 0 ? 2 : 1));
  G.chain += 1;
  G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  G.topMult = Math.max(G.topMult, G.mult);
  G.chainT = G.chainMax = chainTime();
  if (G.lastingPayday > 0) G.coinsRun += 12 * G.lastingPayday;
  for (let i = 0; i < 12; i++) {
    const a = rnd(0, TAU), sp = rnd(120, 420);
    spawn(best.x, best.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.15, 0.4), rnd(2, 6), '150,240,255', true, -4);
  }
  arcFrom(best, hops + 1);
}

/* ============================================================
   SINGULARITY
   Dropped where you stand and left behind. Every other pickup here changes
   what *you* do for a few seconds; this one keeps working on a piece of road
   you have already left, so the decision is where to put it rather than what
   to do with it.
   ============================================================ */
function stepWells(dt){
  const M = G.run ? G.run.M : null;
  for (let i = G.wells.length - 1; i >= 0; i--) {
    const w = G.wells[i];
    w.t -= dt;
    w.r += dt * 3.2;
    if (w.t <= 0) { G.wells.splice(i, 1); continue; }
    for (const t of G.traffic) {
      if (t.wrecked) continue;
      const dx = w.x - t.x, dy = w.y - t.y;
      const d = hyp(dx, dy);
      if (d > 620) continue;
      const pull = (1 - d / 620) * 1900 * dt;
      t.vx += dx / d * pull; t.vy += dy / d * pull;
      if (d < 46 && M) {
        t.wrecked = 1; t.hitFlash = 1; t.spin = rnd(-16, 16);
        G.totalWreck++;
        G.pending += Math.round(230 * G.mult * M.wreckMul * (G.power.frenzy > 0 ? 2 : 1));
        G.chain += 1;
        G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
        G.topMult = Math.max(G.topMult, G.mult);
        G.chainT = G.chainMax = chainTime();
        if (G.lastingPayday > 0) G.coinsRun += 12 * G.lastingPayday;
        NHAudio.smash(0.9);
        for (let k = 0; k < 18; k++) {
          const a = rnd(0, TAU), sp = rnd(60, 260);
          spawn(w.x, w.y, Math.cos(a) * sp, Math.sin(a) * sp,
                rnd(0.2, 0.5), rnd(3, 7), '176,124,255', true, 0);
        }
      }
    }
    if (Math.random() < 0.7) {
      const a = rnd(0, TAU), r = rnd(180, 420);
      spawn(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r,
            -Math.cos(a) * 420, -Math.sin(a) * 420,
            rnd(0.3, 0.6), rnd(2, 6), '176,124,255', true, 0);
    }
  }
}

/* Magnet. Rather than warping cars, it steers them: an acceleration toward
   the line just in front of you, strongest when they are close. Cars still
   drive, still look like they are driving, and simply end up where you are
   going — so a chain that would have needed a lane change makes itself. */
function stepMagnet(dt){
  if (G.power.magnet <= 0) return;
  const car = G.car;
  const aim = G.track.at(car.idx + 3, 0);
  const k = 1 - Math.exp(-5.5 * dt);
  for (const t of G.traffic) {
    if (t.wrecked) continue;
    /* Gate on where they are *along the road*, not on straight-line distance.
       A 560-unit radius only reached the two nearest cars, because traffic
       lives five to twenty nodes ahead — this takes everything you are about
       to drive through. */
    const di = t.idx - car.idx;
    if (di < -3 || di > 24) continue;
    const dx = aim.x - t.x, dy = aim.y - t.y;
    const d = hyp(dx, dy) || 1;
    /* The important half: traffic autopilot steers toward its own lane every
       frame, so a velocity nudge alone just gets corrected away — a pure
       force version measured only 20% more convergence than no magnet at
       all. Move the lane they are steering *to* and they drive over
       themselves, which both works and looks like driving. */
    t.lane = lerp(t.lane || 0, 0, k);
    const pull = clamp(1 - d / 1100, 0.15, 1) * 380 * dt;
    t.vx += dx / d * pull;
    t.vy += dy / d * pull;
  }
  /* a visible field, so it is obvious why the road just got helpful */
  if (Math.random() < 0.5) {
    const a = rnd(0, TAU), r = rnd(140, 320);
    spawn(car.x + Math.cos(a) * r, car.y + Math.sin(a) * r,
          -Math.cos(a) * 260, -Math.sin(a) * 260,
          rnd(0.25, 0.5), rnd(3, 7), '140,243,255', true, 0);
  }
}

/* Bazooka: a burst of four, fired on a fast cycle. The Harpoon rack is the
   permanent version of this on a much slower clock, so the two stack without
   either making the other pointless. */
function stepRockets(dt){
  if (G.rockets <= 0) return;
  G.rocketT -= dt;
  if (G.rocketT > 0) return;
  const car = G.car;
  let best = null, bd = 1e9;
  for (const t of G.traffic) {
    if (t.wrecked) continue;
    const dx = t.x - car.x, dy = t.y - car.y, d = hyp(dx, dy);
    if (Math.cos(car.a) * dx + Math.sin(car.a) * dy < 20) continue;
    if (d < bd) { bd = d; best = t; }
  }
  if (!best || bd > 900) { G.rocketT = 0.35; return; }

  G.rockets--;
  G.rocketT = 0.9;
  const M = G.run.M;
  for (let i = 0; i < 30; i++) {
    const a = rnd(0, TAU), sp = rnd(200, 680);
    spawn(best.x, best.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.28, 0.7), rnd(4, 10),
          i % 3 ? '255,180,110' : '255,90,60', true, -6);
  }
  const nx = (best.x - car.x) / (bd || 1), ny = (best.y - car.y) / (bd || 1);
  best.vx += nx * 760; best.vy += ny * 760;
  best.spin = rnd(-11, 11); best.wrecked = 1; best.hitFlash = 1;
  G.totalWreck++;
  G.pending += Math.round(240 * G.mult * M.wreckMul * (G.power.frenzy > 0 ? 2 : 1));
  G.chain += 1;
  G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  G.topMult = Math.max(G.topMult, G.mult);
  G.chainT = G.chainMax = chainTime();
  G.flash = Math.max(G.flash, 0.35);
  hitstop(0.04, 14);
  NHAudio.smash(1.1);
}

/* Harpoon: picks the nearest car ahead and detonates it. No button — an
   auto-firing weapon fits a game whose whole control surface is steering. */
function fireMissile(){
  const car = G.car;
  let best = null, bd = 1e9;
  for (const t of G.traffic) {
    if (t.wrecked) continue;
    const dx = t.x - car.x, dy = t.y - car.y, d = hyp(dx, dy);
    if (Math.cos(car.a) * dx + Math.sin(car.a) * dy < 30) continue;
    if (d < bd) { bd = d; best = t; }
  }
  if (!best || bd > 780) { G.missileT = 1.2; return; }   // retry shortly

  for (let i = 0; i < 34; i++) {
    const a = rnd(0, TAU), sp = rnd(200, 700);
    spawn(best.x, best.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.3, 0.75), rnd(4, 11),
          i % 3 ? '255,196,120' : '255,90,70', true, -6);
  }
  const nx = (best.x - car.x) / (bd || 1), ny = (best.y - car.y) / (bd || 1);
  best.vx += nx * 820; best.vy += ny * 820;
  best.spin = rnd(-12, 12); best.wrecked = 1; best.hitFlash = 1;

  /* a free link: it pays and extends, but never costs hull */
  const M = G.run.M;
  G.totalWreck++;
  G.pending += Math.round(240 * G.mult * M.wreckMul);
  G.chain += 1;
  G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  G.topMult = Math.max(G.topMult, G.mult);
  G.chainT = G.chainMax = chainTime();
  G.flash = Math.max(G.flash, 0.4);
  hitstop(0.05, 16);
  NHAudio.smash(1.2);
  toast('Harpoon', 'pink');
}


/* ============================================================
   THE CONVOY
   A district used to have exactly one objective and it was a number: hit the
   quota, move on. Nothing in it was worth *wanting*. The convoy is the thing
   you chase — announced before it arrives, armoured so a casual bump bounces
   off, and gone if you do not commit. Every district now has a question in
   it besides "am I at the number yet".
   ============================================================ */
const CONVOY_SIZE = 3;
const TRUCK = {
  id:'hauler', len:74, wid:34, nose:0.86, tail:0.94,
  col:'#FFB13D', col2:'#4A2E06', power:480, grip:8.2, top:455, armor:2
};

function spawnConvoy(){
  const car = G.car;
  const base = car.idx + 26;
  G.track.ensure(base + 20);
  /* one lane, nose to tail — a formation reads as a target, a scatter does
     not, and it means one good run down the line can take all three */
  const lane = LANES[rint(0, LANES.length)] * 0.7;
  for (let k = 0; k < CONVOY_SIZE; k++) {
    const idx = base + k * 5;
    const p = G.track.pts[idx];
    const pos = G.track.at(idx, lane * roadHalf(p));
    const v = new Vehicle(Object.assign({}, TRUCK), 'convoy');
    v.x = pos.x; v.y = pos.y; v.a = pos.a; v.idx = idx;
    v.lane = lane * roadHalf(p);
    v.vx = Math.cos(pos.a) * TRUCK.top; v.vy = Math.sin(pos.a) * TRUCK.top;
    v.armour = 2;                       // survives a bump; not a boost
    G.convoy.push(v);
  }
  G.convoyState = 'live';
  G.convoyLeft = CONVOY_SIZE;
  toast('Convoy ahead — crack it', 'gold');
  NHAudio.warn();
}

/* What breaks armour: speed, boost, or hardware. A bump at cruising pace
   should bounce, so that catching the convoy is a decision to commit rather
   than something that happens to you on the way past. */
function convoyHit(v, rel){
  const car = G.car;
  const M = G.run.M;
  const heavy = car.boost || rel > 430 || G.power.surge > 0;
  G.hitCool = 0.12;

  if (!heavy && v.armour > 1) {
    v.armour--;
    v.hitFlash = 1;
    car.vx *= 0.72; car.vy *= 0.72;
    G.shake = Math.max(G.shake, 20);
    hitstop(0.05, 18);
    if (!G.power.shield) damage(Math.round(5 * (M.hullCost || 1)), 'traffic');
    NHAudio.hit(1.3);
    for (let i = 0; i < 16; i++) {
      const a = rnd(0, TAU), sp = rnd(120, 420);
      spawn(v.x, v.y, Math.cos(a) * sp, Math.sin(a) * sp,
            rnd(0.2, 0.5), rnd(3, 7), '255,210,140', true, -4);
    }
    toast('Armoured — hit it harder', 'red');
    return;
  }

  /* cracked: pays like five ordinary wrecks and counts as one chain link */
  v.wrecked = 1; v.hitFlash = 1;
  const nx = (v.x - car.x), ny = (v.y - car.y), d = hyp(nx, ny) || 1;
  v.vx += nx / d * 520; v.vy += ny / d * 520;
  v.spin = rnd(-9, 9);
  G.totalWreck++;
  G.convoyLeft--;

  /* Worth a bit over an ordinary wreck per hit — the prize is the formation,
     not the individual truck. */
  const gain = Math.round(320 * G.mult * M.bankMul * M.wreckMul * (G.run.L.wreckPay || 1));
  G.pending += gain;
  G.chain += 1;
  G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  G.topMult = Math.max(G.topMult, G.mult);
  G.chainT = G.chainMax = chainTime();
  if (!G.power.shield) damage(Math.round(9 * (M.hullCost || 1)), 'traffic');

  hitstop(0.09, 30);
  G.flash = Math.max(G.flash, 0.6);
  NHAudio.smash(1.6);
  for (let i = 0; i < 44; i++) {
    const a = rnd(0, TAU), sp = rnd(180, 760);
    spawn(v.x, v.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.3, 0.9), rnd(4, 11),
          i % 3 ? '255,196,120' : '255,120,90', true, -6);
  }
  toast('Hauler cracked +' + fmt(gain), 'gold');

  if (G.convoyLeft <= 0) {
    /* Pegged to the quota rather than to the multiplier. Multiplied, this
       paid 26,000 against a 7,000 target and turned the district into a
       formality; as a fraction of what you actually need it stays a strong
       prize at any depth — roughly a quarter of the way home — without ever
       replacing playing the district. */
    const bonus = Math.round(G.run.quota * 0.25);
    G.pending += bonus;
    G.convoyState = 'done';
    G.flash = Math.max(G.flash, 0.85);
    toast('CONVOY TAKEN +' + fmt(bonus), 'pink');
    NHAudio.bank(G.mult);
  }
}

function stepConvoy(dt){
  const run = G.run;
  if (!run || !run.cfg || run.cfg.boss) return;
  const car = G.car;
  const travelled = car.idx - run.startIdx;

  if (G.convoyState === 'pending' && travelled > run.cfg.len * 0.22) spawnConvoy();

  for (let i = G.convoy.length - 1; i >= 0; i--) {
    const v = G.convoy[i];
    if (v.wrecked) {
      v.a += v.spin * dt;
      v.spin *= Math.exp(-1.1 * dt);
      v.vx *= Math.exp(-0.85 * dt); v.vy *= Math.exp(-0.85 * dt);
      v.x += v.vx * dt; v.y += v.vy * dt;
      v.hitFlash = Math.max(0, v.hitFlash - dt * 3);
      if (v.idx < car.idx - 26) G.convoy.splice(i, 1);
      continue;
    }
    autoDrive(v, dt * G.worldSlow, false);
    /* they outrun ordinary traffic, so letting them go is a real outcome */
    if (v.idx > car.idx + 140) {
      G.convoy.splice(i, 1);
      G.convoyLeft--;
      if (G.convoyLeft <= 0 && G.convoyState === 'live') {
        G.convoyState = 'done';
        toast('Convoy got away', 'red');
      }
      continue;
    }
    const d = hyp(v.x - car.x, v.y - car.y);
    if (d < (v.spec.len + car.spec.len) * 0.52 && G.hitCool <= 0) {
      convoyHit(v, hyp(v.vx - car.vx, v.vy - car.vy));
    }
  }
}

/* -------- scoring -------- */
function bank(){
  if (G.pending < 1) { G.chain = 0; G.mult = 1; G.chainT = 0; return; }
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

  /* Cashing in welds the hull back together, and a pile-up patches more than
     a lone wreck — but never as much as it cost, so hull only ever trends
     down and the run still has a clock on it. */
  const heal = 3 + G.chain * 2.5 + (M.bankHeal || 0);
  if (G.hp < G.hpMax) G.hp = Math.min(G.hpMax, G.hp + heal);

  G.pending = 0; G.chain = 0; G.mult = 1; G.chainT = 0; G.shockAt = 5;

  /* quota districts clear the moment you meet the number */
  if (!G.boss && G.run.cfg && !G.run.cfg.boss && G.run.banked >= G.run.quota) clearDistrict();
}

function toast(text, cls){
  const el = document.createElement('div');
  el.className = 'toast' + (cls ? ' ' + cls : '');
  el.textContent = text;
  UI.toasts.appendChild(el);
  setTimeout(() => el.remove(), 1150);
  while (UI.toasts.children.length > 3) UI.toasts.firstChild.remove();
}

/* -------- crash -------- */
function crash(reason){
  if (G.state !== 'play') return;

  /* Crumple Zone spends a charge instead of ending the run */
  if (G.run && G.run.crumpleLeft > 0) {
    G.run.crumpleLeft--;
    G.hp = Math.max(G.hp, Math.round(G.hpMax * 0.45));
    G.car.inv = 2.2;
    G.car.hitFlash = 1;
    G.pending = 0; G.chain = 0; G.mult = 1;
    G.shake = 22; G.flash = 0.7;
    G.car.vx *= 0.45; G.car.vy *= 0.45;
    NHAudio.hit(1.4);
    toast('Crumple zone spent — hull patched', 'gold');
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
      /* Reverse, without a reverse control.
         Square onto a rail and the nose has nowhere to go: throttle only
         presses you harder into it and the run ends sitting still. Since
         steering is the whole control surface there is no pedal to add, so
         the car backs itself out — and rotates toward the road as it goes,
         because reversing out still pointing at the wall solves nothing. */
      const side = Math.sign(loc.lat) || 1;
      const bnx = -Math.sin(loc.p.a) * side, bny = Math.cos(loc.p.a) * side;
      const pinned = Math.abs(loc.lat) > roadHalf(loc.p) - car.spec.wid * 0.7;
      /* aimed at the rail, not merely beside it — otherwise crawling along the
         edge on purpose would trigger a reverse you did not ask for */
      const nosing = Math.cos(car.a) * bnx + Math.sin(car.a) * bny > 0.15;
      if (car.speed < 90 && ((pinned && nosing) || car.offroad)) G.stuckT += dt;
      else G.stuckT = Math.max(0, G.stuckT - dt * 2.5);
      if (G.stuckT > 0.30 && G.reverseT <= 0) {
        G.reverseT = 1.1;
        toast('Backing out', 'pink');
      }
      if (G.reverseT > 0) {
        G.reverseT -= dt;
        const want = T.at(car.idx + 2, 0).a;
        car.a += clamp(adiff(want, car.a), -1.2, 1.2) * 2.4 * dt;
        if (!nosing && !car.offroad && car.speed > 40) { G.reverseT = 0; G.stuckT = 0; }
      }

      car.drive(dt, IN.steer, G.reverseT > 0 ? -0.75 : 1);
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
        if (into > G.spec.crashV) {
          /* A hard wall is the mistake that pays nothing, but it must not be
             the main hull sink — hull is meant to read as fuel you spend on
             traffic, not as a tax on clipping a barrier while learning. */
          damage(Math.round(6 + into * 0.015), 'wall');
          hitstop(0.07, 26);
          NHAudio.hit(1.4);
          car.hitFlash = 1;
          G.chain = 0;
          if (G.pending > 0) bank();
          car.vx *= 0.55; car.vy *= 0.55;
          car.inv = 0.35;
          if (G.state !== 'play') return;
        } else {
          G.hp -= dt * 1.0;                    // scraping bleeds you slowly
          if (G.hp <= 0) { crash('wall'); return; }
          if (G.run.M.brittle) { G.chainT = 0; if (G.pending > 0) bank(); }
          else burnChain(dt * 1.6);
        }
      }
    }
    G.dist += car.speed * dt;

    /* ---- the chain clock ----
       With no drift button there is nothing to release, so the wager moved
       onto a timer. Every wreck resets it; let it run out and the whole
       pending bank pays automatically. The decision is no longer "when do I
       let go" but "can I reach one more car before this hits zero" — which
       is the same bet asked several times a minute instead of once. */
    const M = G.run.M;
    stepPowers(dt);
    if (G.chainT > 0 && !G.power.surge) {
      G.chainT = Math.max(0, G.chainT - dt);
      if (G.chainT === 0 && G.pending > 0) bank();
    }

    G.ghost = Math.max(0, G.ghost - dt);
    G.heat = Math.max(0, G.heat - dt * 0.038);
    G.tier = Math.max(G.run.cfg ? G.run.cfg.heatFloor + M.policeStart : 0, Math.floor(G.heat));
    G.tier = Math.min(3, G.tier);

    stepHazards(dt);
    stepAir(dt);
    stepConvoy(dt);
    if (G.boss) stepBoss(dt);

    /* reaching the checkpoint decides the district */
    if (G.run.cfg) {
      const travelled = car.idx - G.run.startIdx;
      if (travelled >= G.run.cfg.len) {
        /* Cash the chain before judging. Arriving at the checkpoint holding
           8,000 pending and being failed at 2,000/10,000 reads as the quota
           not counting your wrecks — you earned it, the clock just had not
           run out yet. */
        if (G.pending > 0) bank();
        if (G.state !== 'play') return;          // banking may have cleared it
        if (G.run.cfg.boss) failDistrict('The unit got away');
        else if (G.run.banked >= G.run.quota) clearDistrict();
        else failDistrict('Quota missed');
        return;
      }
    }
  }

  /* ---- traffic ---- */
  G.hitCool = Math.max(0, G.hitCool - dt);
  G.hurt = Math.max(0, (G.hurt || 0) - dt * 2.5);
  for (let i = G.traffic.length - 1; i >= 0; i--) {
    const t = G.traffic[i];
    /* a wrecked car is debris: it coasts and spins, it does not drive */
    if (t.wrecked) {
      t.a += t.spin * dt;
      t.spin *= Math.exp(-1.2 * dt);
      t.vx *= Math.exp(-0.9 * dt); t.vy *= Math.exp(-0.9 * dt);
      t.x += t.vx * dt; t.y += t.vy * dt;
      t.hitFlash = Math.max(0, t.hitFlash - dt * 3);
      if (t.idx < car.idx - 24) { G.traffic.splice(i, 1); }
      continue;
    }
    autoDrive(t, dt * G.worldSlow, false);
    if (t.idx < car.idx - 24 || t.idx > car.idx + 120) { G.traffic.splice(i, 1); continue; }

    const dx = t.x - car.x, dy = t.y - car.y, d = hyp(dx, dy);
    /* Half the sum of the lengths — the distance at which two bodies actually
       touch nose to tail. An earlier 0.36 put it at 33px for two 46px cars, so
       the player drove clean through traffic and the whole verb never fired. */
    const touchR = (t.spec.len + car.spec.len) * 0.52;
    if (playing && !G.ai) {
      if (d < touchR && !t.wrecked && G.hitCool <= 0) {
        /* Traffic is the ammunition. Hitting it pays, feeds the chain and
           costs hull — the run ends when the hull does, not on contact. */
        smash(t, hyp(t.vx - car.vx, t.vy - car.vy));
      } else if (d < 118 && !t.nearFlag && !t.wrecked && car.speed > 260) {
        t.nearFlag = true;
        const M = G.run.M;
        if (G.chain >= 1) {
          /* Threading buys time, not links. It pays thin and puts a slice of
             the clock back, which is how you carry a chain across a gap in
             the traffic when your hull cannot afford another wreck. */
          const bonus = 130 * G.mult * M.nearMul;
          G.pending += bonus;
          G.chainT = Math.min(chainTime(), G.chainT + 0.45 + M.nearChain);
          toast('Threaded +' + fmt(bonus), 'pink');
          NHAudio.nearMiss();
        }
        if (M.nearTop) car.topBonus += M.nearTop;
      }
      if (d > 140) t.nearFlag = false;
    }
  }
  /* Count only cars you can still hit. Wrecked ones linger in the array as
     debris until you have driven past them, and counting those against the
     budget thinned the road exactly when a chain was going well — the
     opposite of what a pile-up should do to the supply. */
  let liveCount = 0;
  for (const t of G.traffic) if (!t.wrecked) liveCount++;
  const want = Math.max(4, Math.round(26 * (G.run ? G.run.M.trafficMul : 1)));
  while (liveCount < want) { addTraffic(rint(20, 96)); liveCount++; }

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
    p.boostT = Math.max(p.boostT, 0.2);
    p.drive(dt * G.worldSlow, st, 1);
    barrier(p, loc);

    if (playing && !G.ai) {
      const dx = p.x - car.x, dy = p.y - car.y, d = hyp(dx, dy);
      if (!lost && car.inv <= 0 && d < (p.spec.len + car.spec.len) * 0.36) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        car.vx -= nx * 240; car.vy -= ny * 240;
        p.vx += nx * 120; p.vy += ny * 120;
        G.shake = Math.max(G.shake, 18);
        car.hitFlash = 1;
        burnChain(1.0);
        G.heat = Math.max(0, G.heat - 0.25);
        damage(16, 'police');
        hitstop(0.05, 20);
        NHAudio.hit(1);
        car.inv = 0.45;
        toast('Rammed', 'red');
      }
    }
    if (p.idx < car.idx - 40) G.police.splice(i, 1);
  }

  /* ---- crash sequence ---- */
  if (G.state === 'crash') {
    G.crashT += dt;
    G.slow = damp(G.slow, 0.22, 4, dt);
    G.car.drive(dt, 0, 0);
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
  ctx.fillStyle = TH.ground;
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
  ctx.fillStyle = TH.asphalt;
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
    ctx.strokeStyle = hexA(side < 0 ? TH.left : TH.right, 0.10);
    ctx.lineWidth = 90;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  /* wet asphalt throws long reflections of the barrier neon */
  if (LVL().wet) {
    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const p = pts[i];
        const hw = roadHalf(p) * side * 0.62;
        if (i === a) ctx.moveTo(p.x - Math.sin(p.a) * hw, p.y + Math.cos(p.a) * hw);
        else ctx.lineTo(p.x - Math.sin(p.a) * hw, p.y + Math.cos(p.a) * hw);
      }
      ctx.strokeStyle = hexA(side < 0 ? TH.left : TH.right, 0.13);
      ctx.lineWidth = 46;
      ctx.setLineDash([70, 34]);
      ctx.lineDashOffset = -(G.dist * 0.35) % 104;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

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
    const col = side < 0 ? TH.left : TH.right;
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
    const fade = clamp(Math.min(h.life, 1.6) / 1.6, 0, 1);
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
      ctx.fillStyle = i % 2 ? (bd.face1 || '#141A2D') : (bd.face2 || '#0F1424');
      ctx.fill();

      if (bd.lit && QF.windows && !LVL().blackout) {
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
    if (bd.lit && !LVL().blackout) {
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
  const dark = LVL().blackout;
  const fog = ctx.createLinearGradient(0, 0, 0, camY() * 0.84);
  fog.addColorStop(0,    dark ? 'rgba(5,6,14,0.95)' : 'rgba(5,6,14,0.72)');
  fog.addColorStop(0.45, dark ? 'rgba(5,6,14,0.62)' : 'rgba(5,6,14,0.30)');
  fog.addColorStop(1,    'rgba(5,6,14,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, camY() * 0.84);
}

function drawLamps(){
  if (LVL().blackout) return;          // the power is out, that is the point
  const [a, b] = visibleRange();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = a; i <= b; i++) {
    const p = G.track.pts[i];
    if (!p.lamp) continue;
    for (const side of [-1, 1]) {
      const x = p.x - Math.sin(p.a) * (roadHalf(p) + 16) * side;
      const y = p.y + Math.cos(p.a) * (roadHalf(p) + 16) * side;
      blitGlow(side < 0 ? TH.left : TH.right, x, y, 46, 46, 0.30);
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



/* The three new toys, drawn in world space under the vehicles. */
function drawToys(){
  /* --- singularities: a dark eye with a collapsing ring --- */
  for (const w of G.wells) {
    const fade = clamp(w.t / 1.2, 0, 1);
    ctx.save();
    ctx.translate(w.x, w.y);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 230);
    g.addColorStop(0, 'rgba(10,4,24,' + (0.9 * fade).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(176,124,255,' + (0.26 * fade).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(176,124,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 230, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA('#B07CFF', 0.75 * fade);
    for (let k = 0; k < 3; k++) {
      const rr = 200 - ((w.r * 90 + k * 66) % 200);
      ctx.lineWidth = 2 + k;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(6,2,14,0.95)';
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* --- arc welder: a jagged bolt between two wrecks --- */
  if (G.arcs.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const a of G.arcs) {
      const f = clamp(a.t / 0.22, 0, 1);
      const dx = a.bx - a.ax, dy = a.by - a.ay;
      const n = 7;
      for (const [wd, col] of [[7, hexA('#7FE9FF', 0.22 * f)], [2.4, hexA('#EAFBFF', 0.95 * f)]]) {
        ctx.lineWidth = wd;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(a.ax, a.ay);
        for (let i = 1; i < n; i++) {
          const t = i / n;
          /* deterministic jitter per bolt, so it does not crawl each frame */
          const j = Math.sin((a.ax + i * 37.7) * 0.11) * 26 * Math.sin(t * Math.PI);
          ctx.lineTo(a.ax + dx * t - dy / (hyp(dx, dy) || 1) * j,
                     a.ay + dy * t + dx / (hyp(dx, dy) || 1) * j);
        }
        ctx.lineTo(a.bx, a.by);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* --- escort drones: the beam, then the airframe --- */
  if (G.power.drones > 0 && G.drones.length) {
    for (const dr of G.drones) {
      ctx.save();
      if (dr.target && !dr.target.wrecked) {
        const heat = clamp(dr.dwell / BEAM_DWELL, 0, 1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = hexA('#5BFFC9', 0.16 + heat * 0.22);
        ctx.lineWidth = 8 + heat * 7;
        ctx.beginPath(); ctx.moveTo(dr.x, dr.y);
        ctx.lineTo(dr.target.x, dr.target.y); ctx.stroke();
        ctx.strokeStyle = hexA('#EAFFF7', 0.85 + heat * 0.15);
        ctx.lineWidth = 1.6 + heat * 2.2;
        ctx.beginPath(); ctx.moveTo(dr.x, dr.y);
        ctx.lineTo(dr.target.x, dr.target.y); ctx.stroke();
        /* the burn mark grows as the beam dwells, so you can see it working */
        blitGlow('#5BFFC9', dr.target.x, dr.target.y, 40 + heat * 70, 40 + heat * 70, 0.5 + heat * 0.4);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalCompositeOperation = 'lighter';
      blitGlow('#5BFFC9', dr.x, dr.y, 76, 76, 0.42);
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(dr.x, dr.y);
      ctx.rotate(G.car.a);
      ctx.fillStyle = '#0E2A22';
      ctx.strokeStyle = '#5BFFC9';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(13, 0); ctx.lineTo(-8, 9); ctx.lineTo(-3, 0); ctx.lineTo(-8, -9);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = hexA('#5BFFC9', 0.4);
      ctx.lineWidth = 1.2;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(-1, sgn * 10, 10, 3, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* --- scavenger: a small courier with whatever it is carrying --- */
  if (G.lastingScav > 0 && G.scav) {
    const s = G.scav;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    blitGlow(s.hold ? s.hold.col : '#FF9ED2', s.x, s.y, 74, 74, 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#2A0E20';
    ctx.strokeStyle = s.hold ? s.hold.col : '#FF9ED2';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, 11, 0, TAU); ctx.fill(); ctx.stroke();
    if (s.hold) {
      ctx.fillStyle = s.hold.col;
      ctx.font = '800 13px ui-sans-serif,system-ui,-apple-system,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.hold.glyph, s.x, s.y + 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  /* --- wrecking ball: chain links, then the iron --- */
  if (G.power.ball > 0 && G.ball) {
    const car = G.car, b = G.ball;
    const dx = b.x - car.x, dy = b.y - car.y;
    const links = 9;
    ctx.save();
    ctx.strokeStyle = 'rgba(190,200,220,.85)';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < links; i++) {
      const t0 = i / links, t1 = (i + 0.62) / links;
      ctx.beginPath();
      ctx.moveTo(car.x + dx * t0, car.y + dy * t0);
      ctx.lineTo(car.x + dx * t1, car.y + dy * t1);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    blitGlow('#FF8A3D', b.x, b.y, 130, 130, 0.55);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(b.x - 9, b.y - 9, 3, b.x, b.y, 34);
    g.addColorStop(0, '#6B4A2E');
    g.addColorStop(0.6, '#2A1C12');
    g.addColorStop(1, '#120B07');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = hexA('#FF8A3D', 0.9);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }
}

/* Power-ups read as hovering plates: a spinning diamond, a hard glyph and a
   pool of their own colour on the asphalt so they are visible from far
   enough back to change lanes for. */
function drawPickups(){
  for (const k of G.pickups) {
    const kind = k.kind;
    const bob = 1 + Math.sin(k.spin * 1.7) * 0.08;
    ctx.save();
    ctx.translate(k.x, k.y);

    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 54);
    g.addColorStop(0, 'rgba(' + kind.rgb + ',0.38)');
    g.addColorStop(1, 'rgba(' + kind.rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.rotate(k.spin);
    ctx.scale(bob, bob);
    ctx.beginPath();
    ctx.moveTo(0, -19); ctx.lineTo(19, 0); ctx.lineTo(0, 19); ctx.lineTo(-19, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,10,20,0.85)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = kind.col;
    ctx.stroke();

    /* the glyph stays upright — a spinning letter is unreadable */
    ctx.rotate(-k.spin);
    ctx.fillStyle = kind.col;
    ctx.font = '800 20px ui-sans-serif,system-ui,-apple-system,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(kind.glyph, 0, 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}

/* A chase you cannot see is just a random shove. Anything hunting you that
   is off screen gets a chevron pinned to the edge, pointing at it. */
function drawThreats(){
  if (G.state !== 'play' && G.state !== 'crash') return;
  const live = G.convoy.filter(v => !v.wrecked);
  const list = (G.boss ? G.police.concat([G.boss]) : G.police).concat(live);
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

/* The stick is invisible until you touch, then it shows exactly where it
   anchored and what it is reading — otherwise a target-free control is a
   control you cannot learn. */
function drawStick(){
  if (!swipeMode() || !GS.on || G.state !== 'play') return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const r = gsMaxX();

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  ctx.strokeStyle = hexA(CL.cyan, 0.40);
  ctx.beginPath(); ctx.arc(GS.ax, GS.ay, r, 0, TAU); ctx.stroke();

  /* horizontal track: the only axis left, now that steering is the whole
     control surface */
  ctx.strokeStyle = hexA(CL.cyan, 0.22);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(GS.ax - r, GS.ay); ctx.lineTo(GS.ax + r, GS.ay);
  ctx.stroke();

  /* the dot is where your thumb is; the tick is what the car is being given,
     which after the response curve is not the same place */
  const px = GS.ax + GS.raw * r;
  const tx = GS.ax + GS.steer * r;
  ctx.strokeStyle = hexA(CL.cyan, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(GS.ax, GS.ay); ctx.lineTo(px, GS.ay); ctx.stroke();

  ctx.strokeStyle = hexA(CL.magenta, 0.75);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx, GS.ay - 11); ctx.lineTo(tx, GS.ay + 11);
  ctx.stroke();

  blitGlow(CL.cyan, px, GS.ay, 26, 26, 0.55);
  ctx.fillStyle = CL.cyan;
  ctx.beginPath(); ctx.arc(px, GS.ay, 9, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

/* Streaks pulled from the edges toward the centre. Cheap, and the single
   clearest read of speed a top-down camera can give. */
let streaks = null;
function drawSpeed(){
  if (G.state !== 'play' && G.state !== 'crash') return;
  const sp = G.car ? G.car.speed : 0;
  const t = clamp((sp - 430) / 420, 0, 1) * (G.car && G.car.boost ? 1.35 : 1);
  if (t < 0.04) return;
  if (!streaks) {
    streaks = Array.from({ length: 46 }, () => ({
      a: Math.random() * TAU, r: 0.42 + Math.random() * 0.72, l: 0.1 + Math.random() * 0.3,
      s: 0.6 + Math.random() * 0.9
    }));
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const cx = W / 2, cy = camY(), R = hyp(W, H) * 0.62;
  const phase = (G.dist * 0.0016);
  for (const s of streaks) {
    const f = ((s.r + phase * s.s) % 1.1);
    const r0 = R * f, r1 = R * (f + s.l * t);
    const ca = Math.cos(s.a), sa = Math.sin(s.a);
    ctx.strokeStyle = 'rgba(190,232,255,' + (0.10 * t * Math.min(1, f * 2.2)).toFixed(3) + ')';
    ctx.lineWidth = 1.6 + t * 2;
    ctx.beginPath();
    ctx.moveTo(cx + ca * r0, cy + sa * r0);
    ctx.lineTo(cx + ca * r1, cy + sa * r1);
    ctx.stroke();
  }
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
  /* the hull talks: a red rim on damage, and a permanent one when critical */
  /* Taking a hit is now the thing you do on purpose several times a minute,
     so the tell has to stay a rim. Held wide and thin it reads as pressure;
     flooded to the middle of the screen it just hides the road. */
  const crit = G.state === 'play' && G.hp / G.hpMax < 0.3
    ? 0.19 + Math.sin(performance.now() / 180) * 0.07 : 0;
  const rim = Math.max((G.hurt || 0) * 0.30, crit);
  if (rim > 0.02) {
    const g = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.46, W/2, H/2, Math.max(W,H)*0.62);
    g.addColorStop(0, 'rgba(255,40,60,0)');
    g.addColorStop(1, 'rgba(255,40,60,' + rim.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function render(){
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = TH.ground;
  ctx.fillRect(0, 0, cv.width, cv.height);

  applyCam();
  drawGround();
  drawRoad();
  drawSkids();
  drawLamps();
  drawHazards();
  drawToys();
  drawPickups();
  for (const t of G.traffic) drawVehicle(t, { lights:false });
  for (const v of G.convoy) drawVehicle(v, { lights:true });
  for (const p of G.police) drawVehicle(p);
  if (G.boss) drawVehicle(G.boss);
  drawVehicle(G.car);
  drawParticles();

  if (QF.city) drawCity();
  bloom();
  drawSpeed();
  drawThreats();
  drawStick();
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
const UI = {
  hud:$('hud'), score:$('score'), coins:$('coins'),
  combo:$('combo'), cmult:$('cmult'), cpts:$('cpts'), cfill:$('cfill'),
  heat:$('heat'), spd:$('spd'), powers:$('powers'), toasts:$('toasts'),
  menu:$('menu'), over:$('over'), garage:$('garage'),
  brief:$('brief'), draft:$('draft'),
  map:$('map'), contract:$('contract'), depot:$('depot'), mapBuild:$('mapBuild'),
  daily:$('daily'), board:$('board'),
  hull:$('hull'), hullVal:$('hullVal'), hullFill:$('hullFill'), wreck:$('wreckChain'),
  obj:$('obj'), objLbl:$('objLbl'), objVal:$('objVal'), objFill:$('objFill'),
  objDist:$('objDist'), objPend:$('objPend'), dchip:$('dchip'), build:$('build'),
  convoy:$('convoy'), convoyLeft:$('convoyLeft')
};
const heatPips = UI.heat.querySelectorAll('i');


/* Active effects, rebuilt only when the set of them changes — this runs
   every frame and the DOM is the expensive part. */
let powerSig = '';
function syncPowers(){
  const list = [];
  if (G.car && G.car.boostT > 0) list.push(['boost', 'Boost', G.car.boostT]);
  if (G.power.shield > 0)        list.push(['shield', 'Ram Plate', G.power.shield]);
  if (G.power.surge > 0)         list.push(['surge', 'Surge', G.power.surge]);
  if (G.power.magnet > 0)        list.push(['magnet', 'Magnet', G.power.magnet]);
  if (G.power.frenzy > 0)        list.push(['frenzy', 'Frenzy', G.power.frenzy]);
  if (G.power.slowmo > 0)        list.push(['slowmo', 'Adrenaline', G.power.slowmo]);
  if (G.power.ball > 0)          list.push(['ball', 'Wrecking Ball', G.power.ball]);
  if (G.power.arc > 0)           list.push(['arc', 'Arc Welder', G.power.arc]);
  if (G.power.drones > 0)        list.push(['drones', 'Escort Drones', G.power.drones]);
  if (G.rockets > 0)             list.push(['rockets', 'Bazooka', G.rockets, 1]);
  if (G.lastingPlate > 0)        list.push(['plating', 'Reinforced', 0, 2]);
  if (G.lastingClock > 0)        list.push(['clock', 'Overclock', 0, 2]);
  if (G.lastingPayday > 0)       list.push(['payday', 'Payday', 0, 2]);
  if (G.lastingScav > 0)         list.push(['scav', 'Scavenger', 0, 2]);
  if (G.missileT > 0)            list.push(['rack', 'Harpoon', G.missileT]);

  const sig = list.map(l => l[0]).join(',');
  if (sig !== powerSig) {
    powerSig = sig;
    UI.powers.innerHTML = list.map(l =>
      '<div class="pwr ' + l[0] + '"><span>' + l[1] + '</span><b></b></div>').join('');
  }
  const nodes = UI.powers.children;
  for (let i = 0; i < list.length; i++) {
    if (!nodes[i]) continue;
    const kind = list[i][3] || 0;
    /* 0 = seconds, 1 = a count of shots, 2 = runs to the end of the district */
    nodes[i].lastChild.textContent = kind === 2 ? 'level'
                                   : kind === 1 ? '\u00d7' + list[i][2]
                                   : list[i][2].toFixed(1) + 's';
  }
}

let shownScore = 0;
function syncHUD(){
  shownScore = lerp(shownScore, G.score, 0.2);
  UI.score.textContent = fmt(shownScore);
  UI.coins.textContent = fmt(Save.data.coins + G.coinsRun);
  UI.spd.textContent = Math.round(G.car.speed * 0.52);
  syncPowers();

  const active = G.pending > 0 || G.chain > 0;
  UI.combo.classList.toggle('on', active);
  UI.combo.classList.toggle('hot', G.mult > 5);
  UI.cmult.innerHTML = '&times;' + G.mult.toFixed(1);
  UI.cpts.textContent = fmt(G.pending);
  /* the bar is the clock now, not the multiplier: it is the thing you are
     racing, and it has to be readable at a glance while cornering */
  const frac = G.chainMax > 0 ? clamp(G.chainT / G.chainMax, 0, 1) : 0;
  UI.cfill.style.width = (G.power.surge > 0 ? 100 : frac * 100) + '%';
  UI.combo.classList.toggle('urgent', G.chainT > 0 && frac < 0.34 && !G.power.surge);

  /* hull */
  const hf = clamp(G.hp / G.hpMax, 0, 1);
  UI.hull.classList.toggle('on', G.state === 'play' || G.state === 'crash');
  UI.hull.classList.toggle('warn', hf < 0.6 && hf >= 0.3);
  UI.hull.classList.toggle('crit', hf < 0.3);
  UI.hullVal.textContent = Math.max(0, Math.ceil(G.hp));
  UI.hullFill.style.width = hf * 100 + '%';
  UI.wreck.classList.toggle('on', G.chain > 1);
  if (G.chain > 1) UI.wreck.textContent = G.chain + ' car pile-up';

  const chasing = G.convoyState === 'live' && G.convoyLeft > 0;
  UI.convoy.classList.toggle('on', chasing);
  if (chasing) UI.convoyLeft.textContent = G.convoyLeft;

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
      /* A ghost segment for the pending bank. Without it the bar sits dead
         still through a ten-second chain and the quota looks broken. */
      const ghost = clamp((run.banked + G.pending) / run.quota, 0, 1) * 100;
      UI.objPend.style.width = ghost + '%';
      UI.obj.classList.toggle('pending', G.pending > 0);
    }
    const travelled = clamp((G.car.idx - run.startIdx) / cfg.len, 0, 1);
    UI.objDist.style.width = travelled * 100 + '%';
  }
}

/* the build rail — a roguelite is unreadable if you cannot see your own deck */
function renderBuild(target){
  const el = target || UI.build;
  const run = G.run;
  if (!run) { el.innerHTML = ''; return; }
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
  el.innerHTML = html || '<i style="opacity:.5">No chips yet</i>';
}

/* The pads overlay the whole stage, so they must only exist while driving —
   otherwise they sit on top of the draft cards and swallow taps. */
function syncTouch(){
  touchEl.classList.toggle('on', hasTouch && !swipeMode() && G.state === 'play');
  if (swipeMode()) {
    touch.left = touch.right = 0;
    /* a wreck or a cleared district must not leave the stick latched */
    if (G.state !== 'play' && GS.on) gsReset();
  }
}

function show(el){ el.classList.remove('hide'); }
function hide(el){ el.classList.add('hide'); }

function toMenu(){
  G.state = 'menu';
  G.run = null;
  newWorld(true);
  show(UI.menu); hide(UI.over); hide(UI.garage);
  hide(UI.map); hide(UI.contract); hide(UI.depot); hide(UI.brief); hide(UI.draft);
  hide(UI.daily); hide(UI.board);
  UI.hud.classList.add('off');
  $('menuBest').textContent = 'District ' + (Save.data.deepest || 1) +
    (Save.data.best ? '  ·  ' + fmt(Save.data.best) : '');
}

function startRun(){
  hide(UI.menu); hide(UI.over); hide(UI.garage); hide(UI.draft);
  G.run = newRun();
  G.score = 0; G.topMult = 1; G.coinsRun = 0; G.revived = false; G.totalWreck = 0;
  shownScore = 0;
  showMap();
}

/* ============================================================
   MAP SCREEN
   ============================================================ */
function showMap(){
  const run = G.run;
  G.state = 'map';
  UI.hud.classList.add('off');
  hide(UI.draft); hide(UI.contract); hide(UI.depot); hide(UI.brief);
  $('mAct').textContent = run.act;
  $('mTitle').textContent = THEMES[(run.act - 1) % THEMES.length].name;
  $('mScore').textContent = fmt(G.score);
  $('mCleared').textContent = run.cleared;
  renderBuild(UI.mapBuild);
  show(UI.map);
  requestAnimationFrame(drawRoute);   // needs layout before it can measure
}

function nodePos(row, col, w, h){
  const rows = G.run.route;
  const padY = h * 0.09 + 34;
  /* row 0 sits at the bottom, the boss at the top */
  const y = h - padY - (row / (ROWS - 1)) * (h - padY * 2);
  const n = rows[row].length;
  /* Spread by how many nodes the row holds rather than across the full
     width — two nodes pinned to the screen edges left a dead middle and
     made the branches hard to trace. */
  const spread = n === 1 ? 0 : n === 2 ? 0.54 : 0.76;
  const t = n === 1 ? 0.5 : col / (n - 1);
  return { x: w / 2 + (t - 0.5) * w * spread, y };
}

function drawRoute(){
  const run = G.run;
  if (!run || G.state !== 'map') return;
  const board = $('mapBoard');
  const w = board.clientWidth, h = board.clientHeight;
  if (!w || !h) { requestAnimationFrame(drawRoute); return; }

  const open = openNodes();
  const isOpen = (r, c) => open.some(o => o.row === r && o.col === c);

  const wrap = $('mapNodes');
  wrap.innerHTML = '';
  run.route.forEach((row, r) => row.forEach((node, c) => {
    const p = nodePos(r, c, w, h);
    const here = run.row === r && run.col === c;
    const can = isOpen(r, c);
    const el = document.createElement('button');
    el.className = 'mnode ' + node.type +
      (can ? ' open' : '') + (node.done ? ' done' : '') + (here ? ' here' : '');
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.dataset.rc = r + ',' + c;
    el.disabled = !can;
    /* A pin carries the kind at a glance; the two lines under it carry the
       decision. Icons alone are what makes Slay the Spire's map hard to
       comb — the fix is icon plus colour plus size, not icon alone. */
    el.innerHTML =
      `<span class="pin"><i>${NODE_ICON[node.type]}</i></span>` +
      `<span class="plabel">` +
        `<span class="pname">${node.name}</span>` +
        `<span class="pmeta"><b>${nodeReward(node)}</b>` +
        `${node.quota ? '<em>' + fmt(node.quota) + (node.heat ? ' · H+' + node.heat : '') + '</em>'
                      : '<em>no driving</em>'}</span>` +
      `</span>`;
    if (can) el.onclick = () => enterNode(r, c);
    wrap.appendChild(el);
  }));

  /* keep every pin and its label inside the board */
  const box = {};
  [...wrap.children].forEach(el => {
    const half = el.offsetWidth / 2 + 6;
    el.style.left = clamp(parseFloat(el.style.left), half, w - half) + 'px';
    /* The element is a column of pin-then-label centred on (x,y), so its
       own top and bottom are what the routes must connect to. Anchoring to
       the pin instead sent every line straight through the label below it. */
    box[el.dataset.rc] = { x: parseFloat(el.style.left),
                           top: parseFloat(el.style.top) - el.offsetHeight / 2,
                           bot: parseFloat(el.style.top) + el.offsetHeight / 2 };
  });

  /* Routes are drawn as street runs — up, across, up — with rounded
     corners, rather than diagonals. Right angles are far easier to trace
     than crossing straight lines, and a city is the right metaphor. */
  const svg = $('mapLines');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  let paths = '';
  for (let r = 0; r < ROWS - 1; r++) {
    const lanes = run.route[r].length;
    run.route[r].forEach((node, c) => {
      const A = box[r + ',' + c];
      (node.next || []).forEach(nc => {
        const B = box[(r + 1) + ',' + nc];
        if (!A || !B) return;
        const cls = (run.row === r && run.col === c && isOpen(r + 1, nc)) ? 'open'
                  : (node.done && run.route[r + 1][nc].done) ? 'taken' : '';
        const y1 = A.top - 4, y2 = B.bot + 4;
        /* stagger the crossbar per source lane so parallel runs do not stack */
        const mid = y1 + (y2 - y1) * (0.42 + (lanes > 1 ? c / lanes : 0) * 0.22);
        const dx = B.x - A.x;
        let d;
        if (Math.abs(dx) < 6) {
          d = `M${A.x},${y1} L${B.x},${y2}`;
        } else {
          const k = Math.min(18, Math.abs(dx) / 2, Math.abs(y1 - mid), Math.abs(mid - y2));
          const sx = Math.sign(dx);
          d = `M${A.x},${y1} L${A.x},${mid + k}` +
              ` Q${A.x},${mid} ${A.x + sx * k},${mid}` +
              ` L${B.x - sx * k},${mid}` +
              ` Q${B.x},${mid} ${B.x},${mid - k}` +
              ` L${B.x},${y2}`;
        }
        paths += `<path d="${d}" class="${cls}"/>`;
      });
    });
  }
  svg.innerHTML = paths;
}
addEventListener('resize', () => { if (G.state === 'map') drawRoute(); });

/* ============================================================
   ENTERING A NODE
   ============================================================ */
function enterNode(row, col){
  const run = G.run;
  run.row = row; run.col = col;
  run.node = run.route[row][col];
  NHAudio.ui(true);
  hide(UI.map);
  if (run.node.type === 'depot') showDepot();
  else showContract();
}

/* ---- contract: the boon/bane wager taken before driving ---- */
function showContract(){
  const run = G.run;
  const elite = run.node.type === 'elite';
  const boss  = run.node.type === 'boss';
  G.state = 'contract';
  G.offers = NHChips.rollContracts(run.district + 1, elite || boss);

  $('cKicker').className = 'ckicker' + (elite || boss ? ' elitek' : '');
  $('cKicker').textContent = boss ? 'Pursuit inbound' : elite ? 'High risk dispatch' : 'Dispatch';
  $('cSub').textContent = boss
    ? 'Terms still apply while it hunts you'
    : 'Choose the terms you drive under';

  const wrap = $('cCards');
  wrap.innerHTML = '';
  G.offers.forEach((k, i) => {
    const el = document.createElement('button');
    el.className = 'ccard r' + k.risk;
    el.innerHTML =
      '<div class="crisk">Risk' +
        [0,1,2].map(n => '<i class="' + (n < k.risk ? 'on' : '') + '"></i>').join('') +
      '</div>' +
      '<div class="cname">' + k.name + '</div>' +
      '<div class="cline bane"><b>Bane</b><span>' + k.bane + '</span></div>' +
      '<div class="cline boon"><b>Boon</b><span>' + k.boon + '</span></div>' +
      '<div class="cpay">Clears into ' + (k.risk >= 2 ? 'a rare chip' : k.risk === 1 ? 'an upgraded draft' : 'a standard draft') + '</div>';
    el.onclick = () => takeContract(i);
    wrap.appendChild(el);
  });
  show(UI.contract);
}

function takeContract(i){
  const k = G.offers[i];
  if (!k) return;
  G.run.contract = k.id;
  NHAudio.chip();
  hide(UI.contract);
  beginNode();
}

/* ---- depot: repair the build instead of scoring ---- */
function showDepot(){
  const run = G.run;
  G.state = 'depot';
  const wrap = $('depotCards');
  wrap.innerHTML = '';

  const opts = [];
  opts.push({
    name: 'Salvage rack', risk: 0,
    bane: 'You bank nothing here.',
    boon: 'Fit a chip from four, no driving.',
    pay: 'Free chip',
    go(){
      hide(UI.depot);
      run.node.done = true;
      showDraft(4, false, () => { advance(); });
    }
  });
  if (run.curses.length) {
    opts.push({
      name: 'Strip a curse', risk: 0,
      bane: 'You bank nothing here.',
      boon: 'Cut one curse out of your build for good.',
      pay: run.curses.length + ' fitted',
      go(){
        const gone = run.curses.pop();
        run.M = NHChips.build(run.chips, run.curses).M;
        G.car.mods = run.M;
        toast('Stripped ' + NHChips.curseById(gone).name, 'gold');
        NHAudio.clear();
        hide(UI.depot);
        run.node.done = true;
        advance();
      }
    });
  }
  opts.push({
    name: 'Push on', risk: 1,
    bane: 'Nothing repaired.',
    boon: 'Skip ahead and keep the heat off.',
    pay: 'No cost',
    go(){ hide(UI.depot); run.node.done = true; advance(); }
  });

  opts.forEach(o => {
    const el = document.createElement('button');
    el.className = 'ccard r' + o.risk;
    el.innerHTML =
      '<div class="crisk">Service</div>' +
      '<div class="cname">' + o.name + '</div>' +
      '<div class="cline bane"><b>Cost</b><span>' + o.bane + '</span></div>' +
      '<div class="cline boon"><b>Gain</b><span>' + o.boon + '</span></div>' +
      '<div class="cpay">' + o.pay + '</div>';
    el.onclick = () => { NHAudio.ui(true); o.go(); };
    wrap.appendChild(el);
  });
  show(UI.depot);
}

/* ---- start the district described by the current node + contract ---- */
function beginNode(){
  const run = G.run;
  /* the node's own number, not a counter — see makeRoute */
  run.district = run.node.district;
  run.cfg = districtCfg(run.district, run.node.type, run.act);

  const built = NHChips.build(run.chips, run.curses, run.contract);
  run.M = built.M; run.L = built.L;
  /* hardware is applied after chips so it reads as the floor you start from */
  if (Hangar.has('prow')) { run.M.wreckMul += 0.25; run.M.hullCost *= 0.80; }
  run.M.wreckMul *= (G.spec.wreckMul || 1);          // the Impact track
  run.quota = Math.round(run.cfg.quota * run.L.quotaMul);
  run.banked = 0;
  run.crumpleLeft = run.M.crumple;

  newWorld(false);
  run.startIdx = G.car.idx;
  G.car.topBonus = 0;
  G.heat = run.cfg.heatFloor + run.M.policeStart;
  G.tier = Math.min(3, Math.floor(G.heat));
  if (run.L.hazards) seedHazards();

  showBrief();
}

/* Roadworks scatters strips across the district up front, so the bane is
   visible from the first corner rather than sprung on you later. */
function seedHazards(){
  for (let i = 0; i < 26; i++) {
    const idx = G.car.idx + 40 + i * 14 + rint(-5, 5);
    const p = G.track.at(idx, rnd(-0.72, 0.72) * roadHalf(G.track.pts[Math.min(idx, G.track.pts.length - 1)]));
    G.hazards.push({ x:p.x, y:p.y, a:p.a, life:9999, hit:0 });
  }
}

/* advance the marker and go back to the board */
function advance(){
  const run = G.run;
  if (run.row >= ROWS - 1) { nextAct(); return; }
  showMap();
}

function nextAct(){
  const run = G.run;
  if (run.act >= 3) { G.crashReason = 'Run complete'; endRun(true); return; }
  run.act++;
  setTheme(run.act);
  run.route = makeRoute(run.act);
  run.row = -1; run.col = -1; run.node = null;
  toast('Act ' + run.act, 'gold');
  showMap();
}

function showBrief(){
  const cfg = G.run.cfg;
  G.state = 'brief';
  UI.hud.classList.add('off');
  $('bkicker').textContent = cfg.boss ? 'Pursuit unit' : 'District ' + cfg.n;
  $('bname').textContent = cfg.name;
  $('bobj').innerHTML = cfg.boss
    ? cfg.bossDef.blurb + '<br><b>Bank into it until its integrity breaks.</b>'
    : 'Wreck traffic and bank <b>' + fmt(G.run.quota) + '</b> before the checkpoint.';
  const k = NHChips.contractById(G.run.contract);
  $('bsub').textContent = (cfg.boss ? cfg.bossDef.sub : cfg.elite ? 'Elite run' : 'Standard run') +
    (k && k.id !== 'clear' ? '  ·  ' + k.name : '');
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
  if (swipeMode() && G.run.district === 1) {
    const el = $('gsHint');
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 5200);
  }
}

function clearDistrict(){
  if (G.state !== 'play') return;
  const run = G.run;
  run.cleared++;
  if (run.node) run.node.done = true;
  G.pending = 0; G.chain = 0; G.mult = 1;
  UI.hud.classList.add('off');
  NHAudio.clear();
  G.flash = 0.5;

  /* the wager pays out here: risk and node type set the draft quality */
  const k = NHChips.contractById(run.contract);
  const risk = k ? k.risk : 0;
  const rare = risk >= 2 || run.node.type === 'elite' || run.node.type === 'boss';
  showDraft(risk >= 1 ? 4 : 3, rare, () => advance());
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
let draftDone = null;
function showDraft(count, rareBias, done){
  const run = G.run;
  G.state = 'draft';
  draftDone = done || (() => advance());
  G.offers = NHChips.roll(run.chips, run.district, run.curses, count || 3, !!rareBias);
  const wrap = $('dcards');
  wrap.innerHTML = '';
  $('dsub').textContent = rareBias
    ? 'Hazard pay — the good stuff'
    : 'District ' + run.district + ' cleared — ' + fmt(run.banked) + ' banked';
  wrap.style.gridTemplateColumns = 'repeat(' + Math.min(G.offers.length, 4) + ',1fr)';

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
  if (!offer || G.state !== 'draft') return;
  const run = G.run;
  run.chips.push(offer.chip.id);
  if (offer.curse) { run.curses.push(offer.curse.id); NHAudio.curse(); }
  else NHAudio.chip();
  run.M = NHChips.build(run.chips, run.curses).M;
  hide(UI.draft);
  const cb = draftDone; draftDone = null;
  if (cb) cb();
}

function endRun(won){
  G.state = 'over';
  hide(UI.map); hide(UI.contract); hide(UI.depot); hide(UI.draft); hide(UI.brief);
  const isBest = G.score > Save.data.best;
  if (isBest) { Save.data.best = G.score; Ads.celebrate(); }
  const reached = G.run ? G.run.district : 1;
  if (reached > (Save.data.deepest || 0)) Save.data.deepest = reached;
  /* clearing districts is the achievement, so it pays on top of raw score */
  G.coinsRun = Math.floor((G.score / 80 + (G.run ? G.run.cleared * 90 : 0)) * G.spec.payout);
  Save.data.runs++;
  Save.flush();
  const rank = recordRun();

  /* the run ends when the hull does, so the kicker names the last straw */
  const kick = G.crashReason === 'traffic' ? 'Hull gone'
             : G.crashReason === 'wall' ? 'Into the wall'
             : G.crashReason || 'Busted';
  $('ovKicker').textContent = kick;
  $('ovKicker').textContent = won ? 'City cleared' : kick;
  $('ovRank').textContent = G.run
    ? 'Act ' + G.run.act + '  ·  ' + G.run.cleared + ' districts cleared'
    : '';
  $('ovScore').textContent = fmt(G.score);
  $('ovBest').textContent = fmt(Save.data.best);
  $('ovCombo').innerHTML = '&times;' + G.topMult.toFixed(1);
  $('ovWrecks').textContent = fmt(G.totalWreck);
  $('ovCoins').textContent = fmt(G.coinsRun);
  $('ovBadge').classList.toggle('hide', !isBest);
  /* a rank is a more useful thing to see than a badge you may never earn */
  $('ovPlace').textContent = rank ? 'Personal best #' + rank : 'Outside your top ' + BOARD_MAX;
  $('ovPlace').classList.toggle('in', !!rank);
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
function setMute(){
  const b = $('btnMute');
  b.textContent = NHAudio.isSilenced() ? 'Sound off' : 'Sound on';
  /* if the site muted us, the in-game toggle cannot override it */
  b.disabled = NHAudio.isForced();
  b.title = NHAudio.isForced() ? 'Muted from the CrazyGames page' : '';
}
$('btnMute').onclick   = e => { e.stopPropagation(); NHAudio.toggleMute(); setMute(); };
function setCtrlLabel(){
  $('btnCtrl').textContent = Save.data.ctrl === 'pads' ? 'Controls: pads' : 'Controls: swipe';
}
function setEngineLabel(){
  const on = Save.data.engineSfx !== 0;
  NHAudio.setEngine(on);
  $('btnEngine').textContent = on ? 'Engine on' : 'Engine off';
}
$('btnEngine').onclick = e => {
  e.stopPropagation();
  Save.data.engineSfx = Save.data.engineSfx === 0 ? 1 : 0;
  Save.flush(); setEngineLabel(); NHAudio.ui(true);
};
$('btnCtrl').onclick = e => {
  e.stopPropagation();
  Save.data.ctrl = Save.data.ctrl === 'pads' ? 'swipe' : 'pads';
  Save.flush(); setCtrlLabel(); NHAudio.ui(true);
};
$('btnGo').onclick     = () => beginDistrict();
$('btnDaily').onclick  = () => { NHAudio.ui(true); closeDaily(); };
$('btnPlay').onclick   = () => {
  NHAudio.resume();
  if (Hangar.grantStarter()) toast('Ram Prow fitted — on the house', 'gold');
  if (dailyReady() && Save.data.runs > 0) { hide(UI.menu); claimDaily(); }
  else toGarage();
};
$('btnAgain').onclick  = () => { commitCoins(1); toGarage(); };
$('btnMenu').onclick   = () => { commitCoins(1); toMenu(); };
$('btnGarage').onclick = () => toGarage();
$('btnRecords').onclick = () => { NHAudio.ui(true); showBoard('menu'); };
$('btnOvBoard').onclick = () => { NHAudio.ui(true); showBoard('over'); };
$('btnBdBack').onclick  = () => { NHAudio.ui(true); closeBoard(); };
$('btnBack').onclick   = () => { hide(UI.garage); toMenu(); };
$('btnRace').onclick   = () => { hide(UI.garage); startRun(); };

$('btnRevive').onclick = () => {
  Ads.rewarded('Reviving your run', ok => {
    if (!ok) return;
    hide(UI.over);
    G.revived = true;
    G.state = 'play';
    G.run.crumpleLeft = Math.max(G.run.crumpleLeft, G.run.M.crumple);
    UI.hud.classList.remove('off');

    /* A revive has to undo the thing that actually killed you. It used to do
       neither: the hull was left on zero, so the next scrape ended the run
       again, and a quota miss put you back down *past* the checkpoint, which
       re-fired the same failure on the following frame. Two kinds of death,
       two different repairs. */
    G.hp = Math.max(G.hp, Math.round(G.hpMax * 0.6));
    G.hurt = 0;
    const ranOutOfRoad = G.crashReason === 'Quota missed' || G.crashReason === 'The unit got away';
    if (ranOutOfRoad && G.run.cfg) {
      /* buy road, because road is what you were short of. max() so this can
         only ever extend the district, never shorten it. */
      const travelled = G.car.idx - G.run.startIdx;
      G.run.cfg.len = Math.max(G.run.cfg.len,
                               Math.round(travelled + G.run.cfg.len * 0.5));
      toast('Checkpoint pushed back', 'gold');
    }
    G.crashReason = '';
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
/* Only the bay draws this now, and it draws it at roughly 8x, so the stroke
   has to be expressed in pre-scale units or the outline reads as a cartoon. */
function previewCar(g, v, sc){
  const s = v.spec;
  const lw = 2.6 / (sc || 1);
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
  g.strokeStyle = hexA(s.col, 0.95); g.lineWidth = lw; g.stroke();
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

/* Safari shipped roundRect late; without this the whole bay throws on an
   older iPhone rather than losing a few corner radii. */
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r){
    const k = Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + k, y);
    this.arcTo(x + w, y,     x + w, y + h, k);
    this.arcTo(x + w, y + h, x,     y + h, k);
    this.arcTo(x,     y + h, x,     y,     k);
    this.arcTo(x,     y,     x + w, y,     k);
    this.closePath();
    return this;
  };
}


/* ============================================================
   DAILY
   The reason to open the tab tomorrow. Paid on the calendar day rather than
   a rolling 24h timer, so it never drifts later and later; a streak that
   survives one missed day, because punishing a single miss is how you lose
   the player who was going to come back on Wednesday.
   ============================================================ */
const DAILY_BASE = 900;
function todayKey(){
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function yesterdayKey(){
  const d = new Date(Date.now() - 864e5);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function dailyReady(){ return Save.data.lastDaily !== todayKey(); }
function dailyAmount(streak){
  /* climbs for a week, then plateaus — an unbounded ramp only rewards the
     player who was never going to quit anyway */
  return DAILY_BASE * Math.min(7, streak);
}

function claimDaily(){
  if (!dailyReady()) return;
  const streak = Save.data.lastDaily === yesterdayKey() ? Save.data.dailyStreak + 1 : 1;
  const amount = dailyAmount(streak);
  Save.data.dailyStreak = streak;
  Save.data.lastDaily = todayKey();
  Save.data.coins += amount;
  Save.flush();
  NHAudio.bank(3);
  $('dayAmount').textContent = fmt(amount);
  $('dayStreak').textContent = streak === 1 ? 'Day one' : 'Day ' + streak + ' in a row';
  $('dayNext').textContent = streak < 7
    ? 'Tomorrow: ' + fmt(dailyAmount(streak + 1))
    : 'Maximum daily reached';
  show(UI.daily);
  G.state = 'daily';
}

function closeDaily(){
  hide(UI.daily);
  toGarage();
}


/* ============================================================
   RECORDS
   CrazyGames' leaderboard is a *server-to-server* API: scores are posted
   from your own backend with a secret key. This game is one HTML file with
   no backend, and shipping that key in the bundle would hand it to anyone
   who opens devtools — so there is no global board here, and pretending
   otherwise would be worse than not having one.

   What there is instead is a real board of your own runs, which is the part
   that actually drives "one more go": a visible ladder, a rank on the
   game-over screen, and a row you are trying to beat. `submitScore` is the
   single seam a backend would plug into later.
   ============================================================ */
const BOARD_MAX = 10;

function boardRows(){
  if (!Array.isArray(Save.data.board)) Save.data.board = [];
  return Save.data.board;
}

/* Returns the 1-based rank if the run made the board, otherwise 0. */
function recordRun(){
  const rows = boardRows();
  const entry = {
    s: Math.round(G.score),
    d: G.run ? G.run.district : 1,
    a: G.run ? G.run.act : 1,
    w: G.totalWreck,
    m: +G.topMult.toFixed(1),
    t: Date.now(),
    who: Ads.playerName || ''
  };
  rows.push(entry);
  rows.sort((x, y) => y.s - x.s);
  if (rows.length > BOARD_MAX) rows.length = BOARD_MAX;
  Save.data.board = rows;
  Save.flush();
  submitScore(entry);
  /* remember the exact entry so the board can point at it — comparing on
     score alone ties whenever two runs land on the same number */
  G.lastEntryT = entry.t;
  const rank = rows.indexOf(entry);
  return rank < 0 ? 0 : rank + 1;
}

/* The seam. A backend would POST to leaderboard.crazygames.com from the
   server side; from here there is nowhere safe to send it. */
function submitScore(entry){ /* no backend — see the note above */ }

function relDay(t){
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + 'd ago';
}

function showBoard(from){
  const rows = boardRows();
  const wrap = $('bdRows');
  wrap.innerHTML = rows.length
    ? rows.map((r, i) =>
        '<div class="bdRow' + (r.t === G.lastEntryT ? ' me' : '') + '">' +
          '<span class="bdN">' + (i + 1) + '</span>' +
          '<span class="bdS">' + fmt(r.s) + '</span>' +
          '<span class="bdD">District ' + r.d + '</span>' +
          '<span class="bdW">' + fmt(r.w) + ' wrecked</span>' +
          '<span class="bdT">' + relDay(r.t) + '</span>' +
        '</div>').join('')
    : '<div class="bdEmpty">No runs on the board yet. Go and put one there.</div>';
  $('bdWho').textContent = Ads.playerName ? Ads.playerName : 'Your runs';
  G.boardFrom = from;
  hide(UI.menu); hide(UI.over);
  show(UI.board);
  G.state = 'board';
}

function closeBoard(){
  hide(UI.board);
  if (G.boardFrom === 'over') { G.state = 'over'; show(UI.over); }
  else toMenu();
}

/* ============================================================
   THE BAY
   A garage should look like a bay with your car in it, not like a form with
   the car's statistics in it. So the left half is a rendered deck — plates,
   oil, work lights, tyre marks — with the actual car on it wearing every
   piece of hardware you have bought. Buying a part changes the picture, which
   is the only reason to have a picture at all.
   ============================================================ */
let bayT = 0, bayRAF = 0;

function drawBay(){
  const cvs = $('gCanvas');
  if (!cvs || G.state !== 'garage') { bayRAF = 0; return; }
  const g = cvs.getContext('2d');
  /* size the backing store from the element, capped — this is a still life,
     it does not need retina pixels on a 4K monitor */
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cw = Math.max(120, Math.round(cvs.clientWidth * dpr));
  const ch = Math.max(120, Math.round(cvs.clientHeight * dpr));
  if (cvs.width !== cw || cvs.height !== ch) { cvs.width = cw; cvs.height = ch; }
  const W = cvs.width, H = cvs.height;
  const spec = G.spec || activeSpec();
  bayT += 1 / 60;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);

  /* --- deck: poured concrete in bay-sized plates --- */
  g.fillStyle = '#0B0E16';
  g.fillRect(0, 0, W, H);
  const PL = Math.round(H * 0.115);
  g.strokeStyle = 'rgba(150,175,215,.055)';
  g.lineWidth = 1;
  for (let x = 0; x <= W; x += PL) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += PL) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  /* stains and swarf — deterministic, so the floor does not crawl */
  g.save();
  for (let i = 0; i < 26; i++) {
    const r = (i * 9301 + 49297) % 233280 / 233280;
    const r2 = (i * 4517 + 7919) % 104729 / 104729;
    const x = r * W, y = r2 * H, rad = 10 + r2 * 46;
    g.globalAlpha = 0.05 + r * 0.05;
    g.fillStyle = i % 3 ? '#000' : '#1B2438';
    g.beginPath(); g.ellipse(x, y, rad, rad * (0.4 + r * 0.5), r * 3, 0, TAU); g.fill();
  }
  g.restore();

  /* --- hazard chevrons marking the bay mouth --- */
  g.save();
  g.globalAlpha = 0.16;
  const CH = Math.round(H * 0.062), CD = Math.round(H * 0.046);
  for (let x = -H; x < W + H; x += CH * 2) {
    g.fillStyle = '#FFB13D';
    g.beginPath();
    g.moveTo(x, H); g.lineTo(x + CH, H - CD); g.lineTo(x + CH * 2, H - CD); g.lineTo(x + CH, H);
    g.closePath(); g.fill();
  }
  g.restore();

  const cx = W / 2, cy = H * 0.54;

  /* --- two overhead work lights, converging on the car --- */
  const flick = 0.94 + Math.sin(bayT * 11) * 0.015 + Math.sin(bayT * 3.3) * 0.045;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const lx = cx + side * W * 0.30;
    const lg = g.createLinearGradient(lx, 0, cx + side * W * 0.06, cy + 120);
    lg.addColorStop(0, 'rgba(180,225,255,' + (0.13 * flick).toFixed(3) + ')');
    lg.addColorStop(1, 'rgba(120,190,255,0)');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(lx - 26, 0); g.lineTo(lx + 26, 0);
    g.lineTo(cx + side * W * 0.14, cy + 150);
    g.lineTo(cx + side * W * 0.02, cy + 150);
    g.closePath(); g.fill();
  }
  /* the pool the car actually sits in */
  const pool = g.createRadialGradient(cx, cy, 8, cx, cy, W * 0.46);
  pool.addColorStop(0, 'rgba(190,230,255,' + (0.16 * flick).toFixed(3) + ')');
  pool.addColorStop(0.55, 'rgba(120,190,255,0.05)');
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = pool;
  g.beginPath(); g.ellipse(cx, cy, W * 0.46, H * 0.30, 0, 0, TAU); g.fill();
  g.restore();

  /* tyre marks leading out of the bay */
  g.save();
  g.globalAlpha = 0.16;
  g.strokeStyle = '#000'; g.lineCap = 'round';
  for (const off of [-46, 46]) {
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(cx + off, cy + 90);
    g.bezierCurveTo(cx + off * 1.3, cy + 150, cx + off * 2.2, cy + 190, cx + off * 3.4, H);
    g.stroke();
  }
  g.restore();

  /* --- the car ---
     Sized to actually fill the bay: it is the subject of the screen, not an
     illustration next to the numbers. */
  const sc = Math.min(W / (spec.wid * 3.6), H / (spec.len * 1.7));
  g.save();
  g.translate(cx, cy);
  g.scale(sc, sc);
  g.rotate(-Math.PI / 2);          // nose up the screen

  /* contact shadow */
  g.save();
  g.globalAlpha = 0.5;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(-spec.len * 0.04, spec.wid * 0.10, spec.len * 0.62, spec.wid * 0.62, 0, 0, TAU);
  g.filter = 'blur(6px)';
  g.fill();
  g.restore();

  previewCar(g, { spec }, sc);
  drawFitted(g, spec, sc);
  g.restore();

  bayRAF = requestAnimationFrame(drawBay);
}

/* Hardware, drawn onto the car in the order it bolts on. Every dimension is a
   fraction of the body so a part cannot end up bigger than the car, and every
   stroke is divided by the bay scale so it stays a panel line. */
function drawFitted(g, s, sc){
  const has = id => Hangar.has(id);
  const lw = 2.2 / (sc || 1);
  g.lineJoin = 'round';
  g.lineWidth = lw;

  if (has('shockplate')) {                       // flank plates, riveted
    const th = s.wid * 0.085;
    for (const side of [-1, 1]) {
      g.fillStyle = '#1B2334';
      g.strokeStyle = hexA(CL.cyan, 0.55);
      g.beginPath();
      g.roundRect(-s.len * 0.30, side * s.wid * 0.50 - th / 2, s.len * 0.62, th, th * 0.4);
      g.fill(); g.stroke();
      g.fillStyle = hexA(CL.cyan, 0.55);
      for (let i = 0; i < 5; i++)
        g.beginPath(),
        g.arc(-s.len * 0.24 + i * s.len * 0.13, side * s.wid * 0.50, th * 0.22, 0, TAU),
        g.fill();
    }
  }

  if (has('prow')) {                             // ram bar across the nose
    const th = s.len * 0.045;
    g.fillStyle = '#232C40';
    g.strokeStyle = hexA(CL.amber, 0.9);
    g.beginPath();
    g.roundRect(s.len * 0.50, -s.wid * 0.58, th, s.wid * 1.16, th * 0.35);
    g.fill(); g.stroke();
    for (const y of [-0.36, 0, 0.36]) {           // struts back to the body
      g.beginPath();
      g.roundRect(s.len * 0.41, y * s.wid - s.wid * 0.035, s.len * 0.10, s.wid * 0.07, 1);
      g.fill(); g.stroke();
    }
  }

  if (has('turbine')) {                          // bonnet scoop
    g.fillStyle = '#0E1421';
    g.strokeStyle = hexA(CL.cyan, 0.75);
    g.beginPath();
    g.moveTo(s.len * 0.30, -s.wid * 0.19);
    g.lineTo(s.len * 0.13, -s.wid * 0.25);
    g.lineTo(s.len * 0.13, s.wid * 0.25);
    g.lineTo(s.len * 0.30, s.wid * 0.19);
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = hexA(CL.cyan, 0.4);
    for (let i = 0; i < 3; i++) {
      const x = s.len * (0.17 + i * 0.045);
      g.beginPath(); g.moveTo(x, -s.wid * 0.20); g.lineTo(x, s.wid * 0.20); g.stroke();
    }
  }

  if (has('welder')) {                           // gas bottle strapped to the deck
    g.fillStyle = '#26382C';
    g.strokeStyle = 'rgba(47,224,138,.85)';
    g.beginPath();
    g.roundRect(-s.len * 0.42, -s.wid * 0.36, s.len * 0.17, s.wid * 0.26, s.wid * 0.06);
    g.fill(); g.stroke();
    g.strokeStyle = 'rgba(47,224,138,.45)';      // hose, coiled once
    g.beginPath();
    g.moveTo(-s.len * 0.34, -s.wid * 0.10);
    g.quadraticCurveTo(-s.len * 0.24, s.wid * 0.02, -s.len * 0.30, s.wid * 0.16);
    g.stroke();
  }

  if (has('missile')) {                          // twin launch tubes on the roof
    const th = s.wid * 0.10;
    for (const side of [-1, 1]) {
      g.fillStyle = '#191F30';
      g.strokeStyle = hexA(CL.magenta, 0.85);
      g.beginPath();
      g.roundRect(-s.len * 0.10, side * s.wid * 0.30 - th / 2, s.len * 0.38, th, th * 0.45);
      g.fill(); g.stroke();
      g.fillStyle = hexA(CL.magenta, 0.9);
      g.beginPath(); g.arc(s.len * 0.26, side * s.wid * 0.30, th * 0.34, 0, TAU); g.fill();
    }
  }

  if (has('blackbox')) {                         // box and whip aerial on the boot
    g.fillStyle = '#0E1420';
    g.strokeStyle = hexA(CL.ice, 0.7);
    g.beginPath();
    g.roundRect(-s.len * 0.44, s.wid * 0.10, s.len * 0.12, s.wid * 0.22, s.wid * 0.04);
    g.fill(); g.stroke();
    g.strokeStyle = hexA(CL.cyan, 0.8);
    g.beginPath();
    g.moveTo(-s.len * 0.38, s.wid * 0.21);
    g.lineTo(-s.len * 0.38, s.wid * 0.60);
    g.stroke();
    g.fillStyle = hexA(CL.cyan, 0.9);
    g.beginPath(); g.arc(-s.len * 0.38, s.wid * 0.60, s.wid * 0.035, 0, TAU); g.fill();
  }
}

function renderGarage(){
  const bal = Save.data.coins;
  const spec = G.spec = activeSpec();
  $('gCoins').textContent = fmt(bal);

  /* --- the spec plate: what is actually fitted, in units --- */
  $('gPlate').innerHTML = UPGRADES.map(u => {
    const lvl = Save.data.up[u.id];
    return '<div class="gpRow"><span>' + u.name + '</span>' +
           '<i>' + Array.from({ length:UP_MAX }, (_, k) =>
             '<b class="' + (k < lvl ? 'on' : '') + '"></b>').join('') + '</i>' +
           '<em>' + u.read(lvl) + '</em></div>';
  }).join('');

  /* --- tuning --- */
  const ups = $('gUps');
  ups.innerHTML = '';
  let upLvl = 0;
  for (const u of UPGRADES) {
    const lvl = Save.data.up[u.id];
    upLvl += lvl;
    const maxed = lvl >= UP_MAX;
    const cost = upCost(u, lvl);
    const afford = bal >= cost;
    const el = document.createElement('div');
    el.className = 'up' + (maxed ? ' maxed' : '');
    el.innerHTML =
      '<div class="info">' +
        '<div class="nm">' + u.name + '<em>' + u.read(lvl) + '</em></div>' +
        '<div class="pips">' + Array.from({ length:UP_MAX }, (_, i) =>
          '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join('') + '</div>' +
      '</div>' +
      '<button ' + (maxed || !afford ? 'disabled' : '') + '>' +
        (maxed ? 'Max' : fmt(cost)) + '</button>';
    el.querySelector('button').onclick = () => {
      if (maxed || Save.data.coins < cost) return;
      Save.data.coins -= cost;
      Save.data.up[u.id]++;
      Save.flush();
      NHAudio.ui(true);
      G.spec = activeSpec();
      renderGarage();
    };
    ups.appendChild(el);
  }
  $('gwUps').textContent = upLvl + ' / ' + (UPGRADES.length * UP_MAX);

  /* --- hardware: the part that makes a lost run worth something --- */
  const gear = $('gGear');
  gear.innerHTML = '';
  for (const g of GEAR) {
    const owned = Hangar.has(g.id);
    const broke = !owned && bal < g.price;
    const el = document.createElement('div');
    el.className = 'gear' + (owned ? ' owned' : '') + (broke ? ' broke' : '');
    el.setAttribute('role', 'button');
    el.tabIndex = owned ? -1 : 0;
    el.innerHTML =
      '<div class="nm">' + g.name + '</div>' +
      '<div class="ds">' + g.desc + '</div>' +
      '<div class="pr">' + (owned ? 'Fitted' : fmt(g.price)) +
        (broke ? '<em>short ' + fmt(g.price - bal) + '</em>' : '') + '</div>';
    const buy = () => {
      if (owned) return;
      if (!Hangar.buy(g.id)) {
        toast('Short ' + fmt(g.price - Save.data.coins) + ' coins', 'red');
        NHAudio.ui(false);
        return;
      }
      toast(g.name + ' fitted', 'gold');
      NHAudio.ui(true);
      renderGarage();
    };
    el.onclick = buy;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buy(); } };
    gear.appendChild(el);
  }
  $('gwGear').textContent = Save.data.gear.length + ' / ' + GEAR.length;

  /* what is bolted on, listed under the car so the render has a legend */
  $('gFitted').innerHTML = GEAR.filter(g => Hangar.has(g.id)).length
    ? GEAR.filter(g => Hangar.has(g.id))
        .map(g => '<i>' + g.name + '</i>').join('')
    : '<i class="none">Nothing fitted</i>';
}

/* The garage sits *between* runs rather than off to one side: a run that
   ended badly still earned coins, and this is where they turn into a
   better next attempt. Everything routes through here. */
function toGarage(){
  hide(UI.menu); hide(UI.over); hide(UI.map); hide(UI.draft); hide(UI.brief);
  hide(UI.daily); hide(UI.board);
  G.state = 'garage';
  show(UI.garage);
  renderGarage();
  if (!bayRAF) bayRAF = requestAnimationFrame(drawBay);
}

/* ============================================================
   LOOP
   ============================================================ */
let last = performance.now();
let ftAvg = 16, workAvg = 8, ftN = 0, demoted = false, tuneAt = 0;

/* Trade pixels for frames until we hold the budget. Resolution is the first
   lever because it is continuous and nearly invisible; dropping effects is
   the last resort, once there is no resolution left to give.

   Two signals, because neither alone is sufficient. Frame delta says whether
   we are missing the target, but it is clamped by vsync — on a 60Hz display
   a perfect frame still reads 16.7ms, so it can never indicate headroom.
   Work time (what we actually spend in step + render) is vsync-independent
   and is what tells us it is safe to give resolution back. */
function autoTune(now){
  if (now < tuneAt) return;
  const missing = ftAvg > 19.5;                    // below ~51fps
  const roomy   = ftAvg < 18 && workAvg < 6.5;     // hitting vsync, cheaply

  if (missing && renderScale > 0.5) {
    /* Come down in proportion to how far off budget we are, not in a fixed
       step. A machine at 12fps needs four fixed steps and nearly five seconds
       of visible chop to reach a scale it can hold — and those five seconds
       are the first thing the player sees. Since cost goes with area, the
       scale that would hit the target is roughly sqrt(target/actual), and
       overshooting down is cheap because the climb back is gentle and
       continuous. Badly-over cases also re-check sooner.  */
    const want = renderScale * Math.sqrt(16.7 / Math.max(17, ftAvg));
    const stepped = renderScale - 0.09;
    renderScale = clamp(Math.min(stepped, want), 0.5, 1);
    applyBackingStore();
    tuneAt = now + (ftAvg > 28 ? 320 : 700);
  } else if (missing && !demoted) {
    setQuality('low'); demoted = true;
    tuneAt = now + 1200;
  } else if (roomy && renderScale < 1) {
    renderScale = Math.min(1, renderScale + 0.05);
    applyBackingStore();
    tuneAt = now + 1400;              // creep back up slowly to avoid hunting
  }
}

function frame(now){
  const raw = Math.min(0.033, (now - last) / 1000);
  const ms = now - last;
  last = now;
  const workT0 = performance.now();

  adTick(raw);
  const live = !adCb && !G.paused;
  /* Hitstop. Freezing the simulation for a few frames on impact is what
     turns a collision from a number change into a punch. */
  if (G.freeze > 0) { G.freeze -= raw; }
  else if (live) step(raw * G.slow);
  Ads.gameplay(live && G.state === 'play');

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

  workAvg = workAvg * 0.9 + (performance.now() - workT0) * 0.1;
  ftAvg   = ftAvg   * 0.9 + Math.min(ms, 120) * 0.1;
  if (++ftN > 40) autoTune(now);

  requestAnimationFrame(frame);
}

/* ?muteAudio=true is CrazyGames' documented way to test this locally */
try {
  if (/[?&]muteAudio=true/i.test(location.search)) NHAudio.setSiteMute(true);
} catch (e) {}

Ads.boot();
resize();
newWorld(true);
hide(UI.brief); hide(UI.draft); hide(UI.map); hide(UI.contract); hide(UI.depot);
hide(UI.daily); hide(UI.board);
setCtrlLabel();
setEngineLabel();
setMute();
if (hasTouch) $('btnCtrl').classList.add('show');
toMenu();
requestAnimationFrame(frame);

/* debug handle for tuning passes and automated playtests */
window.__NH = {
  G, cam, CARS, Save, QF, setQuality, startRun, toMenu, GS, IN, Ads, setPause,
  get renderScale(){ return renderScale; }, get ftAvg(){ return ftAvg; },
  get workAvg(){ return workAvg; },
  beginDistrict, takeOffer, districtCfg, showDraft, bank, showMap, enterNode,
  takeContract, openNodes, advance,
  get offers(){ return G.offers; },
  setTheme, theme: () => ({ id:TH.id, name:TH.name, asphalt:TH.asphalt, left:TH.left }),
  endRun, showBoard, recordRun, failDistrict, damage,
  POWERS, takePickup, chainTimeProbe: () => chainTime(), smash,
  GSdebug: () => ({ raw:+GS.raw.toFixed(3), steer:+GS.steer.toFixed(3) })
};
})();
