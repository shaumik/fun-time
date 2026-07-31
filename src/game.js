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
      if (!this.data.tree || typeof this.data.tree !== 'object') this.data.tree = {};
      if (!Array.isArray(this.data.liveries)) this.data.liveries = [];
      if (typeof this.data.livery !== 'string') this.data.livery = 'stock';
    } catch (e) { /* storage blocked — run in-memory */ }
  },
  flush(){
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
  }
};
Save.load();


/* ============================================================
   HANGAR — permanent hardware
   The perks you take inside a run are wiped when the run ends. This is the
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
  { id:'missile',    name:'Harpoon Rack',  price:9000,
    desc:'Auto-fires every 9s: detonates the nearest car ahead, free.' },
  { id:'shockplate', name:'Shock Plating', price:14000,
    desc:'Every fifth link in a chain detonates everything around you.' },
  { id:'blackbox',   name:'Black Box',     price:22000,
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
   CREW — the permanent skill tree
   Hardware changes a verb; the crew shifts the odds. Three doctrines,
   fifteen nodes over twenty ranks, ~160k coins to finish — the long-term
   sink the six hardware items alone could not carry, and every rank is
   felt in-run.
   ============================================================ */
const TREE = [
  { id:'t_prow',   br:'offense', name:'Sharpened Prow',  ranks:3, cost:[1800, 4000, 9000],
    desc:'Wrecks pay +6% per rank.' },
  { id:'t_first',  br:'offense', name:'First Blood',     ranks:1, cost:[6000],
    desc:'The first wreck of every district counts as three links.' },
  { id:'t_salvo',  br:'offense', name:'Opening Salvo',   ranks:1, cost:[12000],
    desc:'Start every district with two rockets loaded.' },
  { id:'t_chain',  br:'offense', name:'Chain Reaction',  ranks:1, cost:[15000],
    desc:'Explosions reach 30% further.' },
  { id:'t_exec',   br:'offense', name:'Executioner',     ranks:1, cost:[22000],
    desc:'Banks hit bosses 25% harder; haulers lose one armour.' },
  { id:'t_armor',  br:'defense', name:'Scrap Armor',     ranks:3, cost:[1500, 3500, 8000],
    desc:'+8 max hull per rank.' },
  { id:'t_hands',  br:'defense', name:'Gentle Hands',    ranks:1, cost:[5000],
    desc:'Walls cost 40% less hull.' },
  { id:'t_cool',   br:'defense', name:'Cool Head',       ranks:1, cost:[10000],
    desc:'Below 30% hull, heat drains 40% faster.' },
  { id:'t_wind',   br:'defense', name:'Second Wind',     ranks:1, cost:[7500],
    desc:'Banking welds on 2 extra hull.' },
  { id:'t_cage',   br:'defense', name:'Safety Cage',     ranks:1, cost:[18000],
    desc:'Survive one fatal crash per run.' },
  { id:'t_change', br:'greed',   name:'Loose Change',    ranks:3, cost:[1200, 3000, 7000],
    desc:'+8% coins per rank.' },
  { id:'t_know',   br:'greed',   name:'Street Knowledge',ranks:1, cost:[8000],
    desc:'+15% XP from everything.' },
  { id:'t_int',    br:'greed',   name:'Compound Interest',ranks:1, cost:[9000],
    desc:'The daily drop pays half again.' },
  { id:'t_roller', br:'greed',   name:'High Roller',     ranks:1, cost:[20000],
    desc:'Heat pays +45% per tier instead of +35%.' },
  { id:'t_head',   br:'greed',   name:'Head Start',      ranks:1, cost:[25000],
    desc:'Every run starts at level 2 — perk in hand.' }
];
const Tree = {
  rank: id => (Save.data.tree || {})[id] || 0,
  has:  id => Tree.rank(id) > 0,
  buy(id){
    const t = TREE.find(x => x.id === id);
    if (!t) return false;
    const r = Tree.rank(id);
    if (r >= t.ranks || Save.data.coins < t.cost[r]) return false;
    Save.data.coins -= t.cost[r];
    if (!Save.data.tree) Save.data.tree = {};
    Save.data.tree[id] = r + 1;
    Save.flush();
    return true;
  },
  /* run-modifier ranks fold into the table exactly like hardware does */
  apply(M){
    M.wreckMul += 0.06 * Tree.rank('t_prow');
    if (Tree.has('t_chain') && M.cookR) M.cookR *= 1.3;
    if (Tree.has('t_exec')) M.convoyArmour = (M.convoyArmour || 0) + 1;
    if (Tree.has('t_wind')) M.bankHeal = (M.bankHeal || 0) + 2;
    M.wallMul = Tree.has('t_hands') ? 0.6 : 1;
  }
};

/* ---------------- liveries ----------------
   Palette pairs, zero new rendering: the body, the glow and the light
   ribbon all read their colour from the fitted livery. */
const LIVERIES = [
  { id:'stock', name:'Factory Cyan', price:0,     col:'#3DE8FF', col2:'#0A5A72', trail:'#3DE8FF' },
  { id:'ember', name:'Ember',        price:2000,  col:'#FF6B4A', col2:'#5A1508', trail:'#FF8A3D' },
  { id:'venom', name:'Venom',        price:3500,  col:'#2FE08A', col2:'#0B4A2C', trail:'#5BFFC9' },
  { id:'royal', name:'Royalty',      price:5000,  col:'#B07CFF', col2:'#3A1B6E', trail:'#C6A8FF' },
  { id:'ghost', name:'Ghost',        price:8000,  col:'#DCF6FF', col2:'#28536F', trail:'#FFFFFF' },
  { id:'gold',  name:'Solid Gold',   price:15000, col:'#FFD166', col2:'#6B4A08', trail:'#FFB13D' }
];
const Livery = {
  cur: () => LIVERIES.find(l => l.id === (Save.data.livery || 'stock')) || LIVERIES[0],
  owned: id => id === 'stock' || (Save.data.liveries || []).includes(id),
  buyOrWear(id){
    const l = LIVERIES.find(x => x.id === id);
    if (!l) return false;
    if (!Livery.owned(id)) {
      if (Save.data.coins < l.price) return false;
      Save.data.coins -= l.price;
      if (!Array.isArray(Save.data.liveries)) Save.data.liveries = [];
      Save.data.liveries.push(id);
    }
    Save.data.livery = id;
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

  /* The submitted build carries the SDK script tag; the shareable page has it
     stripped, because its CSP blocks external scripts. So the tag is a
     reliable "am I the CrazyGames build" test that costs no network. */
  onPlatform(){ return !!document.querySelector('script[src*="sdk.crazygames.com"]'); },

  /* Rewarded ads can be unavailable for reasons we cannot see in advance:
     they are switched off outright for the whole of Basic Launch, an ad
     blocker stops them everywhere, and fill is never guaranteed. CrazyGames
     is blunt about the consequence — "there should not be rewarded ad buttons
     without effect", and a game that leaves one there is rejected. So failures
     are counted, and once the offer has proved dead it is withdrawn from the
     UI for the session rather than left on screen doing nothing. */
  rewardFails: 0,
  rewardDead: false,
  /* One miss is bad luck and the player is told to try later; two is a
     platform that is not going to serve us. */
  noteRewardFail(){ if (++this.rewardFails >= 2) this.rewardDead = true; },
  rewardOffered(){
    if (!this.onPlatform()) return true;      // the off-platform demo simulates
    return this.ready && !this.rewardDead;
  },

  request(type, msg, simSecs, done){
    const rewardedAd = type === 'rewarded';
    if (!this.ready) {
      /* On-platform with no working SDK means an ad blocker ate the script.
         Do not mime an ad — a fake progress bar charges the player time for
         nothing — and do not hand over the reward either, because rewarding
         without an ad is not ours to do. Retire the offer instead, which is
         what their AdBlock rules actually ask for: the feature goes away and
         says why, and nothing about the rest of the game changes. */
      if (this.onPlatform()) {
        if (rewardedAd) { this.rewardFails = 2; this.rewardDead = true; }
        done(false);
        return;
      }
      simAd(msg, simSecs, () => done(true));
      return;
    }

    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      if (!ok && rewardedAd) this.noteRewardFail();
      adMute(false);
      adPause(false);
      done(ok);
    };
    /* Block the game for the duration of the request — their rules require
       that the player cannot progress while an ad is being fetched — but do
       NOT mute yet. Muting is deferred to adStarted on their instruction:
       the request may return nothing, and dipping the music for an ad that
       never appears is a glitch from the player's side. */
    adPause(true);
    /* if the network stalls and neither callback ever fires, do not
       leave the player staring at a frozen game */
    const guard = setTimeout(() => finish(false), 25000);

    try {
      this.sdk.ad.requestAd(type, {
        adStarted:  () => { adPause(true); adMute(true); },
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

/* Audio is ducked while an ad is actually on screen, and while the tab is
   away. It is deliberately *not* ducked merely because the game is blocked
   waiting on an ad request: CrazyGames asks that the music not dip for an ad
   the player may never be shown. */
let adMuted = false;
function applyDuck(){
  const away = pauseReasons.has('hidden') || pauseReasons.has('blur');
  NHAudio.duck(adMuted || away);
}
function adMute(on){
  if (adMuted === !!on) return;
  adMuted = !!on;
  applyDuck();
}

function setPause(reason, on){
  const before = pauseReasons.size > 0;
  if (on) pauseReasons.add(reason); else pauseReasons.delete(reason);
  const paused = pauseReasons.size > 0;
  applyDuck();                          // reasons can change without 0<->n
  if (before === paused) return;
  G.paused = paused;
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
    air:{ rgb:'190,160,255', rate:0.7, size:[2, 5], life:[0.5, 1.1], drift:-190 } },
  { id:'causeway', name:'The Causeway',
    /* the endless loop's storm front: pale lightning accents over near-black
       water, rain streaking hard across the road */
    ground:'#04070C', asphalt:'#0F1622', left:'#7FD4FF', right:'#FFE066',
    bldA:'#7FD4FF', bldB:'#FFE066', face1:'#0F1826', face2:'#091018',
    h:[70, 220], size:[90, 200], gap:0.55, lit:0.35, back:[140, 600],
    air:{ rgb:'150,190,220', rate:1.1, size:[2, 4], life:[0.3, 0.7], drift:240 } }
];
let TH = THEMES[0];
function setTheme(act){ TH = THEMES[(Math.max(1, act) - 1) % THEMES.length]; }

/* ---------------- zones ----------------
   The act picks the palette. The zone picks the *place*.

   Three acts meant three looks across a thirteen-district run, so by the
   fourth district the road was the same road repainted and the honest
   complaint — every level looks the same — was correct. A colour ramp is
   not a location. A zone owns the ground under the car, what stands beside
   it, what passes over it, how the barriers are built, how the road itself
   bends, and one rule the district plays by that is stated on the brief.

   Zones are overrides on top of the act theme rather than whole palettes, so
   an act still reads as one city: the docks stay amber and green whichever
   zone you are standing in. Four per act, and a district draws three of
   them — the road changes under you twice on the way to the checkpoint
   instead of being one texture from the line to the finish. */
const ZONES = [
  /* ---------------- act 1 — The Grid ---------------- */
  { id:'blocks', act:1, name:'Neon Blocks',
    blurb:'Tower blocks, clean lanes, nothing overhead.',
    floor:'grid', rail:'neon',
    bld:{ mode:'tower', h:[110, 480], size:[48, 118], gap:0.34, lit:0.80, back:[80, 400] },
    road:{ curve:0.062, straight:0.22, width:[245, 345] } },

  { id:'sodium', act:1, name:'Sodium Row',
    blurb:'Market arcade. Signage the whole way, and the crates are worth opening.',
    ground:'#0A0710', asphalt:'#1A1526', left:'#FFC24D', right:'#FF2E88',
    bldA:'#FFC24D', bldB:'#FF6EC7', face1:'#1D1626', face2:'#120D1B',
    floor:'slab', rail:'posts',
    bld:{ mode:'shed', h:[70, 190], size:[86, 176], gap:0.14, lit:0.92, back:[46, 140] },
    span:{ every:6, kind:'sign', h:150 },
    props:[{ kind:'mast', rate:0.16, back:[24, 60] }],
    road:{ curve:0.030, straight:0.42, width:[230, 300] },
    air:{ rgb:'255,190,120', rate:0.09, size:[3, 7], life:[1.2, 2.4], drift:-40 },
    rule:{ name:'Arcade', desc:'Twice as many power-ups on the road.',
           apply(M, L){ M.pickupRate += 1; } } },

  { id:'skyway', act:1, name:'The Skyway',
    blurb:'Elevated deck. Nothing either side of you but air.',
    ground:'#02030A', asphalt:'#151B2E', left:'#3DE8FF', right:'#FFC24D',
    floor:'void', rail:'posts',
    bld:{ mode:'none' },
    span:{ every:8, kind:'gantry', h:230 },
    road:{ curve:0.048, straight:0.30, width:[205, 262] },
    /* The deck is narrow because it is *generated* narrow — a rule that
       multiplied road width would snap the barriers sideways the frame you
       crossed the gate, so width belongs to the generator and never to a
       rule that switches on mid-district. */
    rule:{ name:'Open deck', desc:'Top speed +12%, and there is nowhere to put a wheel wrong.',
           apply(M, L){ M.topMul += 0.12; } } },

  { id:'glass', act:1, name:'Glasshouse',
    blurb:'Mirror plaza. Wide, bright, and it throws everything back at you.',
    ground:'#070B14', asphalt:'#101828', left:'#8FF0FF', right:'#C9A7FF',
    bldA:'#8FF0FF', bldB:'#C9A7FF', face1:'#101A2E', face2:'#0A1120',
    floor:'mirror', rail:'neon',
    bld:{ mode:'tower', h:[260, 720], size:[70, 150], gap:0.20, lit:0.96, back:[66, 300] },
    road:{ curve:0.026, straight:0.46, width:[300, 400] },
    rule:{ name:'Mirror plaza', desc:'The street runs wide, and threading a gap pays double.',
           apply(M, L){ M.nearMul += 1; } } },

  /* ---------------- act 2 — Sunken Docks ---------------- */
  { id:'wharf', act:2, name:'The Wharf',
    blurb:'Black water on both sides and a crane every hundred metres.',
    ground:'#04080C', asphalt:'#1B1A18',
    floor:'water', rail:'edge',
    bld:{ mode:'shed', h:[90, 240], size:[110, 240], gap:0.52, lit:0.40, back:[150, 560] },
    span:{ every:10, kind:'gantry', h:260 },
    props:[{ kind:'crane', rate:0.14, back:[60, 130] }],
    road:{ curve:0.040, straight:0.30, width:[240, 320] } },

  { id:'spillway', act:2, name:'The Spillway',
    blurb:'A drained flood channel. Concrete walls, standing water, no way off.',
    ground:'#080B0C', asphalt:'#22211E', left:'#2FE08A', right:'#2FE08A',
    floor:'wet', rail:'wall',
    bld:{ mode:'none' },
    span:{ every:12, kind:'rib', h:190 },
    road:{ curve:0.070, straight:0.14, width:[265, 360] },
    rule:{ name:'Standing water', desc:'Grip down 15%, and every bank pays +30%.',
           apply(M, L){ M.gripMul *= 0.85; M.bankMul += 0.30; L.wet = 1; } } },

  { id:'railyard', act:2, name:'Rail Yard',
    blurb:'Container stacks and live rails. The traffic here runs thick.',
    ground:'#0A0A09', asphalt:'#1D1C19', left:'#FFB13D', right:'#FF6B4A',
    bldA:'#FF6B4A', bldB:'#2FE08A', face1:'#241F17', face2:'#16130E',
    floor:'rail', rail:'chain',
    bld:{ mode:'stack', h:[60, 150], size:[70, 190], gap:0.10, lit:0.55, back:[40, 210] },
    props:[{ kind:'silo', rate:0.10, back:[70, 170] }],
    road:{ curve:0.026, straight:0.44, width:[235, 305] },
    rule:{ name:'Shunting yard', desc:'Half again the traffic — and it all pays.',
           apply(M, L){ M.trafficMul += 0.5; } } },

  { id:'cannery', act:2, name:'Cannery Row',
    blurb:'Tank farm under a service gantry. Sodium light and rust.',
    ground:'#0A0907', asphalt:'#1E1B16', left:'#FFB13D', right:'#9FE86C',
    bldA:'#FFB13D', bldB:'#9FE86C', face1:'#211D16', face2:'#14110C',
    floor:'dust', rail:'posts',
    bld:{ mode:'shed', h:[80, 210], size:[100, 210], gap:0.30, lit:0.55, back:[90, 380] },
    span:{ every:7, kind:'rib', h:170 },
    props:[{ kind:'tank', rate:0.18, back:[46, 150] }],
    road:{ curve:0.034, straight:0.36, width:[240, 320] },
    air:{ rgb:'170,160,140', rate:0.12, size:[10, 26], life:[1.6, 2.8], drift:34 } },

  /* ---------------- act 3 — The Undercity ---------------- */
  { id:'undercity', act:3, name:'The Undercity',
    blurb:'Stacked levels overhead. The sky here is somebody else’s floor.',
    floor:'slab', rail:'neon',
    bld:{ mode:'tower', h:[420, 900], size:[70, 150], gap:0.10, lit:0.92, back:[46, 190] },
    road:{ curve:0.056, straight:0.22, width:[240, 320] } },

  { id:'underpass', act:3, name:'Underpass 9',
    blurb:'Sealed tube. Ribs overhead, no windows, and only your lights.',
    ground:'#03030A', asphalt:'#151228', left:'#B07CFF', right:'#B07CFF',
    floor:'concrete', rail:'wall',
    bld:{ mode:'none' },
    span:{ every:4, kind:'rib', h:150 },
    road:{ curve:0.050, straight:0.26, width:[215, 268] },
    air:{ rgb:'190,160,255', rate:0.5, size:[2, 5], life:[0.5, 1.1], drift:-190 },
    rule:{ name:'Sealed tube', desc:'You drive on headlights — and threading pays double.',
           apply(M, L){ L.blackout = 1; M.nearMul += 1; } } },

  { id:'foundry', act:3, name:'Foundry Line',
    blurb:'Pour floor. Everything here is already on fire.',
    ground:'#0A0504', asphalt:'#1F1310', left:'#FF6B2A', right:'#FFD34A',
    bldA:'#FF6B2A', bldB:'#FFD34A', face1:'#231310', face2:'#150A08',
    floor:'dust', rail:'wall',
    bld:{ mode:'stack', h:[120, 340], size:[80, 200], gap:0.20, lit:0.80, back:[60, 260] },
    span:{ every:8, kind:'gantry', h:200 },
    props:[{ kind:'silo', rate:0.16, back:[54, 160] }],
    road:{ curve:0.038, straight:0.34, width:[230, 300] },
    air:{ rgb:'255,140,60', rate:0.6, size:[2, 6], life:[0.7, 1.5], drift:-120 },
    rule:{ name:'Pour floor', desc:'Wrecks cook off a beat after they land.',
           apply(M, L){ M.cook = M.cook || 0.8; M.cookR = Math.max(M.cookR, 150); } } },

  { id:'catacomb', act:3, name:'The Catacombs',
    blurb:'Support pylons in the dark. Miss one and you will know.',
    ground:'#030209', asphalt:'#121026', left:'#F2F6FF', right:'#B07CFF',
    bldA:'#F2F6FF', bldB:'#7FA6FF', face1:'#141031', face2:'#0A0819',
    floor:'void', rail:'posts',
    bld:{ mode:'pylon', h:[500, 1100], size:[26, 54], gap:0.06, lit:0.70, back:[30, 120] },
    road:{ curve:0.078, straight:0.10, width:[205, 262] },
    rule:{ name:'Pylon field', desc:'Barely two lanes of it — but the multiplier ceiling comes off.',
           apply(M, L){ M.multCap = Math.max(M.multCap, 18); } } }
];

const zoneById = id => ZONES.find(z => z.id === id) || ZONES[0];

/* A zone resolved against its act theme. Everything a generator or a draw
   pass reads about the world comes from one of these, never from TH directly
   — TH is only the act's fallback layer now. */
const envCache = new Map();
function zoneEnv(id){
  let e = envCache.get(id);
  if (e) return e;
  const z = zoneById(id);
  const base = THEMES[(Math.max(1, z.act) - 1) % THEMES.length];
  e = Object.assign({}, base, z);
  e.bld = Object.assign({ mode:'tower', h:base.h, size:base.size, gap:base.gap,
                          lit:base.lit, back:base.back }, z.bld || {});
  e.span = z.span || null;
  e.props = z.props || null;
  e.road = Object.assign({ curve:0.062, straight:0.22, width:[245, 345] }, z.road || {});
  e.air = ('air' in z) ? z.air : base.air;
  envCache.set(id, e);
  return e;
}

/* Three zones for a district, in the order you drive through them. Drawn
   without replacement so a district never doubles back on a look it has
   already shown you, and seeded off the act so acts stay distinct. */
function pickZones(act, count){
  const pool = ZONES.filter(z => z.act === ((act - 1) % 3) + 1).map(z => z.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rint(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}

/* The env under the camera, crossfaded so passing a gate does not snap the
   ground colour a frame after the arch clears the windscreen. */
function envNow(){ return G.env || zoneEnv('blocks'); }
function envCol(key){
  const a = G.envPrev || G.env, b = G.env;
  if (!b) return TH[key];
  if (!a || a === b || G.envT >= 1) return b[key] || TH[key];
  return mix(a[key] || TH[key], b[key] || TH[key], G.envT);
}

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

/* the spec the physics actually reads: car + upgrades + crew folded together */
function activeSpec(){
  const u = Save.data.up;
  const liv = Livery.cur();
  return Object.assign({}, PLAYER, {
    col: liv.col, col2: liv.col2, trail: liv.trail,
    grip:     PLAYER.grip + u.grip * 0.42,
    top:      PLAYER.top * (1 + u.engine * 0.05),
    boostMul: 1 + u.nitro * 0.24,
    wreckMul: 1 + u.impact * 0.10,
    crashV:   430,
    hull:     u.armor * 16 + Tree.rank('t_armor') * 8,
    payout:   (1 + u.payout * 0.14) * (1 + Tree.rank('t_change') * 0.08)
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
  /* The landscape floor is set by legibility, not by taste. CrazyGames require
     text to be readable at devicePixelRatio 1 in their responsive iframe sizes,
     the smallest of which are 821x462 and 800x450 — and at height/100 those
     gave a 4.5px unit, which put the HUD's caption type at just over 6px. A
     floor of 5.6 lifts the smallest captions back to ~8px without changing
     anything at the sizes where the formula was already above it. */
  const u = portrait ? clamp(W / 54, 4, 10) : clamp(H / 100, 5.6, 11);
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
    else if (G.state === 'cleared') leaveCleared();
  }
  if (G.state === 'levelup' && /^Digit[123]$/.test(e.code)) takePerk(+e.code.slice(5) - 1);
  if (e.code === 'KeyM') { NHAudio.toggleMute(); setMute(); }
  /* Escape is deliberately not bound. On the web it already means "leave
     fullscreen", and CrazyGames lists it as a restricted key for exactly
     that reason: a player who hits it to un-fullscreen would have had the
     run abandoned underneath them at the same time. Quitting is a button. */
  if (steerCode(e.code)) { dismissHint(); MS.on = false; }   // keys reclaim the wheel
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

/* ---- onboarding hint ----
   CrazyGames asks that onboarding happen inside gameplay, stay visual, and
   be skippable. This is the whole of it: one overlay naming the one control
   the game has, shown over a district that is already running, and gone the
   moment the player steers — which is the only thing it was asking for. */
function dismissHint(){
  const el = $('gsHint');
  if (!el) return;
  clearTimeout(el._t);
  el.classList.remove('on');
}
function showControlHint(){
  const el = $('gsHint');
  if (!el) return;
  el.innerHTML =
    '<b>' + (swipeMode() ? 'Drag anywhere to steer'
                         : hasTouch ? 'Hold either arrow to steer'
                         : '&#8592; &#8594; or move the mouse to steer') + '</b>' +
    '<span>Ram traffic to build the chain &middot; grab power-ups &middot; it banks itself</span>';
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 5200);
}
function gsDown(e){
  /* Touch contacts only. A laptop with a touchscreen reports maxTouchPoints
     but is still driven with the keyboard — a mouse click there should not
     become a steering input. */
  if (e.pointerType === 'mouse' || !swipeMode()) return;
  dismissHint();                           // it has served its purpose
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

/* Steering codes. `e.code` is the physical key, so the QWERTY A/D positions
   already land under an AZERTY player's Q/D without a remap — but somebody on
   AZERTY may equally reach for the key *printed* A, which is code KeyQ. Both
   are accepted; the two layouts don't collide. */
const STEER_L = ['ArrowLeft','KeyA','KeyQ'];
const STEER_R = ['ArrowRight','KeyD'];
const steerCode = c => STEER_L.includes(c) || STEER_R.includes(c);

/* ---- mouse steering ----
   CrazyGames requires desktop games to support the mouse, and this one was
   keyboard-only. Steering follows how far the cursor sits from the centre of
   the stage — the analogue equivalent of the touch drag, and nothing to hold
   down. It arms on the first mouse movement and disarms the moment a steering
   key is pressed, so somebody playing on the keyboard never ends up fighting a
   cursor parked at the edge of the screen. */
const MS = { on:false, steer:0 };
stage.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const dx = e.clientX - W / 2;
  const dead = W * 0.03;                 // no drift from a near-centred cursor
  const span = Math.max(1, W * 0.30);    // full lock a third of the way out
  MS.steer = clamp((Math.abs(dx) < dead ? 0 : dx - Math.sign(dx) * dead) / span, -1, 1);
  MS.on = true;
  dismissHint();
}, { passive: true });
stage.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') MS.on = false; });

function readInput(){
  const l = keys.ArrowLeft  || keys.KeyA || keys.KeyQ || touch.left;
  const r = keys.ArrowRight || keys.KeyD || touch.right;
  let steer = (r ? 1 : 0) - (l ? 1 : 0);
  if (swipeMode() && GS.on && !steer) steer = GS.steer;  // analogue, unlike the keyboard
  if (!steer && MS.on && G.state === 'play') steer = MS.steer;
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
  /* `plan` is the district's stretches in order: [{ end, env }, ...]. The
     generator reads the env for the segment it is about to lay down, so the
     world genuinely changes as the road crosses a gate rather than being
     recoloured around the player. */
  constructor(plan){
    this.plan = (plan && plan.length) ? plan : [{ end:Infinity, env:zoneEnv('blocks') }];
    this.pts = [];
    this.ang = -Math.PI / 2;
    this.curv = 0; this.tCurv = 0;
    this.hw = 280; this.tHw = 280;
    this.x = 0; this.y = 0; this.n = 0;
    for (let i = 0; i < 260; i++) this.extend();
  }
  envAt(n){
    const pl = this.plan;
    for (let i = 0; i < pl.length; i++) if (n < pl[i].end) return pl[i].env;
    return pl[pl.length - 1].env;
  }
  /* the segment index each stretch begins at, used to place the gates */
  gates(){
    return this.plan.slice(0, -1).map(s => s.end);
  }
  extend(){
    const E = this.envAt(this.n);
    const R = E.road;
    if (this.n % 24 === 0) {
      this.tCurv = Math.random() < R.straight ? 0 : rnd(-R.curve, R.curve);
    }
    if (this.n % 46 === 0) this.tHw = rnd(R.width[0], R.width[1]);
    this.curv = lerp(this.curv, this.tCurv, 0.07);
    this.hw   = lerp(this.hw, this.tHw, 0.05);
    this.ang += this.curv;
    this.x += Math.cos(this.ang) * SEG;
    this.y += Math.sin(this.ang) * SEG;

    const p = { x:this.x, y:this.y, a:this.ang, w:this.hw, i:this.n, b:null,
                lamp:this.n % 4 === 0, z:E, span:null, gate:0 };
    const nx = -Math.sin(this.ang), ny = Math.cos(this.ang);

    /* city blocks, both sides, set well back so they never crowd the road */
    const B = E.bld;
    if (this.n % 2 === 0 && B.mode !== 'none') {
      p.b = [];
      for (const side of [-1, 1]) {
        if (Math.random() < B.gap) continue;
        const off = this.hw + rnd(B.back[0], B.back[1]);
        const wide = B.mode === 'shed' || B.mode === 'stack';
        p.b.push({
          kind:'block', mode:B.mode,
          x: this.x + nx * off * side,
          y: this.y + ny * off * side,
          w: rnd(B.size[0], B.size[1]),
          d: rnd(B.size[0], B.size[1]) * (wide ? 0.62 : 1),
          h: rnd(B.h[0], B.h[1]),
          a: this.ang + rnd(-0.25, 0.25) * (B.mode === 'stack' ? 0.2 : 1),
          hue: Math.random() < 0.5 ? E.bldA : E.bldB,
          face1: E.face1, face2: E.face2,
          lit: Math.random() < B.lit,
          seed: Math.random() * 1000
        });
      }
    }

    /* roadside structures — the silhouettes that say which yard this is */
    if (E.props) {
      for (const pr of E.props) {
        if (Math.random() >= pr.rate) continue;
        const side = Math.random() < 0.5 ? -1 : 1;
        const off = this.hw + rnd(pr.back[0], pr.back[1]);
        (p.b || (p.b = [])).push({
          kind: pr.kind, side,
          x: this.x + nx * off * side,
          y: this.y + ny * off * side,
          a: this.ang, hue: Math.random() < 0.5 ? E.bldA : E.bldB,
          h: 0, seed: Math.random() * 1000
        });
      }
    }

    /* something passing overhead is the single cheapest read of speed the
       scene has, and the one thing a flat top-down road never gives you */
    if (E.span && E.span.every && this.n % E.span.every === 0 && this.n > 6) {
      p.span = { kind:E.span.kind, h:E.span.h || 180, seed:Math.random() * 1000 };
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

function spawn(x, y, vx, vy, life, r, col, add, grow, streak){
  if (P.length > 420) P.shift();
  P.push({ x, y, vx, vy, life, max:life, r, col, add:!!add, grow: grow || 0,
           st: streak || 0 });
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
    /* only the player carries perk modifiers; traffic and pursuit run stock */
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
        /* off both rear tyres, not the centreline — it reads as rubber, not
           a chimney — starting small and catching a hint of the district's
           neon so the smoke belongs to the place */
        const tint = TH.left || '#3DE8FF';
        const smokeCol = Math.round(parseInt(tint.slice(1, 3), 16) * 0.1 + 171) + ',' +
                         Math.round(parseInt(tint.slice(3, 5), 16) * 0.1 + 185) + ',' +
                         Math.round(parseInt(tint.slice(5, 7), 16) * 0.1 + 212);
        for (const side of [-1, 1]) {
          const rx = this.x - cs * s.len * 0.32 - sn * s.wid * 0.42 * side;
          const ry = this.y - sn * s.len * 0.32 + cs * s.wid * 0.42 * side;
          spawn(rx + rnd(-4, 4), ry + rnd(-4, 4),
                -cs * 50 + rnd(-60, 60) - sn * 40 * side,
                -sn * 50 + rnd(-60, 60) + cs * 40 * side,
                rnd(0.5, 0.9), rnd(5, 9), smokeCol, false, 60);
        }
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
  state:'menu',      // menu | brief | play | levelup | cleared | crash | over | garage
  ai:true,
  track:null, car:null, spec:null,
  traffic:[], police:[], boss:null, hazards:[], slicks:[], slickT:0,
  score:0, pending:0, chain:0, mult:1, chainT:0, chainMax:1,
  heat:0, tier:0, best:Save.data.best,
  coinsRun:0, topMult:1, totalWreck:0,
  crashT:0, slow:1, flash:0, revived:false, pendingLevels:0, awaitingAdvance:false,
  shake:0, dist:0,
  run:null, ghost:0, pulseWarn:0, offers:[], paused:false,
  env:null, envPrev:null, envT:1, stage:0,
  levelFlare:0,
  hp:100, hpMax:100, freeze:0, hitCool:0,
  pickups:[], power:{ shield:0, surge:0, magnet:0, frenzy:0, slowmo:0, ball:0, arc:0, drones:0, phase:0, draft:0 }, missileT:0, shockAt:5,
  rockets:0, rocketT:0, lastingPlate:0, lastingClock:0, lastingPayday:0, worldSlow:1,
  ball:null, wells:[], arcs:[], ballHits:0, drones:[], scav:null, lastingScav:0,
  convoy:[], convoyState:'pending', convoyLeft:0,
  stuckT:0, reverseT:0, policeCool:0, playSinceAd:9999, trail:[],
  /* weapon fire counters. Five increments in hot paths, and the only way a
     test can assert that a weapon perk did something rather than that the
     modifier table changed — the difference the whole pool turns on. */
  wstat:{ punt:0, cook:0, slick:0, arc:0, load:0 }
};

const cam = { x:0, y:0, rot:-Math.PI/2, zoom:1, sx:0, sy:0 };

/* ---------------- the ladder ----------------
   Districts get longer, hungrier and hotter. Every third is a boss, where
   the quota is replaced by a pursuit unit you damage by banking into it. */
/* Place names for the board. Kept clear of the zone names on purpose: the
   node is the district you are taking, the zones are the three stretches
   inside it, and a node called "Underpass 9" whose first stretch is also
   called "Underpass 9" reads as a bug. */
const DISTRICTS = [
  'Dockside', 'Marrow Street', 'Halston Reach', 'Bellrock', 'Nine Mile',
  'Cathedral Hill', 'Ashfield', 'The Verge', 'Kiln Street', 'Low Basin',
  'Radial', 'Saltgate', 'Old Cutting', 'The Shallows', 'Tannery Bend'
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

/* How strong the player actually is, on a scale where a brand-new save is
   1.0 and a maxed garage at level 15 is about 5.7.

   Quotas used to be a fixed curve, which meant they were tuned for exactly
   one loadout. Measured against a maxed save the quota was being met in the
   first 15-30% of the road, so the checkpoint — the only fail state that
   is not a wreck — could never fire and the back three-quarters of every
   district was scenery. Scaling by power fixes that, sub-linearly: power
   outgrows the index, so every upgrade still makes the road easier without
   ever making it free. All of the growth lives here rather than in the base
   curve, so a brand-new save meets exactly the numbers that shipped.

   The weighting matters as much as the ceiling. Run level carries more of
   it than the garage does, which means a veteran opens a run holding every
   upgrade and no perks yet — and feels it. The road tightens as the perks
   stack rather than being tight from the first corner. */
function powerIndex(){
  const up = Save.data.up || {};
  let lv = 0; for (const k in up) lv += up[k] || 0;          // 0..30
  const gear = (Save.data.gear || []).length;                // 0..6
  const lvl = G.run ? Math.max(0, G.run.level - 1) : 0;      // 0..14
  /* The first run is the one that decides whether there is a second, and a
     player on it is learning that traffic is ammunition rather than
     optimising a build. Three runs of grace, then the full number. */
  const green = Math.min(1, 0.62 + (Save.data.runs || 0) * 0.065);
  /* Measured head-to-head: at 0.055/0.14 a full garage raised the quota
     ~2.35x while actually raising income ~1.9x, so buying upgrades made the
     game *harder* — the maxed save failed districts the fresh save cleared.
     Halved, the index tops out ~1.7x and the sub-linear promise holds. */
  let tree = 0; const tr = Save.data.tree || {}; for (const k in tr) tree += tr[k] || 0;
  return green * (1 + lv * 0.030 + gear * 0.08 + tree * 0.022 + lvl * 0.155);
}

/* ---------------- the shape of a district ----------------
   A district used to be one road with one number at the end of it, and it
   ended the instant the number was met — against a built-up garage that was
   somewhere around a third of the way in, so most of the road that had been
   generated was never driven and every district was the same short sprint.

   It is three stretches now. Each has its own zone, its own share of the
   quota to have banked by the time you reach its gate, and its own
   escalation on the far side. Missing a gate ends the district there, so
   the fail state fires earlier and more often than the old single
   checkpoint did; clearing one pays and turns the pressure up. */
const STAGE_AT   = [0.34, 0.68, 1.00];   // fraction of the road at each gate
const STAGE_CUT  = [0.30, 0.64, 1.00];   // fraction of the quota owed at each
const STAGE_PAY  = [1.00, 1.14, 1.32];   // what banking in each stretch is worth
const STAGE_TAG  = ['Approach', 'Deep', 'Run-out'];

function districtCfg(n, type, act){
  const boss = type === 'boss';
  const bi = act - 1;
  const elite = type === 'elite';
  const node = G.run && G.run.node;
  const zones = (node && node.zones) || pickZones(act, boss ? 1 : 3);
  const cfg = {
    n, boss, elite, type, zones,
    name: (node && node.name) ||
          (boss ? BOSSES[bi % BOSSES.length].name : DISTRICTS[(n - 1) % DISTRICTS.length]),
    bossDef: boss ? BOSSES[bi % BOSSES.length] : null,
    /* Boss roads run a third longer: the fight is banking under pressure and
       "the unit got away" was 4 of 23 measured run-endings — a fight that now
       runs three phases needs more of that road, not less. A quota district
       is long enough that its three stretches get roughly twenty seconds each. */
    len: boss ? Math.round((400 + n * 26) * 1.3) : Math.round(600 + n * 30),
    /* Elites cost more and pay double XP; the route choice has to bite */
    quota: Math.round(7000 * Math.pow(1.32, n - 1) * (elite ? 1.45 : 1) * powerIndex()),
    /* Wrecks bank far harder than the old drift-only income did, so a boss
       that used to be a two-chain fight now needs the headroom to last. */
    bossHp: Math.round(12000 * Math.pow(1.55, Math.max(0, bi))),
    heatFloor: Math.min(2, (act - 1) + (elite ? 1 : 0))
  };
  cfg.stages = boss
    ? [{ zone:zones[0], end:cfg.len, cut:0, pay:1, tag:'Pursuit' }]
    : STAGE_AT.map((f, i) => ({
        zone: zones[i % zones.length],
        end: Math.round(cfg.len * f),
        cut: STAGE_CUT[i],
        pay: STAGE_PAY[i],
        tag: STAGE_TAG[i]
      }));
  return cfg;
}

/* A zone's rule applies while you are *in* it, not for the whole district —
   the lights are out in the sealed tube, not in the glass plaza two
   stretches later. Stated on the brief either way, because an unannounced
   rule is not an identity, it is a bug the player learns to live with. */
function stageRule(cfg, i){
  const st = cfg && cfg.stages && cfg.stages[Math.min(i, cfg.stages.length - 1)];
  return st ? zoneById(st.zone).rule : null;
}
function zoneRules(cfg){
  const seen = new Set(), out = [];
  for (let i = 0; i < ((cfg && cfg.stages) || []).length; i++) {
    const r = stageRule(cfg, i);
    if (!r || seen.has(r.name)) continue;
    seen.add(r.name);
    out.push(r);
  }
  return out;
}

/* ============================================================
   THE ROUTE
   A branching board per act, climbed bottom to top. Which node you take
   is the strategic layer: an Elite is harder but pays double XP, a
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
  run:   { reward:'Standard XP',   rare:false, quotaMul:1.00, heat:0 },
  elite: { reward:'Double XP',     rare:true,  quotaMul:1.45, heat:1 },
  depot: { reward:'Free level or rebuild', rare:false, quotaMul:0, heat:0 },
  boss:  { reward:'Act clear · full rebuild', rare:true, quotaMul:1.15, heat:1 }
};

function makeRoute(act){
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    if (r === ROWS - 1) { rows.push([{ type:'boss' }]); continue; }
    /* Draw distinct types rather than retrying a random pick: a fork whose
       branches read the same is not a choice, and the row before the boss
       only has two kinds to offer, so it can never hold three. */
    /* A Depot is worthless before you own anything: nothing to strip, and a
       free level is not worth skipping your first scoring district for. So
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
    /* (act-1)*ROWS, not (ROWS-1): with the shorter stride the act-1 boss and
       the act-2 opener were both "district 5", so the quota curve plateaued
       one full step at every act seam */
    const idx = r + 1 + (act - 1) * ROWS;
    n.name = n.type === 'boss' ? BOSSES[(act - 1) % BOSSES.length].name
           : n.type === 'depot' ? depots[di++ % depots.length]
           : pool[pi++ % pool.length];
    /* The stretches are drawn on the board, not at the start line: which
       three places a district is made of is part of what you are choosing
       between when you pick a node. */
    n.zones = n.type === 'depot' ? [] : pickZones(act, n.type === 'boss' ? 1 : 3);
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
  const r = {
    act: 1, route: makeRoute(1), row: -1, col: -1,
    xp: 0, level: 1, perks: [], hullBonus: 0,
    node: null, district: 0,
    curses: [], contract: null,
    M: NHChips.defaults(), L: NHChips.levelDefaults(),
    cfg: null, quota: 0, banked: 0, startIdx: 0, elapsed: 0,
    cleared: 0, crumpleLeft: 0, cageLeft: Tree.has('t_cage') ? 1 : 0,
    overtime: false, loop: 0
  };
  if (Tree.has('t_head')) { r.level = 2; }
  return r;
}

/* A Depot only offers a strip when there is a curse to strip, so the label
   has to be read at draw time rather than baked in at generation. */
function nodeReward(node){
  if (node.type !== 'depot') return node.reward;
  return (G.run && G.run.curses.length)
    ? 'Level, rebuild or strip a curse' : 'Free level or rebuild';
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
  /* The road is laid out stretch by stretch before a wheel turns — the
     skyline is baked per node at generation time, not at draw time, so the
     generator has to know where each zone starts and stops up front. */
  const cfg = G.run && G.run.cfg;
  const stages = (cfg && cfg.stages) ||
                 [{ zone: pickZones(G.run ? G.run.act : 1, 1)[0], end:Infinity }];
  const plan = stages.map((s, i) => ({
    /* the last stretch runs on past the checkpoint: the road has to keep
       existing behind the finish for the camera to have anything to see */
    end: i === stages.length - 1 ? Infinity : 6 + s.end,
    env: zoneEnv(s.zone)
  }));
  G.track = new Track(plan);
  G.env = plan[0].env; G.envPrev = plan[0].env; G.envT = 1;
  G.stage = 0;
  G.spec = activeSpec();
  G.traffic = []; G.police = []; G.boss = null; G.hazards = []; G.pickups = []; G.convoy = [];
  G.slicks = []; G.slickT = 0;
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
  G.power.phase = 0; G.power.draft = 0;
  G.power.ball = 0; G.power.arc = 0; G.ball = null; G.wells = []; G.arcs = []; G.ballHits = 0;
  G.power.drones = 0; G.drones = []; G.scav = null; G.lastingScav = 0;
  G.rockets = Tree.has('t_salvo') ? 2 : 0; G.rocketT = 0;
  G.firstBlood = Tree.has('t_first') ? 1 : 0;
  /* the lasting pickups are exactly that — for *this* district only */
  G.lastingPlate = 0; G.lastingClock = 0; G.lastingPayday = 0; G.lastingScav = 0;
  G.convoy = []; G.convoyState = 'pending'; G.convoyLeft = 0;
  G.stuckT = 0; G.reverseT = 0;
  G.levelFlare = 0;
  if (typeof UI !== 'undefined' && UI.lvlUp) UI.lvlUp.classList.remove('on');
  G.trail = []; G.trailT = 0;
  G.missileT = Hangar.has('missile') ? 4 : 0;
  if (Hangar.has('blackbox')) G.power.shield = 7;
  /* perks that arm you the moment a district starts */
  const PM = G.run ? G.run.M : null;
  if (PM && PM.startShield) G.power.shield = Math.max(G.power.shield, PM.startShield);
  if (PM && PM.startDrones) {
    G.power.drones = PM.startDrones;
    G.drones = [-1, 1].map(side => ({ x:G.car.x, y:G.car.y, side, vx:0, vy:0,
                                      target:null, dwell:0, ang:0 }));
  }
  const wasMax = G.hpMax;
  G.hpMax = Math.round(100 * (G.run ? G.run.M.hullMax : 1) + (G.spec.hull || 0)
                       + (G.run ? G.run.hullBonus : 0));
  /* Hull used to refill at every district line, which meant a run could only
     ever end inside one district — no attrition, and the depot's repair and
     the welder bought you nothing. It carries over now; clearing welds 70%
     back on, and the depot is a full rebuild. */
  G.hp = (G.run && G.run.cleared > 0 && !ai)
    ? clamp(G.hp + (G.hpMax - wasMax), 1, G.hpMax)
    : G.hpMax;
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

/* One grey pill was the whole civilian population. A small muted palette
   keeps "not neon = not a threat" while killing the clone army, and three
   special archetypes give the road things worth *choosing*:
   a tanker detonates where you crack it, an armored car is a coin piñata
   behind two pips, and at Heat 2+ the kamikaze bikes hunt YOU. */
const TRAFFIC_COLS = ['#7C8FBF', '#8FA37C', '#A38A7C', '#7C93A3', '#9C7CA3'];
function addTraffic(ahead){
  const idx = G.car.idx + ahead;
  G.track.ensure(idx + 10);
  const p = G.track.pts[idx];
  /* Three lanes rather than a uniform scatter. A scatter is a fog you steer
     through; lanes give the player a readable target to aim at and a readable
     gap to thread, which are the only two things you can do with a car. */
  const lat = (LANES[rint(0, LANES.length)] + rnd(-0.07, 0.07)) * roadHalf(p);
  const c = CARS[rint(0, CARS.length)];

  const roll = Math.random();
  let spec, arch = null;
  if (roll < 0.06) {
    arch = 'tanker';
    spec = Object.assign({}, c, {
      len:78, wid:27, nose:0.9, tail:0.95,
      col:'#B08040', col2:'#3A2708', power:240, grip:8, top:rnd(180, 230)
    });
  } else if (roll < 0.13) {
    arch = 'armored';
    spec = Object.assign({}, c, {
      len:56, wid:26, nose:0.85, tail:0.9,
      col:'#5E6B85', col2:'#11141F', power:300, grip:8, top:rnd(200, 280)
    });
  } else if (roll < 0.18 && (G.tier >= 2 || (G.tier === 1 && roll < 0.155))) {
    arch = 'bike';
    spec = Object.assign({}, c, {
      len:30, wid:13, nose:0.5, tail:0.6,
      col:'#FF5A3C', col2:'#400C05', power:520, grip:7.5, top:520
    });
  } else {
    spec = Object.assign({}, c, {
      len: c.len * rnd(1.08, 0.92),
      col: TRAFFIC_COLS[rint(0, TRAFFIC_COLS.length)], col2:'#181F33',
      power:300, grip:8, top:rnd(210, 330)
    });
  }
  const v = new Vehicle(spec, 'traffic');
  v.arch = arch;
  if (arch === 'armored') v.armour = 2;
  const pos = G.track.at(idx, lat);
  v.x = pos.x; v.y = pos.y; v.a = pos.a; v.idx = idx; v.lane = lat;
  v.vx = Math.cos(pos.a) * spec.top; v.vy = Math.sin(pos.a) * spec.top;
  G.traffic.push(v);
}

function addPolice(escort){
  const idx = Math.max(0, G.car.idx - 5);
  const pos = G.track.at(idx, rnd(-80, 80));
  /* Pursuit pace scales with the tier instead of always outrunning a stock
     player (base top 620): tier 1 can be shaken off, tier 3 cannot. */
  const spec = Object.assign({}, CARS[2], {
    col:'#14203C', col2:'#080D1A', power:600, grip:7.0,
    top: 600 + 15 * Math.max(1, G.tier)
  });
  const v = new Vehicle(spec, 'police');
  v.hp = 3;
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
  v.phase = 0; v.breakT = 0;
  G.boss = v;

  if (def.id === 'reaper') { addPolice(true); addPolice(true); }
  NHAudio.boss();
  toast(def.name + ' — ' + def.sub, 'red');
}

/* ---- how much of a pursuit unit one cash-in is allowed to take ----
   Banking is the only weapon, so the fight was exactly as long as one
   chain: a level-fifteen build could hold twenty thousand pending and put
   the whole thing through a twelve-thousand-point unit on the first bank,
   and the act boss died before it had finished announcing itself. Capping
   the bite at a fifth of its integrity makes the fight five cash-ins deep
   no matter what you are driving — a weak build gets there in five small
   banks, a monster build in five capped ones — so the encounter has a
   shape instead of a number that either clears it or does not. The
   overflow is not thrown away; it pays out as score. */
const BOSS_BITE = 0.20;
const BOSS_PHASES = 3;

function bossDamage(amount){
  const b = G.boss;
  if (!b) return;

  /* Executioner raises the ceiling as well as the blow. Applied to the blow
     alone it would be a dead node on exactly the builds it is sold to — any
     build big enough to reach the cap already does. It buys a fight four
     cash-ins deep instead of five. */
  const exec = Tree.has('t_exec') ? 1.25 : 1;
  const swung = amount * exec;
  const cap = Math.round(b.maxHp * BOSS_BITE * exec);
  /* Between phases it breaks off and runs. Banking still hurts it then,
     but far less — the window is for building the next chain, not for
     ending the fight while it is out of reach. */
  const soft = b.breakT > 0 ? 0.35 : 1;
  const dealt = Math.min(swung, cap) * soft;
  const spare = swung - Math.min(swung, cap);
  b.hp -= dealt;
  b.hitFlash = 1;
  G.shake = Math.max(G.shake, 12);
  NHAudio.bossHit();
  if (spare > 0) {
    /* the part of the bank the plating shrugged off still banks */
    G.score += Math.round(spare);
    G.run.banked += Math.round(spare);
    toast('Plating held — +' + fmt(spare) + ' banked', 'pink');
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd(0, TAU), s = rnd(120, 460);
    spawn(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s,
          rnd(0.25, 0.6), rnd(3, 8), '255,90,110', true, -6);
  }

  /* phase breaks at two thirds and one third of integrity */
  const want = Math.min(BOSS_PHASES - 1,
                        Math.floor((1 - b.hp / b.maxHp) * BOSS_PHASES));
  if (b.hp > 0 && want > b.phase) bossPhase(b, want);

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

/* A phase break: the unit pulls off, does the one thing it is for, and
   comes back on a shorter fuse. Three of these turn a health bar into a
   fight with an arc — you learn the pattern, it changes, you learn it
   again — and the window between them is where the next chain gets built. */
function bossPhase(b, phase){
  b.phase = phase;
  b.breakT = 4.2;
  b.atk = 1.2;
  b.charge = 0;
  G.flash = Math.max(G.flash, 0.7);
  G.shake = Math.max(G.shake, 26);
  NHAudio.boss();
  for (let i = 0; i < 46; i++) {
    const a = rnd(0, TAU), s = rnd(180, 620);
    spawn(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s,
          rnd(0.3, 0.8), rnd(4, 10), '255,150,90', true, -6);
  }
  if (b.def.id === 'warden') {
    /* it salts the road on the way out, and does it again harder */
    for (let i = 0; i < 4 + phase * 3; i++) dropHazard(b);
    toast('WARDEN breaks off — the road behind it is not clean', 'red');
  } else if (b.def.id === 'siren') {
    G.pulseWarn = 0;
    toast('SIREN re-tunes — the pulse comes faster now', 'red');
  } else {
    for (let i = 0; i < 1 + phase; i++) addPolice(true);
    toast('REAPER calls it in — more units on you', 'red');
  }
}

function stepBoss(dt){
  const b = G.boss, car = G.car;
  if (!b) return;
  const loc = G.track.locate(b.x, b.y, b.idx);
  b.idx = loc.i;
  b.offroad = Math.abs(loc.lat) > roadHalf(loc.p) ? 1 : 0;

  b.atk -= dt;
  /* Each phase shortens the fuse. The numbers are the only difficulty
     curve inside a single fight, so they are steep. */
  const fuse = 1 - b.phase * 0.26;
  let st;

  if (b.breakT > 0) {
    /* disengaged: it runs ahead, out of ramming reach, and leans on the
       road rather than on you */
    b.breakT -= dt;
    const ahead = G.track.at(car.idx + 26, Math.sin(G.dist * 0.004) * 120);
    st = steerToward(b, ahead.x, ahead.y);
    b.boostT = Math.max(b.boostT, 0.2);
    if (b.def.id === 'warden' && b.atk <= 0) { b.atk = 0.7; dropHazard(b); }
    if (b.breakT <= 0) {
      b.atk = 1.4;
      toast(b.def.name + ' re-engages', 'red');
    }
  } else {
    st = steerToward(b, car.x + car.vx * 0.3, car.y + car.vy * 0.3);

    if (b.def.id === 'warden') {
      /* telegraphed charge, then a hazard dropped in its wake */
      if (b.atk <= 0) {
        b.charge = 1.5; b.atk = 5.4 * fuse;
        for (let i = 0; i <= b.phase; i++) dropHazard(b);
      }
      if (b.charge > 0) b.charge -= dt;
    } else if (b.def.id === 'siren') {
      if (b.atk <= 0.9 && G.pulseWarn <= 0 && b.atk > 0) G.pulseWarn = b.atk;
      if (b.atk <= 0) {
        b.atk = 8.5 * fuse; G.pulseWarn = 0;
        /* Only punishes hoarding — bank little and often and it does
           nothing. The ceiling scales with the unit rather than sitting at
           act-1 money, where two wrecks at mult 4 tripped it by act 2, and
           it drops each phase, so "little and often" gets stricter about
           what little means. */
        const ceiling = Math.max(2400, Math.round(b.maxHp * 0.2))
                      * (1 - b.phase * 0.28);
        if (G.pending > ceiling) {
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
      if (b.atk <= 0) { b.atk = 4.4 * fuse; b.charge = 1.1; }
      if (b.charge > 0) b.charge -= dt;
      if (!b.baseTop) b.baseTop = b.spec.top;
      b.spec.top = b.baseTop * (1 + b.phase * 0.07);
    }
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
      /* the first boss is where casual runs were ending — soften the rams
         while the save is still learning the fight */
      damage(Math.round((b.charge > 0 ? 26 : 18)
           * ((Save.data.runs || 0) < 5 ? 0.6 : 1)), 'boss');
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
  const air = envNow().air;
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
  /* Overdraft: the stake is live — any hit that is not the cost of a wreck
     halves what you are carrying */
  if (G.power.draft > 0 && reason !== 'traffic' && G.pending > 0) {
    G.pending = Math.floor(G.pending / 2);
    toast('Overdraft called', 'red');
  }
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
             * (G.run.L.wreckPay || 1) * (G.power.frenzy > 0 ? 2 : 1)
             * (G.power.draft > 0 ? 3 : 1)
             * (v.arch === 'bike' ? 2 : 1));
  G.pending += gain;

  G.chain += 1 + (car.boost ? M.boostChain : 0);
  if (G.firstBlood) { G.firstBlood = 0; G.chain += 2; toast('First blood ×3', 'pink'); }
  G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  G.topMult = Math.max(G.topMult, G.mult);
  G.chainT = G.chainMax = chainTime();

  /* Ram Plate eats the hull cost outright — that is what the pickup is for.
     A kamikaze bike costs a little extra to eat head-on: it wanted this. */
  if (!G.power.shield)
    damage(Math.round((9 * power + (v.arch === 'bike' ? 5 : 0)) * (M.hullCost || 1)), 'traffic');

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
  if (M.punt) punt(v, M.punt);
  if (M.cook) { v.cook = M.cook; v.cookGen = 0; }
  archWreck(v);
  arcFrom(v);
  addXP(1);
  if (M.coinPerWreck) G.coinsRun += M.coinPerWreck;
  /* Momentum: every fifth link is worth two */
  if (M.chainStep && G.chain % 5 === 0) {
    G.chain += M.chainStep;
    G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  }
}


/* ============================================================
   WEAPONS
   The perk pool was 49 passive buffs. These are the systems that let a perk
   hand you a verb instead of a coefficient — a wrecked car you can bowl down
   the road, wreckage that cooks off behind you, a burning trail. Each one
   pays into the same chain as a hand-made wreck, because the chain is the
   game and a weapon that scored on its own ledger would compete with it.
   ============================================================ */

/* what a special archetype does the moment it is wrecked, however wrecked */
function archWreck(v){
  if (v.arch === 'tanker') {
    /* the payload cooks off a beat after the hit — free positional AoE */
    v.tank = 1;
    if (!v.cook) { v.cook = 0.45; v.cookGen = 0; }
  }
  if (v.arch === 'armored') {
    G.coinsRun += 40;
    toast('Armored car +40c', 'gold');
    for (let i = 0; i < 16; i++) {
      const a = rnd(0, TAU), s = rnd(120, 480);
      spawn(v.x, v.y, Math.cos(a) * s, Math.sin(a) * s,
            rnd(0.3, 0.8), rnd(3, 7), '255,197,61', true, -4);
    }
  }
}

/* Every weapon ends up here: wreck a live car with something that is not the
   player's bumper, pay it into the chain, and leave the hull alone. */
function killCar(t, vx, vy, pay){
  if (t.wrecked) return false;
  const M = G.run.M;
  t.vx += vx; t.vy += vy;
  t.spin = rnd(-11, 11);
  t.wrecked = 1; t.hitFlash = 1;
  G.totalWreck++;
  G.pending += Math.round((pay || 200) * G.mult * M.wreckMul
             * (G.run.L.wreckPay || 1) * (G.power.frenzy > 0 ? 2 : 1)
             * (G.power.draft > 0 ? 3 : 1));
  G.chain += 1;
  if (G.firstBlood) { G.firstBlood = 0; G.chain += 2; toast('First blood ×3', 'pink'); }
  G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  G.topMult = Math.max(G.topMult, G.mult);
  G.chainT = G.chainMax = chainTime();
  addXP(1);
  if (M.coinPerWreck) G.coinsRun += M.coinPerWreck;
  if (G.lastingPayday > 0) G.coinsRun += 12 * G.lastingPayday;
  archWreck(t);
  return true;
}

/* TAKEDOWN — pursuit is ammunition too, it just takes three pips. Killing a
   unit pays the chain, drops garage coins on the spot, and vents heat — so
   hunting the hunters trades income (the heat payout multiplier) for room
   to breathe, which is a real decision rather than a free lunch. */
function killPolice(p, idx){
  const i = idx != null ? idx : G.police.indexOf(p);
  if (i >= 0) G.police.splice(i, 1);
  G.totalWreck++;
  const M = G.run.M;
  G.pending += Math.round(500 * G.mult * M.wreckMul * (G.run.L.wreckPay || 1)
             * (G.power.frenzy > 0 ? 2 : 1));
  G.chain += 1;
  G.mult = Math.min(M.multCap, 1 + G.chain * M.multRate);
  G.topMult = Math.max(G.topMult, G.mult);
  G.chainT = G.chainMax = chainTime();
  addXP(3);
  G.coinsRun += 120;
  G.heat = Math.max(0, G.heat - 0.6);
  G.policeCool = 6;
  G.flash = Math.max(G.flash, 0.5);
  G.shake = Math.max(G.shake, 22);
  hitstop(0.07, 24);
  NHAudio.smash(1.5);
  for (let k = 0; k < 40; k++) {
    const a = rnd(0, TAU), s = rnd(140, 680);
    spawn(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s,
          rnd(0.3, 0.9), rnd(4, 10), k % 2 ? '255,70,90' : '120,180,255', true, -6);
  }
  toast('TAKEDOWN +120c', 'pink');
}

/* one armour pip off a pursuit unit, from any weapon heavy enough.
   The cooldown stops a slick or a sweeping ball from eating all three
   pips in three consecutive frames. */
function damagePolice(p, vx, vy){
  if ((p.pipCool || 0) > 0) return;
  p.pipCool = 0.6;
  p.hp = (p.hp || 3) - 1;
  p.vx += vx; p.vy += vy;
  p.a += rnd(-1.4, 1.4);
  p.hitFlash = 1;
  if (p.hp <= 0) killPolice(p);
}

/* KICKOFF — the car you hit does not tumble aside, it goes down the road
   ahead of you at speed and takes out whatever it reaches. Traffic is
   ammunition; this is the card where the game means it literally. Hops are
   capped so a dense lane cannot cascade the whole district in one frame. */
function punt(v, hops){
  const car = G.car;
  G.wstat.punt++;
  const cs = Math.cos(car.a), sn = Math.sin(car.a);
  v.vx = cs * 1450; v.vy = sn * 1450;
  v.spin = rnd(-4, 4);
  v.punt = hops;
  v.puntHit = null;
  for (let i = 0; i < 14; i++)
    spawn(v.x, v.y, cs * rnd(120, 420) + rnd(-90, 90), sn * rnd(120, 420) + rnd(-90, 90),
          rnd(0.2, 0.5), rnd(3, 7), '255,220,140', true, -6);
}

/* A punted car is live ordnance until it slows down. Runs inside the debris
   branch of the traffic step, where the punted body is already moving. */
function stepPunt(p){
  if (!p.punt || p.punt <= 0) return;
  const sp = hyp(p.vx, p.vy);
  if (sp < 380) { p.punt = 0; return; }
  for (const t of G.traffic) {
    if (t === p || t.wrecked) continue;
    const r = (t.spec.len + p.spec.len) * 0.55;
    if (hyp(t.x - p.x, t.y - p.y) > r) continue;
    const nx = (t.x - p.x) / (r || 1), ny = (t.y - p.y) / (r || 1);
    if (!killCar(t, nx * 300 + p.vx * 0.5, ny * 300 + p.vy * 0.5, 230)) continue;
    NHAudio.smash(0.8);
    G.flash = Math.max(G.flash, 0.22);
    /* the strike passes on, one hop shorter, and the striker loses steam */
    if (p.punt > 1) { t.vx = p.vx * 0.8; t.vy = p.vy * 0.8; t.punt = p.punt - 1; t.spin = rnd(-4, 4); }
    p.vx *= 0.55; p.vy *= 0.55;
    p.punt = 0;
    break;
  }
}

/* FUEL CELL — wreckage cooks off a beat after it lands. Unlike the arc,
   which is instant and picks a target, this is positional: what you leave
   behind you is dangerous, so where you wreck a car starts to matter as much
   as whether you reach it. */
function stepCook(v, dt){
  if (!v.cook) return;
  v.cook -= dt;
  if (v.cook > 0) return;
  const gen = v.cookGen || 0;
  v.cook = 0;
  G.wstat.cook++;
  /* a tanker's payload blasts half again as wide as a perk-cooked wreck */
  const M = G.run.M, R = (M.cookR || 165) * (v.tank ? 1.5 : 1)
          * (v.tank && Tree.has('t_chain') ? 1.3 : 1);
  G.flash = Math.max(G.flash, 0.3);
  hitstop(0.04, 14);
  NHAudio.smash(1.15);
  for (let i = 0; i < 34; i++) {
    const a = rnd(0, TAU), sp = rnd(180, 720);
    spawn(v.x, v.y, Math.cos(a) * sp, Math.sin(a) * sp,
          rnd(0.25, 0.7), rnd(4, 12),
          i % 3 ? '255,170,80' : '255,90,50', true, -7);
  }
  for (const t of G.traffic) {
    if (t.wrecked) continue;
    const d = hyp(t.x - v.x, t.y - v.y);
    if (d > R) continue;
    if (!killCar(t, (t.x - v.x) / (d || 1) * 620, (t.y - v.y) / (d || 1) * 620, 210)) continue;
    /* Bounded at two generations. Unbounded, this is a wreck fountain: each
       detonation seeds its victims, traffic refills the gap ahead, and the
       fresh cars detonate on arrival. One run measured 10,434 wrecks and hit
       the level cap on four districts. Two generations is a satisfying
       cluster; three is a chain letter. */
    if (gen < 2 && (M.cook || v.tank)) { t.cook = M.cook || 0.4; t.cookGen = gen + 1; }
  }
  /* pursuit is caught in it too — a blast takes an armour pip off a unit */
  for (const p of G.police.slice()) {
    const d = hyp(p.x - v.x, p.y - v.y);
    if (d > R) continue;
    damagePolice(p, (p.x - v.x) / (d || 1) * 520, (p.y - v.y) / (d || 1) * 520);
  }
}

/* TAILGUNNER — a burning slick every few seconds, laid where you have just
   been. The only perk that points backwards: everything else in the pool
   rewards what is in front of you, and pursuit sits behind. */
function stepSlicks(dt){
  const M = G.run && G.run.M, car = G.car;
  if (M && M.slick && G.state === 'play') {
    G.slickT -= dt;
    if (G.slickT <= 0) {
      G.slickT = M.slick;
      G.wstat.slick++;
      /* Laid as a continuous wake rather than discrete pools. A pool every
         three seconds was invisible: the camera looks ahead, so at 350km/h
         the thing you dropped was off the bottom of the frame before you
         could see it land, and a weapon you never see is a stat line. */
      G.slicks.push({ x: car.x - Math.cos(car.a) * 40, y: car.y - Math.sin(car.a) * 40,
                      life: 3.4, r: 68, t: 0 });
      if (G.slicks.length > 34) G.slicks.shift();
    }
  }
  for (let i = G.slicks.length - 1; i >= 0; i--) {
    const s = G.slicks[i];
    s.life -= dt; s.t += dt;
    if (s.life <= 0) { G.slicks.splice(i, 1); continue; }
    if (Math.random() < dt * 14)
      spawn(s.x + rnd(-s.r, s.r), s.y + rnd(-s.r, s.r), rnd(-30, 30), rnd(-30, 30),
            rnd(0.3, 0.8), rnd(4, 9), '255,150,60', true, -30);
    for (const t of G.traffic) {
      if (t.wrecked) continue;
      if (hyp(t.x - s.x, t.y - s.y) > s.r + 16) continue;
      const d = hyp(t.x - s.x, t.y - s.y) || 1;
      killCar(t, (t.x - s.x) / d * 380, (t.y - s.y) / d * 380, 180);
    }
    for (const p of G.police.slice()) {
      const d = hyp(p.x - s.x, p.y - s.y);
      if (d > s.r + 16) continue;
      damagePolice(p, (p.x - s.x) / (d || 1) * 300, (p.y - s.y) / (d || 1) * 300);
    }
  }
}

/* AUTOLOADER — a rocket every few seconds for the rest of the run, so the
   Bazooka perks stop being dead cards on a run that never found a Bazooka. */
function stepAutoload(dt){
  const M = G.run && G.run.M;
  if (!M || !M.autoload || G.state !== 'play') return;
  G.loadT = (G.loadT || 0) - dt;
  if (G.loadT > 0) return;
  G.loadT = M.autoload;
  G.wstat.load++;
  G.rockets = Math.min(G.rockets + 1, 6);
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
    killCar(t, nx * 700, ny * 700, 180);
  }
  for (const p of G.police.slice()) {
    const d = hyp(p.x - car.x, p.y - car.y);
    if (d > 260) continue;
    damagePolice(p, (p.x - car.x) / (d || 1) * 700, (p.y - car.y) / (d || 1) * 700);
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
  { id:'phase',   name:'Phase Shift', col:'#9FD8FF', rgb:'159,216,255', glyph:'\u25ce', w:10 },
  { id:'draft',   name:'Overdraft',   col:'#FF4FA0', rgb:'255,79,160',  glyph:'\u00d73', w:8 },
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
  /* a boss fight triples the odds of a Repair on the road: the fight is a
     race between two health bars, and the player's needs a supply line */
  const wOf = k => k.id === 'repair' && G.boss ? k.w * 3 : k.w;
  let total = 0;
  for (const k of POWERS) total += wOf(k);
  let r = Math.random() * total, kind = POWERS[0];
  for (const k of POWERS) { r -= wOf(k); if (r <= 0) { kind = k; break; } }
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
      G.rockets += 4 + (M.rocketBonus || 0);
      G.rocketT = Math.min(G.rocketT || 0.5, 0.5);
      break;
    case 'frenzy':
      G.power.frenzy = Math.max(G.power.frenzy, 8 * M.powerTime);
      break;
    case 'phase':
      /* a hologram: for four seconds the greedy line is the dense lane you
         DON'T wreck — every car you pass through pays as a thread */
      G.power.phase = Math.max(G.power.phase, 4 * M.powerTime);
      break;
    case 'draft':
      /* pending gains tripled, but any hit halves the pending on the spot —
         a pure posture change: drive clean or lose the stake */
      G.power.draft = Math.max(G.power.draft, 6 * M.powerTime);
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
      G.power.ball = Math.max(G.power.ball, 11 * M.powerTime * M.ballTime);
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
      G.power.drones = Math.max(G.power.drones, 11 * M.powerTime * M.droneTime);
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
  if (G.power.phase  > 0) G.power.phase  = Math.max(0, G.power.phase  - dt);
  if (G.power.draft  > 0) G.power.draft  = Math.max(0, G.power.draft  - dt);
  if (G.power.arc    > 0) G.power.arc    = Math.max(0, G.power.arc    - dt);
  if (G.power.ball   > 0) { G.power.ball = Math.max(0, G.power.ball - dt);
                            if (G.power.ball === 0) G.ball = null; }
  if (G.power.drones > 0) { G.power.drones = Math.max(0, G.power.drones - dt);
                            if (G.power.drones === 0) G.drones = []; }
  /* the perks that grant a toy outright keep its timer topped up, so the
     system downstream never has to know where the toy came from */
  const PM = G.run ? G.run.M : null;
  const pcar = G.car;
  if (PM && PM.ballAlways) {
    G.power.ball = Math.max(G.power.ball, 2);
    if (!G.ball) G.ball = { x:pcar.x, y:pcar.y, vx:0, vy:0, ang:pcar.a + Math.PI };
  }
  if (PM && PM.dronesAlways) {
    G.power.drones = Math.max(G.power.drones, 2);
    if (G.drones.length < 2)
      G.drones = [-1, 1].map(side => ({ x:pcar.x, y:pcar.y, side, vx:0, vy:0,
                                        target:null, dwell:0, ang:0 }));
  }
  stepBall(dt); stepWells(dt); stepDrones(dt); stepScav(dt);
  stepSlicks(dt); stepAutoload(dt);
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
    killCar(t, nx / nd * 560, ny / nd * 560, 230);
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
    G.ballHits = (G.ballHits || 0) + 1;
    killCar(t, nx / nd * 900, ny / nd * 900, 300);
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
  /* the iron does not care what livery the car it meets is wearing */
  for (const p of G.police.slice()) {
    let u = segLen2 > 1e-6 ? ((p.x - px) * sx + (p.y - py) * sy) / segLen2 : 0;
    u = clamp(u, 0, 1);
    if (hyp(p.x - (px + sx * u), p.y - (py + sy * u)) > BALL_R) continue;
    const nx = (p.x - b.x), ny = (p.y - b.y), nd = hyp(nx, ny) || 1;
    damagePolice(p, nx / nd * 700, ny / nd * 700);
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
  if (G.power.arc <= 0 && !(G.run && G.run.M.arcAlways)) return;
  const hops = depth || 0;
  if (hops >= 3 + ((G.run && G.run.M.arcHops) || 0)) return;
  const M = G.run.M;
  let best = null, bd = 1e9;
  for (const t of G.traffic) {
    if (t.wrecked || t === src) continue;
    const d = hyp(t.x - src.x, t.y - src.y);
    if (d < bd && d < 340) { bd = d; best = t; }
  }
  if (!best) return;

  G.wstat.arc++;
  G.arcs.push({ ax:src.x, ay:src.y, bx:best.x, by:best.y, t:0.22 });
  const nx = (best.x - src.x) / (bd || 1), ny = (best.y - src.y) / (bd || 1);
  killCar(best, nx * 380, ny * 380, 190);
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
      const R = 620 * (M ? M.wellPull : 1);
      if (d > R) continue;
      const pull = (1 - d / R) * 1900 * (M ? M.wellPull : 1) * dt;
      t.vx += dx / d * pull; t.vy += dy / d * pull;
      if (d < 46 && M) {
        killCar(t, 0, 0, 230);
        t.spin = rnd(-16, 16);
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
  killCar(best, nx * 760, ny * 760, 240);
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
  /* a free link: it pays and extends, but never costs hull */
  killCar(best, nx * 820, ny * 820, 240);
  G.flash = Math.max(G.flash, 0.4);
  hitstop(0.05, 16);
  NHAudio.smash(1.2);
  toast('Harpoon', 'pink');
}



/* ============================================================
   LEVELS
   The addictive part is not the perk, it is the *cadence* of being handed a
   choice. XP comes off the things you were already doing — wrecks, banks,
   haulers, clears — so a level-up is always the reward for the last thirty
   seconds rather than for a menu you walked through. Fifteen levels, three
   offers each, drawn from forty-five: no run sees the same board twice, and
   two runs diverge inside the first district.
   ============================================================ */
const LEVEL_CAP = 15;
/* Clearing a district pays a large XP lump on top of the wrecks, so there
   is exactly one level track rather than two counters that drift apart —
   the old clear-grants-a-free-perk path handed out 21 perks by level 12. */
/* First level cheap so the first perk card lands ~20s into a first run.
   The tail is quadratic: a flat-linear curve capped a skilled run at level
   15 inside act 1 — measured, 3.8 level-ups per district and then ten
   straight districts of silence, which mutes the game's own addiction
   engine for exactly the players who are winning. Early levels are still
   cheap (casual cadence unchanged); the cap now lands mid act 2 or later. */
const xpFor = l => l <= 1 ? 26 : Math.round(18 + l * l * 2.2);

function addXP(n){
  const run = G.run;
  if (!run) return;
  if (run.level >= LEVEL_CAP) {
    /* past the cap the meter still pays: every 300 overflow XP is a 150-coin
       dividend, so a capped run never goes fully silent */
    run.xpOverflow = (run.xpOverflow || 0) + n;
    if (run.xpOverflow >= 300) {
      run.xpOverflow -= 300;
      G.coinsRun += 150;
      toast('Veteran dividend +150c', 'gold');
    }
    return;
  }
  run.xp += n * (run.L ? run.L.xpMul : 1) * (run.overtime ? 1.5 : 1)
              * (Tree.has('t_know') ? 1.15 : 1);
  while (run.level < LEVEL_CAP && run.xp >= xpFor(run.level)) {
    run.xp -= xpFor(run.level);
    run.level++;
    G.pendingLevels++;
    armLevelFlare();
  }
}

/* ============================================================
   THE LEVEL-UP MOMENT
   Levelling was invisible. addXP incremented a number and the perk screen
   appeared on the next frame, so the only evidence you had levelled at all
   was three cards arriving over the road unannounced — and they arrived
   playing chip(), the same four notes a perk *pick* makes, so the moment
   the run handed you something sounded like the moment you spent it. You
   cannot feel rewarded by something you never saw happen.

   The level announces itself on the road first now: the rail completes and
   pulses, a banner names the level you just reached, and a cue plays that
   belongs to nothing else in the game. The cards follow. The flare also
   waits out a live chain, up to a cap, so the interruption lands on the
   bank — the loop's own punctuation — instead of mid-corner. You know
   instantly, and you are interrupted politely, which are two different
   problems and were both broken by the same missing beat.
   ============================================================ */
/* matches the banner's own animation length — the cards are not allowed to
   interrupt the strike partway through */
const FLARE_HOLD = 1.5;

function armLevelFlare(){
  /* The clear screen already says "Level 4 — take a perk" on its own face,
     so a banner behind it would be the same news twice. */
  if (G.state !== 'play') return;
  const el = UI.lvlUp;
  /* A fat bank can cross two levels at once. The banner names the level you
     actually reached rather than the first one you passed through, but it
     still only fires once — two announcements a frame apart is a stutter,
     not a celebration. */
  if (el) $('lvlUpNum').textContent = G.run.level;
  if (G.levelFlare > 0) return;
  G.levelFlare = FLARE_HOLD;
  G.flash = Math.max(G.flash, 0.4);
  NHAudio.levelUp();
  if (!el) return;
  el.classList.remove('on');
  void el.offsetWidth;                    // restart the animation from zero
  el.classList.add('on');
  /* the first-district steering hint sits in the same band; a level-up
     outranks a control reminder you have already acted on */
  $('gsHint').classList.remove('on');
}

/* One countdown, and nothing else. The first cut also held the cards back
   while a chain was live, on the theory that being yanked out mid-corner was
   rude — and it was wrong on both counts.

   It was wrong mechanically: opening the card screen freezes the simulation,
   so the chain clock, the pending bank and the multiplier are all exactly
   where you left them when you come back. Measured at three seconds on the
   card screen, the clock lost 0.03s. There was never anything to protect.

   And it was wrong as a rule, because a chain does not end while you are
   playing well — every wreck resets the clock, which is the whole design of
   it — so "wait for the chain to end" meant "wait for the district to end",
   which is what it did. The cap that was meant to bound that was itself
   broken: it accumulated only on frames where the countdown landed at or
   below zero after subtracting a different frame's dt, so frame-time jitter
   made 2.6 seconds take the better part of a minute.

   The delay is now the same 1.25s every single time, which is worth more
   than politeness: you learn it once. */
function stepFlare(dt){
  if (G.levelFlare <= 0) return;
  G.levelFlare = Math.max(0, G.levelFlare - dt);
  if (G.levelFlare <= 0 && UI.lvlUp) UI.lvlUp.classList.remove('on');
}

/* Offered at the next safe moment rather than mid-corner. */
function maybeLevelUp(){
  if (G.pendingLevels <= 0 || G.state !== 'play') return;
  /* the road gets to say it first */
  if (G.levelFlare > 0) return;
  G.pendingLevels--;
  const run = G.run;
  G.offers = NHChips.rollPerks(run.perks, run.level);
  if (!G.offers.length) { G.pendingLevels = 0; return; }

  G.state = 'levelup';
  UI.hud.classList.add('off');
  $('luLevel').textContent = run.level;
  const wrap = $('luCards');
  wrap.innerHTML = '';
  G.offers.forEach((p, i) => {
    const el = document.createElement('button');
    el.className = 'dcard ' + p.rarity;
    el.innerHTML =
      '<div class="drar">' + p.rarity + ' &middot; ' + p.tag + '</div>' +
      '<div class="dname">' + p.name + '</div>' +
      '<div class="ddesc">' + p.desc + '</div>';
    el.onclick = () => takePerk(i);
    wrap.appendChild(el);
  });
  show(UI.levelup);
  NHAudio.ui(true);
}

function takePerk(i){
  const p = G.offers[i];
  if (!p) return;
  G.run.perks.push(p.id);
  rebuildMods();
  renderBuild();
  NHAudio.chip();
  hide(UI.levelup);
  UI.hud.classList.remove('off');
  G.state = 'play';
  toast(p.name + ' fitted', 'gold');
  if (p.curse) {
    G.run.curses.push(p.curse.id);
    rebuildMods();
    toast(p.curse.name + ' — ' + p.curse.desc, 'red');
    NHAudio.curse();
  }
  /* a hull bump applies immediately rather than at the next district */
  const was = G.hpMax;
  G.hpMax = Math.round(100 * G.run.M.hullMax + (G.spec.hull || 0) + G.run.hullBonus);
  if (G.hpMax > was) G.hp += G.hpMax - was;
  if (G.pendingLevels > 0) { maybeLevelUp(); return; }   // two at once is possible
  if (G.awaitingAdvance) { G.awaitingAdvance = false; advance(); }
}

/* Perks change mid-district, so the modifier table has to be rebuilt live. */
function rebuildMods(){
  const run = G.run;
  const built = NHChips.build(run.curses, run.contract, run.perks);
  run.M = built.M; run.L = built.L;
  /* the stretch you are standing in gets a say too — a zone whose only
     difference is its colour is a skin, not a place */
  const zr = stageRule(run.cfg, G.stage);
  if (zr) zr.apply(run.M, run.L);
  if (Hangar.has('prow')) { run.M.wreckMul += 0.25; run.M.hullCost *= 0.80; }
  run.M.wreckMul *= (G.spec.wreckMul || 1);
  /* the Elite label says Double XP; make the label true (stacks with risk) */
  if (run.cfg && run.cfg.elite) run.L.xpMul = (run.L.xpMul || 1) * 2;
  Tree.apply(run.M);
  if (G.car) G.car.mods = run.M;
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
  const heavy = car.boost || rel > 430 || G.power.surge > 0 || (M.convoyArmour || 0) > 0;
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
  addXP(5);
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
  const heatMul = 1 + G.tier * (Tree.has('t_roller') ? 0.45 : 0.35)
                + (G.tier >= 2 ? M.heatBonus : 0);
  /* Two independent multipliers pulling opposite ways, on purpose. Deeper
     into the district pays more, so the back two stretches are a reason to
     be there rather than road to sit through. Overtime banking pays half,
     because the district is already won and without the taper a casual
     district-2 surplus banked 307k against an 8.8k quota — score stopped
     meaning anything the leaderboard could compare. */
  const stage = G.run.cfg && G.run.cfg.stages[G.stage];
  const gained = Math.floor(G.pending * heatMul * M.bankMul * (M.scoreMul || 1)
              * (stage ? stage.pay : 1)
              * (G.run.overtime ? 0.5 : 1)
              * (M.lastStand && G.hp / G.hpMax < 0.34 ? 2 : 1));

  G.score += gained;
  G.run.banked += gained;
  addXP(Math.min(6, Math.round(gained / 2600)));
  /* Scaled to the quota AND capped per bank: chain-multiplier inflation
     means income can outrun any fixed divisor by 10-30x, which pegged heat
     at 3.0 by district two and turned the pursuit ladder into a constant.
     Capped, a monster bank is still only just over half a tier — heat
     climbs across a district in steps the decay can actually fight. */
  G.heat = Math.min(3.0, G.heat
         + Math.min(0.55, gained / Math.max(14000, G.run.quota * 2)));
  NHAudio.bank(G.mult);

  /* perks that trigger on the cash-in, not on the wreck */
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
  else { toast('Banked +' + fmt(gained), 'gold'); popBank(gained); }

  /* Cashing in welds the hull back together, and a pile-up patches more than
     a lone wreck — but never as much as it cost, so hull only ever trends
     down and the run still has a clock on it. */
  const heal = 3 + G.chain * 2.5 + (M.bankHeal || 0);
  if (G.hp < G.hpMax) G.hp = Math.min(G.hpMax, G.hp + heal);

  G.pending = 0; G.chain = 0; G.mult = 1; G.chainT = 0; G.shockAt = 5;

  /* Meeting the quota used to clear the district on the spot, which meant a
     skilled district was one chain long — measured, cleared at 32-40% of the
     road, with the back half never driven. The district is *won* at quota
     but runs to the checkpoint in overtime: surplus banking keeps paying,
     XP runs half again, and a wreck in overtime is a limp home, not a loss. */
  if (!G.boss && G.run.cfg && !G.run.cfg.boss && !G.run.overtime
      && G.run.banked >= G.run.quota) {
    G.run.overtime = true;
    G.flash = Math.max(G.flash, 0.5);
    toast('QUOTA MET — overtime, ×1.5 XP', 'gold');
    NHAudio.bank(3);
  }
  /* The gates are the floor and overtime is the ceiling: a gate says what
     you must have banked by a given point, overtime says the district is
     already won and you are milking it. Meeting the quota early therefore
     passes every remaining gate on the way to the line, which is correct —
     you have already paid for them. */
}

function toast(text, cls){
  /* Merge repeats instead of stacking them: at several wrecks a second the
     rail was three copies of "Wreck +N" fighting for the same pixels. A
     repeat updates the last toast and bumps a counter instead. */
  const key = text.split(' ')[0];
  const last = UI.toasts.lastChild;
  if (last && last.dataset.key === key) {
    last.dataset.n = (parseInt(last.dataset.n, 10) || 1) + 1;
    last.textContent = text + '  ×' + last.dataset.n;
    clearTimeout(last._t);
    last._t = setTimeout(() => last.remove(), 1150);
    return;
  }
  const el = document.createElement('div');
  el.className = 'toast' + (cls ? ' ' + cls : '');
  el.dataset.key = key;
  el.dataset.n = 1;
  el.textContent = text;
  UI.toasts.appendChild(el);
  el._t = setTimeout(() => el.remove(), 1150);
  while (UI.toasts.children.length > 2) UI.toasts.firstChild.remove();
}

/* the payoff moment travels: a bank throws its number from the combo rail
   and pulses the score it lands in */
function popBank(gained){
  const el = document.createElement('div');
  el.className = 'bankPop';
  el.textContent = '+' + fmt(gained);
  UI.hud.appendChild(el);
  setTimeout(() => el.remove(), 900);
  UI.score.classList.remove('pop');
  void UI.score.offsetWidth;               // restart the animation
  UI.score.classList.add('pop');
  for (let i = 0; i < 10; i++) {
    const a = rnd(0, TAU), s = rnd(150, 450);
    spawn(G.car.x, G.car.y, Math.cos(a) * s, Math.sin(a) * s,
          rnd(0.25, 0.5), rnd(3, 6), '61,232,255', true, -5);
  }
}

/* -------- crash -------- */
function crash(reason){
  if (G.state !== 'play') return;

  /* Quota already met and the hull gives out in overtime: that is a limp to
     the checkpoint, not a loss — the district was won when the number was. */
  if (G.run && G.run.overtime && G.run.cfg && !G.run.cfg.boss) {
    if (G.pending > 0) {
      const salvage = Math.floor(G.pending * 0.4);
      G.score += salvage; G.run.banked += salvage;
    }
    G.pending = 0; G.chain = 0; G.mult = 1; G.chainT = 0;
    G.hp = Math.round(G.hpMax * 0.35);
    G.flash = 0.8; G.shake = 24;
    NHAudio.hit(1.4);
    toast('Limped to the checkpoint', 'gold');
    clearDistrict();
    return;
  }

  /* Crumple Zone (or the crew's Safety Cage) spends a charge instead of
     ending the run */
  if (G.run && (G.run.crumpleLeft > 0 || G.run.cageLeft > 0)) {
    if (G.run.crumpleLeft > 0) G.run.crumpleLeft--; else G.run.cageLeft--;
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
  /* Chains run 20-30s, so at the moment of death the whole district's
     earnings are usually still pending — measured, 9 of 20 deaths banked
     exactly zero, which starves the garage of the coins that make the next
     run feel worth starting. Salvage 40%: dying is still expensive, but a
     run that ended badly always pays for *something* you keep. */
  if (G.pending > 0 && G.run) {
    const salvage = Math.floor(G.pending * 0.4);
    G.score += salvage; G.run.banked += salvage;
    toast('Salvaged +' + fmt(salvage), 'gold');
  }
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
    if (G.run) G.run.elapsed += dt;
    if (!G.ai) G.playSinceAd += dt;
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
        /* graze sparks fan along the rail, not out of the car's centre —
           the barrier normal is right there, so the shower hugs the wall
           and streaks with the direction of travel */
        const n = Math.min(14, Math.floor(into / 26));
        const wnx = -Math.sin(loc.p.a) * (Math.sign(loc.lat) || 1);
        const wny =  Math.cos(loc.p.a) * (Math.sign(loc.lat) || 1);
        const tx = Math.cos(loc.p.a), ty = Math.sin(loc.p.a);
        for (let i = 0; i < n; i++) {
          const along = rnd(60, 420), off = rnd(30, 160);
          spawn(car.x + wnx * 10, car.y + wny * 10,
                tx * along - wnx * off, ty * along - wny * off,
                rnd(0.15, 0.4), rnd(1.5, 4), '255,215,140', true, -4, 1);
        }
        G.shake = Math.max(G.shake, Math.min(16, into / 22));
        if (Math.random() < 0.25) NHAudio.spark();
        if (into > G.spec.crashV) {
          /* A hard wall is the mistake that pays nothing, but it must not be
             the main hull sink — hull is meant to read as fuel you spend on
             traffic, not as a tax on clipping a barrier while learning. */
          damage(Math.round((6 + into * 0.015) * (G.run.M.wallMul || 1)), 'wall');
          hitstop(0.07, 26);
          NHAudio.hit(1.4);
          car.hitFlash = 1;
          G.chain = 0;
          if (G.pending > 0) bank();
          car.vx *= 0.55; car.vy *= 0.55;
          car.inv = 0.35;
          if (G.state !== 'play') return;
        } else {
          G.hp -= dt * 1.0 * (G.run.M.wallMul || 1);   // scraping bleeds you slowly
          if (G.hp <= 0) { crash('wall'); return; }
          if (G.run.M.brittle) { G.chainT = 0; if (G.pending > 0) bank(); }
          else burnChain(dt * 1.6);
        }
      }
    }
    G.dist += car.speed * dt;

    /* feed the light ribbon from the rear axle */
    G.trailT = (G.trailT || 0) - dt;
    if (G.trailT <= 0 && car.speed > 120) {
      G.trailT = 0.018;
      const tcs = Math.cos(car.a), tsn = Math.sin(car.a);
      G.trail.push({
        x: car.x - tcs * car.spec.len * 0.5,
        y: car.y - tsn * car.spec.len * 0.5,
        k: Math.min(1.6, 0.35 + car.drift * 0.7 + (car.boost ? 0.65 : 0))
      });
      if (G.trail.length > 42) G.trail.shift();
    }

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
    stepFlare(dt);
    G.heat = Math.max(0, G.heat - dt * 0.038
           * (Tree.has('t_cool') && G.hp < G.hpMax * 0.3 ? 1.4 : 1));
    G.tier = Math.max(G.run.cfg ? G.run.cfg.heatFloor + M.policeStart : 0, Math.floor(G.heat));
    G.tier = Math.min(3, G.tier);
    if (G.run.grace) G.tier = 0;

    stepHazards(dt);
    stepAir(dt);
    stepConvoy(dt);
    maybeLevelUp();
    if (G.boss) stepBoss(dt);

    /* the env under the camera, and the crossfade that hides the seam */
    const zp = G.track.pts[Math.min(car.idx, G.track.pts.length - 1)];
    if (zp && zp.z !== G.env) { G.envPrev = G.env; G.env = zp.z; G.envT = 0; }
    G.envT = Math.min(1, G.envT + dt * 1.1);

    /* reaching a gate decides the stretch */
    if (G.run.cfg) {
      const travelled = car.idx - G.run.startIdx;
      const st = G.run.cfg.stages[G.stage];
      if (st && travelled >= st.end) {
        /* Cash the chain before judging. Arriving at a gate holding 8,000
           pending and being failed at 2,000/10,000 reads as the quota not
           counting your wrecks — you earned it, the clock just had not run
           out yet. */
        if (G.pending > 0) bank();
        if (G.state !== 'play') return;          // banking may have cleared it
        passGate();
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
      /* a punted car keeps its legs: bleeding it off at the debris rate
         stopped it a car length short of anything worth hitting */
      const drag = t.punt ? 0.22 : 0.9;
      t.vx *= Math.exp(-drag * dt); t.vy *= Math.exp(-drag * dt);
      t.x += t.vx * dt; t.y += t.vy * dt;
      t.hitFlash = Math.max(0, t.hitFlash - dt * 3);
      if (playing) { stepPunt(t); stepCook(t, dt); }
      if (t.idx < car.idx - 24 && !t.punt) { G.traffic.splice(i, 1); }
      continue;
    }
    /* kamikaze bikes hunt the player once they can see them; everything
       else keeps its lane like a civilian */
    if (t.arch === 'bike' && playing && !G.ai && hyp(t.x - car.x, t.y - car.y) < 760) {
      const st = steerToward(t, car.x + car.vx * 0.2, car.y + car.vy * 0.2);
      t.drive(dt * G.worldSlow, st, 1);
      const bl = G.track.locate(t.x, t.y, t.idx);
      t.idx = bl.i;
      t.offroad = Math.abs(bl.lat) > roadHalf(bl.p) ? 1 : 0;
    } else autoDrive(t, dt * G.worldSlow, false);
    if (t.idx < car.idx - 24 || t.idx > car.idx + 120) { G.traffic.splice(i, 1); continue; }

    const dx = t.x - car.x, dy = t.y - car.y, d = hyp(dx, dy);
    /* Half the sum of the lengths — the distance at which two bodies actually
       touch nose to tail. An earlier 0.36 put it at 33px for two 46px cars, so
       the player drove clean through traffic and the whole verb never fired. */
    const touchR = (t.spec.len + car.spec.len) * 0.52;
    if (playing && !G.ai) {
      if (d < touchR && !t.wrecked && G.power.phase > 0) {
        /* Phase Shift: the car passes clean through and every pass-through
           pays as a thread — for four seconds the dense lane is the prize
           you do NOT wreck */
        if (!t.phased) {
          t.phased = 1;
          const M2 = G.run.M;
          const bonus = Math.round(150 * G.mult * M2.nearMul);
          G.pending += bonus;
          if (G.chainT > 0) G.chainT = Math.min(chainTime(), G.chainT + 0.5);
          toast('Phased +' + fmt(bonus), 'pink');
          NHAudio.nearMiss();
          for (let s = 0; s < 6; s++)
            spawn(t.x, t.y, rnd(-160, 160), rnd(-160, 160),
                  rnd(0.15, 0.35), rnd(2, 5), '159,216,255', true, -3);
        }
      } else if (d < touchR && !t.wrecked && G.hitCool <= 0) {
        const rel = hyp(t.vx - car.vx, t.vy - car.vy);
        /* an armored car bounces a cruising bump exactly like a hauler:
           crack it with speed, Boost or a Ram Plate */
        if (t.arch === 'armored' && t.armour > 0
            && !(car.boost || G.power.shield > 0 || rel > 430)) {
          t.armour--;
          t.hitFlash = 1;
          car.vx *= 0.74; car.vy *= 0.74;
          G.hitCool = 0.12;
          G.shake = Math.max(G.shake, 18);
          hitstop(0.05, 16);
          if (!G.power.shield) damage(Math.round(4 * (G.run.M.hullCost || 1)), 'traffic');
          NHAudio.hit(1.2);
          toast('Armoured — hit it harder', 'red');
        } else {
          /* Traffic is the ammunition. Hitting it pays, feeds the chain and
             costs hull — the run ends when the hull does, not on contact. */
          smash(t, rel);
        }
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
  /* Each stretch cleared puts more cars on the road. The escalation has to
     land on the supply rather than only on the pursuit, because traffic is
     what you score with — a later stretch that is merely more dangerous is
     a punishment, and one that is denser is an opportunity that bites. */
  const want = Math.max(4, Math.round((26 + G.stage * 5) * (G.run ? G.run.M.trafficMul : 1)));
  while (liveCount < want) { addTraffic(rint(20, 96)); liveCount++; }

  /* ---- police ---- */
  if (playing && !G.ai && !G.boss) {
    G.policeCool = Math.max(0, (G.policeCool || 0) - dt);
    /* a takedown buys real breathing room before the tier refills */
    while (G.police.length < G.tier && G.policeCool <= 0) addPolice();
    while (G.police.length > G.tier) G.police.pop();
  }
  for (let i = G.police.length - 1; i >= 0; i--) {
    const p = G.police[i];
    p.pipCool = Math.max(0, (p.pipCool || 0) - dt);
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
        if (car.boost || G.power.shield > 0) {
          /* Boosted or plated, the ram goes the other way: pursuit is
             ammunition too. Three pips and the unit is scrap. */
          p.hp = (p.hp || 3) - 1;
          p.vx += nx * 520; p.vy += ny * 520;
          p.a += rnd(-1.2, 1.2);
          p.hitFlash = 1;
          car.vx -= nx * 90; car.vy -= ny * 90;
          G.shake = Math.max(G.shake, 16);
          hitstop(0.05, 18);
          NHAudio.hit(1.2);
          car.inv = 0.5;
          if (p.hp <= 0) { killPolice(p, i); }
          else toast('Unit cracked', 'pink');
        } else {
          car.vx -= nx * 240; car.vy -= ny * 240;
          p.vx += nx * 120; p.vy += ny * 120;
          G.shake = Math.max(G.shake, 18);
          car.hitFlash = 1;
          burnChain(1.0);
          G.heat = Math.max(0, G.heat - 0.25);
          damage(10 + 3 * G.tier, 'police');
          hitstop(0.05, 20);
          NHAudio.hit(1);
          car.inv = 0.8;
          toast('Rammed', 'red');
        }
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
  /* the ribbon drains from the tail whenever it is not being fed */
  if (G.trail.length && (G.state !== 'play' || G.car.speed <= 120)) G.trail.shift();

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

/* ---- the ground the road sits on ----
   One world-aligned grid under every district was the largest single reason
   they all read the same: whatever the barriers were painted, the floor was
   the same floor. Each treatment is a handful of lines in world space, which
   is what the grid already cost. */
function drawGround(){
  const E = envNow();
  ctx.fillStyle = envCol('ground');
  ctx.fillRect(cam.x - 4000, cam.y - 4000, 8000, 8000);

  const R = hyp(W, H) / cam.zoom * 0.62;
  const floor = E.floor || 'grid';
  const lw = 1.4 / cam.zoom;

  /* a lattice on both world axes — the original, and still the downtown */
  const lattice = (S, col, wid) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = wid;
    ctx.beginPath();
    const x0 = Math.floor((cam.x - R) / S) * S;
    for (let x = x0; x <= cam.x + R; x += S) { ctx.moveTo(x, cam.y - R); ctx.lineTo(x, cam.y + R); }
    const y0 = Math.floor((cam.y - R) / S) * S;
    for (let y = y0; y <= cam.y + R; y += S) { ctx.moveTo(cam.x - R, y); ctx.lineTo(cam.x + R, y); }
    ctx.stroke();
  };

  /* Sparse city blocks in the void: a deterministic hash drops a dim slab in
     roughly a third of the cells, so the off-road ground reads as a city seen
     from above rather than as graph paper. Only the treatments that *are* a
     city from above call it — a slab in the middle of the harbour, or under
     an elevated deck, would be reading the ground wrong. */
  const slabs = (S, col) => {
    if (!QF.city) return;
    ctx.fillStyle = col;
    ctx.beginPath();
    const x0 = Math.floor((cam.x - R) / S) * S, y0 = Math.floor((cam.y - R) / S) * S;
    for (let x = x0; x <= cam.x + R; x += S) {
      for (let y = y0; y <= cam.y + R; y += S) {
        const h = ((x * 92837111) ^ (y * 689287499)) % 97;
        if (h % 3) continue;
        const inset = 26 + (h % 5) * 8;
        ctx.rect(x + inset, y + inset, S - inset * 2, S - inset * 2);
      }
    }
    ctx.fill();
  };

  if (floor === 'grid') {
    lattice(240, 'rgba(70,120,190,0.10)', lw);
    slabs(240, 'rgba(120,150,200,0.04)');
  } else if (floor === 'mirror') {
    lattice(300, hexA(E.left, 0.07), lw);
    lattice(75,  hexA(E.right, 0.028), lw * 0.7);
    slabs(300, hexA(E.left, 0.035));
  } else if (floor === 'slab') {
    lattice(420, 'rgba(150,170,220,0.055)', lw * 1.6);
    slabs(420, 'rgba(120,150,200,0.045)');
  } else if (floor === 'concrete') {
    lattice(200, 'rgba(150,150,180,0.05)', lw);
  } else if (floor === 'water' || floor === 'wet') {
    /* long shallow swells crossing the world, scrolling against the car so
       the surface is never still even when the road is straight */
    const S = floor === 'water' ? 108 : 168;
    const drift = (G.dist * (floor === 'water' ? 0.10 : 0.045)) % S;
    ctx.strokeStyle = hexA(E.left, floor === 'water' ? 0.16 : 0.06);
    ctx.lineWidth = lw * (floor === 'water' ? 3.2 : 1.6);
    ctx.beginPath();
    const y0 = Math.floor((cam.y - R) / S) * S - drift;
    for (let y = y0; y <= cam.y + R; y += S) {
      ctx.moveTo(cam.x - R, y);
      /* three segments with a little vertical wander reads as a swell for
         the price of two extra points */
      ctx.lineTo(cam.x - R * 0.33, y + Math.sin(y * 0.011) * 12);
      ctx.lineTo(cam.x + R * 0.33, y - Math.sin(y * 0.013) * 12);
      ctx.lineTo(cam.x + R, y);
    }
    ctx.stroke();
    if (floor === 'water') {
      ctx.strokeStyle = hexA(E.right, 0.10);
      ctx.lineWidth = lw * 1.4;
      ctx.beginPath();
      const y1 = Math.floor((cam.y - R) / S) * S - drift + S * 0.5;
      for (let y = y1; y <= cam.y + R; y += S) { ctx.moveTo(cam.x - R, y); ctx.lineTo(cam.x + R, y); }
      ctx.stroke();
    }
  } else if (floor === 'rail') {
    /* pairs of rails with sleepers between them, laid on the world axis */
    const S = 260, gauge = 34;
    ctx.strokeStyle = 'rgba(190,200,215,0.11)';
    ctx.lineWidth = lw * 2;
    ctx.beginPath();
    const x0 = Math.floor((cam.x - R) / S) * S;
    for (let x = x0; x <= cam.x + R; x += S) {
      ctx.moveTo(x - gauge, cam.y - R); ctx.lineTo(x - gauge, cam.y + R);
      ctx.moveTo(x + gauge, cam.y - R); ctx.lineTo(x + gauge, cam.y + R);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,110,95,0.16)';
    ctx.lineWidth = lw * 5;
    ctx.beginPath();
    const yy0 = Math.floor((cam.y - R) / 46) * 46;
    for (let x = x0; x <= cam.x + R; x += S)
      for (let y = yy0; y <= cam.y + R; y += 46) {
        ctx.moveTo(x - gauge - 12, y); ctx.lineTo(x + gauge + 12, y);
      }
    ctx.stroke();
  } else if (floor === 'dust') {
    /* windblown grit: sparse dashes, no lattice, so the eye finds no order */
    ctx.strokeStyle = 'rgba(190,170,130,0.06)';
    ctx.lineWidth = lw * 2.2;
    ctx.setLineDash([10, 190]);
    ctx.lineDashOffset = -(G.dist * 0.5) % 200;
    ctx.beginPath();
    const y0 = Math.floor((cam.y - R) / 64) * 64;
    for (let y = y0; y <= cam.y + R; y += 64) { ctx.moveTo(cam.x - R, y); ctx.lineTo(cam.x + R, y); }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (floor === 'void') {
    /* A deck over a hole. Nothing under it would be honest and would also
       read as an unpainted canvas, so there is a city a very long way down:
       a hashed scatter of dim points on a coarse lattice, parallaxed to a
       third of the camera's motion so the drop has depth in it. */
    const S = 300, px = cam.x * 0.66, py = cam.y * 0.66;
    ctx.globalCompositeOperation = 'lighter';
    const x0 = Math.floor((px - R) / S) * S, y0 = Math.floor((py - R) / S) * S;
    for (let x = x0; x <= px + R; x += S) {
      for (let y = y0; y <= py + R; y += S) {
        /* one cheap integer hash gives both the jitter and which points
           exist at all — no allocation, and stable as the camera moves */
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        if ((h & 3) !== 0) continue;
        const jx = x + (h % 211) - 105, jy = y + ((h >> 8) % 211) - 105;
        const a = 0.05 + ((h >> 16) & 15) / 15 * 0.09;
        ctx.fillStyle = hexA((h & 4) ? E.left : E.right, a);
        const r = (2 + ((h >> 20) & 3)) / cam.zoom;
        ctx.fillRect(jx - cam.x * 0.34 - r, jy - cam.y * 0.34 - r, r * 2, r * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
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
  ctx.fillStyle = envCol('asphalt');
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
    ctx.strokeStyle = hexA(side < 0 ? envCol('left') : envCol('right'), 0.10);
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
      ctx.strokeStyle = hexA(side < 0 ? envCol('left') : envCol('right'), 0.13);
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

  /* gate lines: a painted band across the road where one stretch hands over
     to the next, so the checkpoint is a place and not just a toast */
  if (G.run && G.run.cfg && !G.run.cfg.boss) {
    for (const st of G.run.cfg.stages) {
      const gi = G.run.startIdx + st.end;
      if (gi < a || gi > b) continue;
      const p = pts[gi];
      if (!p) continue;
      const hw = roadHalf(p);
      const nx = -Math.sin(p.a), ny = Math.cos(p.a);
      ctx.strokeStyle = 'rgba(255,214,110,0.55)';
      ctx.lineWidth = 9;
      ctx.setLineDash([26, 20]);
      ctx.beginPath();
      ctx.moveTo(p.x - nx * hw, p.y - ny * hw);
      ctx.lineTo(p.x + nx * hw, p.y + ny * hw);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ---- the barriers ----
     Five ways of edging a road, because the neon rail was the one thing
     every district had in common and the eye reads edges before it reads
     anything else. `neon` is the original strip; the rest are what the
     places that are not downtown would actually be fenced with. */
  const style = (envNow().rail) || 'neon';
  const dark = LVL().blackout;
  for (const side of [-1, 1]) {
    const edge = (off) => {
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const p = pts[i];
        const hw = (roadHalf(p) + (off || 0)) * side;
        const nx = -Math.sin(p.a) * hw, ny = Math.cos(p.a) * hw;
        if (i === a) ctx.moveTo(p.x + nx, p.y + ny); else ctx.lineTo(p.x + nx, p.y + ny);
      }
    };
    const col = side < 0 ? envCol('left') : envCol('right');
    ctx.lineCap = 'round';

    if (style === 'posts') {
      /* bollards: the same line, chopped. Reads as discrete lamps rather
         than a continuous tube, which is what a deck edge actually is. */
      edge();
      ctx.setLineDash([13, 30]);
      ctx.strokeStyle = hexA(col, 0.26); ctx.lineWidth = 20; ctx.stroke();
      ctx.strokeStyle = col;             ctx.lineWidth = 7;  ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = hexA(col, 0.20); ctx.lineWidth = 1.5; ctx.stroke();
    } else if (style === 'chain') {
      /* chain-link: a dim mesh with a lit top rail — no glow to speak of */
      edge();
      ctx.strokeStyle = 'rgba(150,165,185,0.16)'; ctx.lineWidth = 13; ctx.stroke();
      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = 'rgba(190,205,225,0.30)'; ctx.lineWidth = 11; ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = hexA(col, 0.85); ctx.lineWidth = 2.4; ctx.stroke();
    } else if (style === 'wall') {
      /* poured concrete with a service strip along the top */
      edge(9);
      ctx.strokeStyle = 'rgba(28,30,36,0.95)'; ctx.lineWidth = 30; ctx.stroke();
      edge();
      ctx.strokeStyle = 'rgba(120,130,150,0.26)'; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = hexA(col, dark ? 1 : 0.7); ctx.lineWidth = 3.4; ctx.stroke();
      ctx.strokeStyle = hexA(col, 0.18); ctx.lineWidth = 12; ctx.stroke();
    } else if (style === 'edge') {
      /* a quay: there is no barrier, there is a drop into the water */
      edge(16);
      ctx.strokeStyle = 'rgba(4,8,12,0.9)'; ctx.lineWidth = 40; ctx.stroke();
      edge();
      /* the quay still has to be findable at 400 km/h — a drop you cannot
         see the lip of is not a hazard, it is a cheat */
      ctx.strokeStyle = 'rgba(210,220,235,0.30)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.setLineDash([16, 40]);
      ctx.strokeStyle = hexA(col, 1); ctx.lineWidth = 7; ctx.stroke();
      ctx.setLineDash([]);
    } else {
      edge();
      ctx.strokeStyle = hexA(col, 0.30); ctx.lineWidth = 16; ctx.stroke();
      ctx.strokeStyle = col;             ctx.lineWidth = 5;  ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
}

/* three alpha buckets, one path each — 600 decals in 3 draw calls */
/* The ribbon: a neon light-trail off the rear axle, thin at cruise, wide and
   hot in a drift, white-cored and amber-shifted under boost. Three strokes
   over one polyline per age bucket — cheaper than the smoke it upstages —
   and saturated enough that the bloom pass picks it up for free. */
function drawTrail(){
  const tr = G.trail;
  if (!tr || tr.length < 3) return;
  const base = (G.spec && G.spec.trail) || CL.cyan;
  const boost = G.car && G.car.boost;
  const col = boost ? mix(base, '#FFB13D', 0.55) : base;
  ctx.save();
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  const third = Math.ceil(tr.length / 3);
  for (let b = 0; b < 3; b++) {
    const from = b * third, to = Math.min(tr.length, from + third + 1);
    if (to - from < 2) continue;
    /* oldest bucket first and dimmest; each bucket carries its mean heat */
    let k = 0;
    for (let i = from; i < to; i++) k += tr[i].k;
    k /= (to - from);
    const age = (b + 1) / 3;
    ctx.beginPath();
    ctx.moveTo(tr[from].x, tr[from].y);
    for (let i = from + 1; i < to; i++) ctx.lineTo(tr[i].x, tr[i].y);
    ctx.strokeStyle = hexA(col, 0.10 * age * k);
    ctx.lineWidth = 12 + k * 8;
    ctx.stroke();
    ctx.strokeStyle = hexA(col, 0.42 * age * k);
    ctx.lineWidth = 3.5 + k * 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * age * k).toFixed(3) + ')';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

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
    if (p.st) {
      /* streak: a short line along the velocity — reads as a flying spark
         where a dot reads as confetti */
      const sp = hyp(p.vx, p.vy) || 1;
      const sl = Math.min(18, sp * 0.04);
      ctx.strokeStyle = 'rgba(' + p.col + ',' + (t * 0.9).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, p.r * 0.6);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx / sp * sl, p.y - p.vy / sp * sl);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(' + p.col + ',' + (t * (p.add ? 0.85 : 0.30)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* Burning slicks, drawn additively under the cars so the road glows through
   the fire rather than the pool sitting on it like a decal.

   Composited with 'screen' rather than 'lighter'. Additive was the obvious
   choice and it was wrong: a wake is dense enough that three blobs overlap,
   and 3x an orange clips both R and G to 255 — the fire came out white, then
   the bloom pass finished the job and it read as smoke. Screen saturates
   toward the source colour instead of toward white, so a thick patch of it
   is deep orange rather than blown out.

   Also cheap by construction: one radial gradient per slick per frame
   allocates 34 objects a frame at this drop rate, so the blob is baked once
   and blitted. */
let slickSprite = null;
function makeSlickSprite(){
  const R = 64, c = document.createElement('canvas');
  c.width = c.height = R * 2;
  const g = c.getContext('2d');
  const rad = g.createRadialGradient(R, R, 0, R, R, R);
  rad.addColorStop(0,    'rgba(255,196,92,0.98)');
  rad.addColorStop(0.30, 'rgba(255,132,38,0.78)');
  rad.addColorStop(0.64, 'rgba(228,58,20,0.34)');
  rad.addColorStop(1,    'rgba(180,30,12,0)');
  g.fillStyle = rad;
  g.fillRect(0, 0, R * 2, R * 2);
  return c;
}

/* Burning slicks, drawn under the cars so the road glows through the fire
   rather than the pool sitting on it like a decal.

   Composited with 'screen' rather than 'lighter'. Additive was the obvious
   choice and it was wrong: a wake is dense enough that three blobs overlap,
   and three times an orange clips both R and G to 255 — the fire came out
   white, and the bloom pass finished the job. Screen saturates toward the
   source colour instead of toward white, so a thick patch reads as deep
   orange rather than blown out.

   Cheap by construction: one gradient per slick per frame would allocate
   thirty-odd objects a frame at this drop rate, so the blob is baked once
   and blitted. */
function drawSlicks(){
  if (!G.slicks.length) return;
  if (!slickSprite) slickSprite = makeSlickSprite();
  ctx.globalCompositeOperation = 'screen';
  for (const s of G.slicks) {
    const fade = clamp(Math.min(s.life, 1.2) / 1.2, 0, 1);
    const r = s.r * (0.86 + Math.sin(s.t * 8 + s.x * 0.01) * 0.14);
    ctx.globalAlpha = 0.95 * fade;
    ctx.drawImage(slickSprite, s.x - r, s.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
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

  /* underglow — reads as ground contact and feeds the bloom. On the player
     it burns brighter as the chain heats up: the car itself is the combo meter
     you can read without looking at the HUD. */
  if (o.glow !== false) {
    ctx.globalCompositeOperation = 'lighter';
    const hot = v.kind === 'player' ? Math.min(0.35, (G.mult - 1) * 0.045) : 0;
    blitGlow(s.col, 0, 0, s.len * (0.9 + hot), s.wid * (1.4 + hot), 0.30 + hot);
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

  /* panel lines: a hood seam and a boot seam, so the body reads as sheet
     metal rather than a jellybean */
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1;
  for (const px of [0.18, -0.32]) {
    ctx.beginPath();
    ctx.moveTo(s.len * px, -s.wid * 0.34);
    ctx.lineTo(s.len * px, s.wid * 0.34);
    ctx.stroke();
  }

  /* the hardware you bought is bolted to the car you drive, not only the
     one in the garage — buying a part changes THIS picture too */
  if (v.kind === 'player') drawFitted(ctx, s, 1);

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

  /* headlights + cones — an impact kills the lights for a beat */
  const lampA = 1 - v.hitFlash * 0.55;
  for (const sy of [-1, 1]) {
    ctx.fillStyle = 'rgba(220,245,255,' + (0.95 * lampA).toFixed(2) + ')';
    ctx.fillRect(s.len * 0.44, sy * s.wid * 0.30 - s.wid * 0.05, s.len * 0.06, s.wid * 0.11);
  }
  /* a charging boss telegraphs with the lights: the cone burns red */
  const charging = v.kind === 'boss' && v.charge > 0;
  if (o.lights !== false || charging) {
    const lc = charging ? '255,60,70' : '190,230,255';
    const lg = ctx.createLinearGradient(s.len * 0.5, 0, s.len * 2.6, 0);
    lg.addColorStop(0, 'rgba(' + lc + ',' + (charging ? 0.45 : 0.20) + ')');
    lg.addColorStop(1, 'rgba(' + lc + ',0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(s.len * 0.5, -s.wid * 0.4);
    ctx.lineTo(s.len * 2.6, -s.wid * 1.5);
    ctx.lineTo(s.len * 2.6, s.wid * 1.5);
    ctx.lineTo(s.len * 0.5, s.wid * 0.4);
    ctx.closePath(); ctx.fill();
  }

  /* tail lights, brighter while sliding, streaking under drift or boost */
  const tb = 0.55 + v.drift * 0.45;
  ctx.fillStyle = 'rgba(255,60,70,' + tb.toFixed(2) + ')';
  for (const sy of [-1, 1]) {
    ctx.fillRect(-s.len * 0.5, sy * s.wid * 0.28 - s.wid * 0.05, s.len * 0.05, s.wid * 0.11);
    const streak = (v.drift * 0.6 + (v.boost ? 0.8 : 0)) * s.len * 0.4;
    if (streak > 2) {
      const sg = ctx.createLinearGradient(-s.len * 0.5, 0, -s.len * 0.5 - streak, 0);
      sg.addColorStop(0, 'rgba(255,60,70,' + (tb * 0.5).toFixed(2) + ')');
      sg.addColorStop(1, 'rgba(255,60,70,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-s.len * 0.5 - streak, sy * s.wid * 0.28 - s.wid * 0.04, streak, s.wid * 0.08);
      ctx.fillStyle = 'rgba(255,60,70,' + tb.toFixed(2) + ')';
    }
  }

  /* pursuit dress: red rim, push-bar, and armour pips over the roof */
  if (v.kind === 'police') {
    ctx.strokeStyle = hexA('#FF3355', 0.9);
    ctx.lineWidth = 1.4;
    carPath(ctx, s); ctx.stroke();
    ctx.fillStyle = '#0A0E18';
    ctx.strokeStyle = hexA('#FF3355', 0.7);
    ctx.beginPath();
    ctx.roundRect(s.len * 0.48, -s.wid * 0.45, s.len * 0.06, s.wid * 0.9, 2);
    ctx.fill(); ctx.stroke();
    if (v.hp != null && v.hp < 3) {
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k < v.hp ? 'rgba(255,90,110,0.95)' : 'rgba(255,90,110,0.22)';
        ctx.fillRect(-s.len * 0.12 + k * s.len * 0.11, -s.wid * 0.72, s.len * 0.08, s.wid * 0.12);
      }
    }
  }

  /* police bar */
  if (v.kind === 'police' || v.kind === 'boss') {
    const f = Math.sin(v.lamp) > 0;
    ctx.fillStyle = f ? 'rgba(80,140,255,0.95)' : 'rgba(255,50,70,0.95)';
    ctx.fillRect(-s.len * 0.08, -s.wid * 0.5, s.len * 0.1, s.wid);
    blitGlow(f ? '#508CFF' : '#FF3246', 0, 0, s.len * 1.5, s.len * 1.5, 0.40);
  }

  /* each pursuit unit wears its division: the WARDEN a plow blade, the
     SIREN a rotating dish, the REAPER twin burners that never shut off */
  if (v.kind === 'boss' && v.def) {
    if (v.def.id === 'warden') {
      ctx.fillStyle = '#241016';
      ctx.strokeStyle = hexA('#FFB13D', 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.len * 0.46, -s.wid * 0.72);
      ctx.lineTo(s.len * 0.66, 0);
      ctx.lineTo(s.len * 0.46, s.wid * 0.72);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (v.def.id === 'siren') {
      ctx.strokeStyle = hexA('#FF3355', 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, s.wid * 0.46, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(v.lamp * 1.6) * s.wid * 0.46, Math.sin(v.lamp * 1.6) * s.wid * 0.46);
      ctx.stroke();
    } else if (v.def.id === 'reaper') {
      for (const sy of [-1, 1]) {
        const fl = s.len * (0.5 + Math.sin(v.lamp * 4 + sy) * 0.12);
        const fg = ctx.createLinearGradient(-s.len * 0.5, 0, -s.len * 0.5 - fl, 0);
        fg.addColorStop(0, 'rgba(255,120,140,0.8)');
        fg.addColorStop(1, 'rgba(255,40,80,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(-s.len * 0.5 - fl, sy * s.wid * 0.26 - s.wid * 0.07, fl, s.wid * 0.14);
      }
    }
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

  /* Everything with height shares one projection: push the footprint away
     from the screen centre in proportion to how tall it is. Props and spans
     ride the same maths as the blocks do, which is why they cost almost
     nothing to add. */
  const rise = (pt, h) => {
    const k = h * 0.00058 * cam.zoom;
    return [pt[0] + (pt[0] - cx) * k, pt[1] + (pt[1] - cy) * k];
  };

  const list = [];
  for (let i = b; i >= a; i--) {
    const p = pts[i];
    if (!p.b) continue;
    /* fade the last stretch in rather than popping at the range boundary */
    const fade = clamp((b - i) / 6, 0.12, 1);
    for (const bd of p.b) { bd.fade = fade; list.push(bd); }
  }

  const flickT = performance.now() * 0.007;
  for (const bd of list) {
    ctx.globalAlpha = bd.fade || 1;
    if (bd.kind && bd.kind !== 'block') { drawProp(bd, rise, cx, cy); continue; }
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
      /* A container is a painted steel box, not a facade: it takes its own
         colour rather than the district's dark glass, which is the whole
         difference between a rail yard and a skyline. */
      const crate = bd.mode === 'stack';
      ctx.fillStyle = crate ? mix(bd.hue, '#0A0A0E', i % 2 ? 0.70 : 0.80)
                            : (i % 2 ? (bd.face1 || '#141A2D') : (bd.face2 || '#0F1424'));
      ctx.fill();

      if ((bd.lit || crate) && QF.windows && !LVL().blackout) {
        ctx.save();
        ctx.clip();
        /* dashed rows read as lit windows; solid rows read as corrugation */
        ctx.strokeStyle = hexA(bd.hue, crate ? 0.16 : 0.34);
        ctx.lineWidth = Math.max(0.8, 1.6 * cam.zoom);
        if (crate) ctx.setLineDash([]);
        else ctx.setLineDash([Math.max(1.5, 3 * cam.zoom), Math.max(3, 6 * cam.zoom)]);
        ctx.lineDashOffset = bd.seed;
        ctx.beginPath();
        const floors = crate ? 8 : 3 + Math.floor(bd.h / 120);
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
    ctx.fillStyle = bd.mode === 'stack' ? mix(bd.hue, '#0A0A0E', 0.52) : '#1A2138';
    ctx.fill();

    /* neon roofline — the city's whole read comes from this one stroke.
       About one sign in seven carries a buzz: real neon is never steady. */
    if (bd.lit && !LVL().blackout) {
      const buzz = (Math.floor(Math.abs(bd.seed)) % 7 === 0)
        ? 0.65 + 0.35 * Math.max(0, Math.sin(flickT + bd.seed) * Math.sin(flickT * 2.3 + bd.seed))
        : 1;
      ctx.strokeStyle = hexA(bd.hue, buzz);
      ctx.lineWidth = Math.max(1.2, 2.4 * cam.zoom);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(bd.hue, 0.32 * buzz);
      ctx.lineWidth = Math.max(2, 9 * cam.zoom);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalAlpha = 1;

  /* Overhead. A top-down road can only say "fast" with the ground, and the
     ground is behind you the moment you look at it. Something passing over
     the car is the one read of speed the camera angle gives away for free —
     and a gantry is a place, where a coloured barrier is only a colour. */
  drawSpans(a, b, rise, cx, cy);

  /* depth fog: the top of the screen is the far distance, so fade it out */
  const dark = LVL().blackout;
  const fog = ctx.createLinearGradient(0, 0, 0, camY() * 0.84);
  fog.addColorStop(0,    dark ? 'rgba(5,6,14,0.95)' : 'rgba(5,6,14,0.72)');
  fog.addColorStop(0.45, dark ? 'rgba(5,6,14,0.62)' : 'rgba(5,6,14,0.30)');
  fog.addColorStop(1,    'rgba(5,6,14,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, camY() * 0.84);
}

/* ---- roadside structures ----
   Four silhouettes, each a handful of quads in the same projection the
   blocks use. They are what tells you a yard from a wharf from a pour floor
   before you have read a single word of the brief. */
function drawProp(bd, rise, cx, cy){
  const base = w2s(bd.x, bd.y);
  if (base[0] < -400 || base[0] > W + 400 || base[1] < -600 || base[1] > H + 400) return;
  const dark = LVL().blackout;
  const beam = (p0, p1, wide, col) => {
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, wide * cam.zoom);
    ctx.strokeStyle = col;
    ctx.stroke();
  };
  const nx = -Math.sin(bd.a), ny = Math.cos(bd.a);

  if (bd.kind === 'crane') {
    /* dockside gantry crane: a mast, a jib out over the water, a hanging
       cable. Three strokes, and the wharf stops being a road with lights. */
    const mastTop = rise(base, 460);
    beam(base, mastTop, 9, '#141821');
    const jibEnd = w2s(bd.x + nx * 150 * -bd.side, bd.y + ny * 150 * -bd.side);
    const jibTip = rise(jibEnd, 430);
    beam(mastTop, jibTip, 6, '#141821');
    beam(mastTop, rise(w2s(bd.x + nx * 60 * bd.side, bd.y + ny * 60 * bd.side), 300), 5, '#141821');
    if (!dark) {
      beam(jibTip, rise(jibEnd, 250), 1.6, hexA(bd.hue, 0.35));
      blitGlowScreen(bd.hue, jibTip[0], jibTip[1], 26, 26, 0.5);
      blitGlowScreen(bd.hue, mastTop[0], mastTop[1], 20, 20, 0.4);
    }
  } else if (bd.kind === 'silo' || bd.kind === 'tank') {
    /* a fat cylinder read as a quad with a banded top; tanks sit lower and
       squatter than silos, which is the whole difference */
    const tall = bd.kind === 'silo' ? 340 : 150;
    const rad = bd.kind === 'silo' ? 46 : 78;
    const l = w2s(bd.x + nx * rad, bd.y + ny * rad);
    const r = w2s(bd.x - nx * rad, bd.y - ny * rad);
    const lt = rise(l, tall), rt = rise(r, tall);
    ctx.beginPath();
    ctx.moveTo(l[0], l[1]); ctx.lineTo(r[0], r[1]);
    ctx.lineTo(rt[0], rt[1]); ctx.lineTo(lt[0], lt[1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(l[0], l[1], r[0], r[1]);
    g.addColorStop(0, '#0C0E13'); g.addColorStop(0.4, '#1C2029'); g.addColorStop(1, '#0A0C11');
    ctx.fillStyle = g; ctx.fill();
    if (!dark) {
      beam(lt, rt, 3, hexA(bd.hue, 0.7));
      beam([lerp(l[0], lt[0], 0.45), lerp(l[1], lt[1], 0.45)],
           [lerp(r[0], rt[0], 0.45), lerp(r[1], rt[1], 0.45)], 1.5, hexA(bd.hue, 0.22));
    }
  } else if (bd.kind === 'mast') {
    /* a signage mast: a pole and a lit panel, the vertical the market row
       is built out of */
    const top = rise(base, 240);
    beam(base, top, 4, '#12151C');
    const panelL = rise(w2s(bd.x + nx * 26, bd.y + ny * 26), 250);
    const panelR = rise(w2s(bd.x - nx * 26, bd.y - ny * 26), 160);
    if (!dark) {
      ctx.beginPath();
      ctx.moveTo(panelL[0], panelL[1]); ctx.lineTo(panelR[0], panelR[1]);
      ctx.lineTo(panelR[0], panelR[1] + 22 * cam.zoom);
      ctx.lineTo(panelL[0], panelL[1] + 22 * cam.zoom);
      ctx.closePath();
      ctx.fillStyle = hexA(bd.hue, 0.55 + Math.sin(bd.seed + G.dist * 0.004) * 0.2);
      ctx.fill();
      blitGlowScreen(bd.hue, (panelL[0] + panelR[0]) * 0.5, (panelL[1] + panelR[1]) * 0.5,
                     30, 18, 0.55);
    }
  }
}

/* Glow blits are written for world space inside the camera transform; the
   city pass runs in screen space, so it needs its own. */
function blitGlowScreen(col, x, y, rx, ry, alpha){
  if (!QF.glow) return;
  const s = glowSprite(col);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/* ---- what passes over the road ----
   A gantry spans it on two legs, a rib is a tunnel hoop, a sign hangs a lit
   panel across the lanes. All three are the road's own cross-section pushed
   up by the block projection, so they follow the corner the road is taking. */
function drawSpans(a, b, rise, cx, cy){
  const pts = G.track.pts;
  const dark = LVL().blackout;
  for (let i = b; i >= a; i--) {
    const p = pts[i];
    if (!p || !p.span) continue;
    const E = p.z;
    const hw = roadHalf(p) + 26;
    const nx = -Math.sin(p.a) * hw, ny = Math.cos(p.a) * hw;
    const lb = w2s(p.x + nx, p.y + ny), rb = w2s(p.x - nx, p.y - ny);
    if (lb[1] < -400 && rb[1] < -400) continue;
    const lt = rise(lb, p.span.h), rt = rise(rb, p.span.h);
    const kind = p.span.kind;

    if (kind === 'rib') {
      /* a hoop: one thick dark band with a lit inner edge. Repeated every
         few segments it becomes a tunnel without a tunnel ever being built. */
      ctx.beginPath();
      ctx.moveTo(lb[0], lb[1]);
      ctx.quadraticCurveTo((lt[0] + rt[0]) * 0.5, (lt[1] + rt[1]) * 0.5 - 26 * cam.zoom,
                           rb[0], rb[1]);
      ctx.lineWidth = Math.max(2, 16 * cam.zoom);
      ctx.strokeStyle = 'rgba(12,13,20,0.92)';
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 3 * cam.zoom);
      ctx.strokeStyle = hexA(E.left, dark ? 0.75 : 0.38);
      ctx.stroke();
      continue;
    }

    /* legs */
    for (const [base, top] of [[lb, lt], [rb, rt]]) {
      ctx.beginPath();
      ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]);
      ctx.lineWidth = Math.max(1.5, 8 * cam.zoom);
      ctx.strokeStyle = '#10131B';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    /* the beam across. A gantry gets a second chord and cross members, so
       it reads as built structure rather than a bar laid on the sky. */
    ctx.beginPath();
    ctx.moveTo(lt[0], lt[1]); ctx.lineTo(rt[0], rt[1]);
    ctx.lineWidth = Math.max(2, (kind === 'sign' ? 18 : 11) * cam.zoom);
    ctx.strokeStyle = '#0F1219';
    ctx.stroke();
    if (kind === 'gantry') {
      const ml = rise(lb, p.span.h * 0.74), mr = rise(rb, p.span.h * 0.74);
      ctx.beginPath();
      ctx.moveTo(ml[0], ml[1]); ctx.lineTo(mr[0], mr[1]);
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        ctx.moveTo(lerp(ml[0], mr[0], t), lerp(ml[1], mr[1], t));
        ctx.lineTo(lerp(lt[0], rt[0], t + (k % 2 ? 0.08 : -0.08)),
                   lerp(lt[1], rt[1], t + (k % 2 ? 0.08 : -0.08)));
      }
      ctx.lineWidth = Math.max(1, 3 * cam.zoom);
      ctx.strokeStyle = '#141822';
      ctx.stroke();
    }
    if (!dark) {
      ctx.lineWidth = Math.max(1, 2.6 * cam.zoom);
      ctx.strokeStyle = hexA(kind === 'sign' ? E.bldA : E.right, 0.75);
      ctx.stroke();
      if (kind === 'sign') {
        /* the lit face of the panel, hung under the beam */
        const drop = 13 * cam.zoom;
        ctx.beginPath();
        ctx.moveTo(lt[0], lt[1] + drop * 0.4); ctx.lineTo(rt[0], rt[1] + drop * 0.4);
        ctx.lineWidth = Math.max(1.5, 9 * cam.zoom);
        ctx.strokeStyle = hexA(E.bldB, 0.30 + Math.sin(p.span.seed + G.dist * 0.006) * 0.12);
        ctx.stroke();
      }
      blitGlowScreen(kind === 'sign' ? E.bldA : E.right,
                     (lt[0] + rt[0]) * 0.5, (lt[1] + rt[1]) * 0.5,
                     Math.abs(rt[0] - lt[0]) * 0.5 + 20, 26, 0.28);
    }
  }
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
      blitGlow(side < 0 ? envCol('left') : envCol('right'), x, y, 46, 46, 0.30);
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
  /* --- boss aura + the SIREN's pulse telegraph ---
     The pulse wipes any fat bank, and until now the warning variable was set
     every cycle and never drawn: a mechanic that deletes your money had no
     visual at all. An expanding red ring closes on the boss as the pulse
     arms — see it reach the rim, bank NOW. */
  if (G.boss) {
    const b = G.boss;
    ctx.globalCompositeOperation = 'lighter';
    blitGlow(CL.red, b.x, b.y, 190, 190, 0.22);
    if (G.pulseWarn > 0 && b.atk > 0) {
      const p = clamp(b.atk / 0.9, 0, 1);          // 1 → armed at 0
      const rr = 90 + 560 * p;
      ctx.strokeStyle = hexA(CL.red, 0.16);
      ctx.lineWidth = 26;
      ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = hexA(CL.red, 0.75);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

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
    /* a column of light so the pickup reads through a wall of traffic */
    const cg = ctx.createLinearGradient(0, 0, 0, -110);
    cg.addColorStop(0, 'rgba(' + kind.rgb + ',0.30)');
    cg.addColorStop(1, 'rgba(' + kind.rgb + ',0)');
    ctx.fillStyle = cg;
    ctx.fillRect(-3, -110, 6, 110);
    /* the district-long rares wear a slow dashed halo — rarity you can
       read three lanes away */
    if (kind.lasting) {
      ctx.strokeStyle = 'rgba(' + kind.rgb + ',0.65)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = -k.spin * 18;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
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
  ctx.fillStyle = envCol('ground');
  ctx.fillRect(0, 0, cv.width, cv.height);

  applyCam();
  drawGround();
  drawRoad();
  drawSkids();
  drawTrail();
  drawLamps();
  drawSlicks();
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
  brief:$('brief'), cleared:$('cleared'),
  map:$('map'), contract:$('contract'), depot:$('depot'), mapBuild:$('mapBuild'),
  daily:$('daily'), board:$('board'), levelup:$('levelup'),
  xp:$('xp'), xpLvl:$('xpLvl'), xpNext:$('xpNext'), xpFill:$('xpFill'),
  hull:$('hull'), hullVal:$('hullVal'), hullFill:$('hullFill'), wreck:$('wreckChain'),
  obj:$('obj'), objLbl:$('objLbl'), objVal:$('objVal'), objFill:$('objFill'),
  objDist:$('objDist'), objPend:$('objPend'), dchip:$('dchip'), build:$('build'),
  convoy:$('convoy'), convoyLeft:$('convoyLeft'), lvlUp:$('lvlUp')
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
  if (G.power.phase > 0)         list.push(['phase', 'Phase Shift', G.power.phase]);
  if (G.power.draft > 0)         list.push(['draft', 'Overdraft', G.power.draft]);
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
  /* the meter escalates in dress as it climbs, and screams when a SIREN
     pulse is about to eat what you are holding */
  UI.combo.classList.toggle('t2', G.mult >= 4);
  UI.combo.classList.toggle('t3', G.mult >= 8);
  UI.combo.classList.toggle('threat', G.pulseWarn > 0 && !!G.boss
    && G.pending > Math.max(2400, G.boss.maxHp * 0.2));

  /* hull */
  const hf = clamp(G.hp / G.hpMax, 0, 1);
  UI.hull.classList.toggle('on', G.state === 'play' || G.state === 'crash');
  UI.hull.classList.toggle('warn', hf < 0.6 && hf >= 0.3);
  UI.hull.classList.toggle('crit', hf < 0.3);
  UI.hullVal.textContent = Math.max(0, Math.ceil(G.hp));
  UI.hullFill.style.width = hf * 100 + '%';
  UI.wreck.classList.toggle('on', G.chain > 1);
  if (G.chain > 1) UI.wreck.textContent = G.chain + ' car pile-up';

  const run0 = G.run;
  if (run0) {
    const maxed = run0.level >= LEVEL_CAP;
    const flaring = G.levelFlare > 0;
    UI.xp.classList.toggle('max', maxed);
    UI.xp.classList.toggle('up', flaring);
    UI.xpLvl.textContent = run0.level;
    /* Through the flare the rail reads as the bar you were filling reaching
       the end, rather than as the new level's nearly empty one. The
       completion is the thing being announced, and without holding it the
       bar resets before you have looked at it. */
    UI.xpNext.textContent = maxed ? 'MAX' : flaring ? 'LEVEL UP'
      : Math.floor(run0.xp) + ' / ' + xpFor(run0.level);
    UI.xpFill.style.width =
      (maxed || flaring ? 100 : clamp(run0.xp / xpFor(run0.level), 0, 1) * 100) + '%';
  }

  const chasing = G.convoyState === 'live' && G.convoyLeft > 0;
  UI.convoy.classList.toggle('on', chasing);
  if (chasing) UI.convoyLeft.textContent = G.convoyLeft;

  UI.heat.classList.toggle('on', G.heat > 0.05 || G.tier > 0);
  UI.heat.classList.toggle('max', G.tier >= 3);
  heatPips.forEach((el, i) => el.classList.toggle('lit', i < G.tier));

  /* objective rail: quota progress, or the boss's remaining integrity */
  const run = G.run, cfg = run && run.cfg;
  if (cfg) {
    const stage = cfg.stages[Math.min(G.stage, cfg.stages.length - 1)];
    /* the chip names the place you are actually in, not the district index —
       three stretches mean the district label alone stopped being true */
    UI.dchip.textContent = cfg.boss ? 'Pursuit'
      : zoneById(stage.zone).name + '  ·  ' + (G.stage + 1) + '/' + cfg.stages.length;
    const bossing = !!G.boss;
    UI.obj.classList.toggle('boss', bossing);
    if (bossing) {
      const bk = G.boss.breakT > 0;
      UI.objLbl.textContent = G.boss.def.name +
        (bk ? ' — breaking off' : ' — phase ' + (G.boss.phase + 1) + '/' + BOSS_PHASES);
      UI.objVal.textContent = Math.max(0, Math.ceil(G.boss.hp / G.boss.maxHp * 100)) + '%';
      UI.objFill.style.width = clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100 + '%';
      /* the ghost shows how far the bank in hand would actually take it —
         capped, so the bar stops promising a kill it cannot deliver */
      const bite = Math.min(G.pending, Math.round(G.boss.maxHp * BOSS_BITE)) * (bk ? 0.35 : 1);
      UI.objPend.style.width = clamp((G.boss.hp - bite) / G.boss.maxHp, 0, 1) * 100 + '%';
      UI.obj.classList.toggle('pending', G.pending > 0);
    } else {
      /* Until the quota is met the number that matters is the one owed at
         the *next* gate. Once it is met the gates are all paid for, so the
         rail switches to what overtime is actually paying. */
      UI.obj.classList.toggle('overtime', !!run.overtime);
      const owed = Math.max(1, Math.round(run.quota * stage.cut));
      UI.objLbl.textContent = run.overtime ? 'Overtime \u00d71.5 XP'
        : G.stage >= cfg.stages.length - 1 ? 'Quota' : 'Checkpoint ' + (G.stage + 1);
      UI.objVal.textContent = run.overtime
        ? fmt(run.banked) + ' banked'
        : fmt(Math.min(run.banked, owed)) + ' / ' + fmt(owed);
      UI.objFill.style.width =
        clamp(run.banked / (run.overtime ? run.quota : owed), 0, 1) * 100 + '%';
      /* A ghost segment for the pending bank. Without it the bar sits dead
         still through a ten-second chain and the quota looks broken. */
      const ghost = clamp((run.banked + G.pending) / owed, 0, 1) * 100;
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
  for (const id of run.perks) counts[id] = (counts[id] || 0) + 1;
  let html = '';
  for (const id in counts) {
    const p = NHChips.perkById(id);
    if (!p) continue;
    html += '<i class="' + p.rarity + '">' + p.name +
            (counts[id] > 1 ? '<b>&times;' + counts[id] + '</b>' : '') + '</i>';
  }
  for (const id of run.curses) {
    const c = NHChips.curseById(id);
    html += '<i class="curse">' + c.name + '</i>';
  }
  el.innerHTML = html || '<i style="opacity:.5">No perks yet</i>';
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
  /* the menu is the store screenshot: put a road's worth of traffic in the
     attract driver's path so the backdrop shows a game, not empty asphalt */
  for (let i = 0; i < 14; i++) addTraffic(rint(6, 70));
  show(UI.menu); hide(UI.over); hide(UI.garage);
  hide(UI.map); hide(UI.contract); hide(UI.depot); hide(UI.brief); hide(UI.cleared);
  hide(UI.daily); hide(UI.board); hide(UI.levelup);
  UI.hud.classList.add('off');
  $('menuBest').textContent = 'District ' + (Save.data.deepest || 1) +
    (Save.data.best ? '  ·  ' + fmt(Save.data.best) : '');
}

/* ---- cold boot ----
   CrazyGames requires a game to land directly in gameplay, and their Basic
   Launch conversion metric counts players who reach one minute of play. This
   game was asking for five screens first — menu, garage, route map, contract
   wager, district brief — none of which mean anything to somebody who has not
   yet seen the car move.

   A fresh session now takes the opening district on the house: the first
   standard node on the board, no wager, driving within a second of load.
   Every one of those screens still exists and still gets used — they sit
   between runs, from the second run on, where the vocabulary to read them
   has been earned. */
function bootIntoPlay(){
  hide(UI.menu); hide(UI.over); hide(UI.garage); hide(UI.cleared);
  Hangar.grantStarter();
  G.run = newRun();
  G.score = 0; G.topMult = 1; G.coinsRun = 0; G.revived = false; G.totalWreck = 0;
  G.pendingLevels = 0; G.awaitingAdvance = false;
  shownScore = 0;

  const run = G.run;
  /* row 0 is a safe/greedy fork — open on the safe one */
  const col = Math.max(0, run.route[0].findIndex(n => n.type === 'run'));
  run.row = 0; run.col = col;
  run.node = run.route[0][col];
  run.contract = 'clear';           // the opening district is never a wager
  beginNode(true);
}

function startRun(){
  hide(UI.menu); hide(UI.over); hide(UI.garage); hide(UI.cleared);
  G.run = newRun();
  G.score = 0; G.topMult = 1; G.coinsRun = 0; G.revived = false; G.totalWreck = 0;
  G.pendingLevels = Tree.has('t_head') ? 1 : 0; G.awaitingAdvance = false;
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
  hide(UI.cleared); hide(UI.contract); hide(UI.depot); hide(UI.brief);
  $('mAct').textContent = run.act;
  const th = THEMES[(run.act - 1) % THEMES.length];
  $('mTitle').textContent = th.name;
  /* the board wears the act's colours, so act 2 feels like a new city
     before you have driven a metre of it */
  UI.map.style.setProperty('--mapL', th.left);
  UI.map.style.setProperty('--mapR', th.right);
  $('mScore').textContent = fmt(G.score);
  $('mCleared').textContent = run.cleared;
  /* Quotas move with your level now, so the board has to re-read them
     rather than trust what makeRoute baked in at act start. */
  run.route.forEach(row => row.forEach(n => {
    if (n.type !== 'boss' && n.type !== 'depot')
      n.quota = districtCfg(n.district, n.type, run.act).quota;
  }));
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
        /* Which three places a district is made of is half of what you are
           choosing between, so the board states it rather than saving it
           for the brief you see after committing. */
        `${(node.zones || []).length > 1
            ? '<span class="pzones">' +
              node.zones.map(z => zoneById(z).name).join(' \u00b7 ') + '</span>' : ''}` +
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
    : 'Risk buys levels \u2014 the safe run pays none';

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
      '<div class="cpay">' + (k.risk >= 2 ? 'Hazard pay &middot; double XP' : k.risk === 1 ? 'Hazard pay &middot; +50% XP' : 'Standard rate') + '</div>';
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
    name: 'Field promotion', risk: 0,
    bane: 'You bank nothing here.',
    boon: 'A level on the spot — take a perk from three.',
    pay: 'Free level',
    go(){
      hide(UI.depot);
      run.node.done = true;
      G.pendingLevels++;
      G.awaitingAdvance = true;
      G.state = 'play';                 // maybeLevelUp only fires while driving
      maybeLevelUp();
      if (G.state !== 'levelup') { G.awaitingAdvance = false; advance(); }
    }
  });
  opts.push({
    name: 'Panel beating', risk: 0,
    bane: 'You bank nothing here.',
    boon: 'Hull fully repaired and the frame reinforced.',
    pay: '+12 max hull',
    go(){
      run.hullBonus += 12;
      G.hpMax += 12; G.hp = G.hpMax;
      toast('Hull rebuilt', 'gold');
      NHAudio.clear();
      hide(UI.depot); run.node.done = true; advance();
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
        rebuildMods();
        toast('Stripped ' + NHChips.curseById(gone).name, 'gold');
        NHAudio.clear();
        hide(UI.depot);
        run.node.done = true;
        advance();
      }
    });
  } else {
    opts.push({
      name: 'Sell the salvage', risk: 1,
      bane: 'Nothing repaired, no perk.',
      boon: 'Coins you keep after the run ends.',
      pay: '+' + fmt(500 + run.district * 90) + ' coins',
      go(){
        G.coinsRun += 500 + run.district * 90;
        toast('Salvage sold', 'gold');
        NHAudio.clear();
        hide(UI.depot); run.node.done = true; advance();
      }
    });
  }

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
function beginNode(skipBrief){
  const run = G.run;
  /* the node's own number, not a counter — see makeRoute */
  run.district = run.node.district;
  run.cfg = districtCfg(run.district, run.node.type, run.act);

  /* the stretch index has to be zero before the mods are built: rebuildMods
     folds in the rule of the stretch you are standing in */
  G.stage = 0;
  rebuildMods();
  run.quota = Math.round(run.cfg.quota * run.L.quotaMul);
  run.banked = 0;
  run.overtime = false;
  run.crumpleLeft = run.M.crumple;

  newWorld(false);
  run.startIdx = G.car.idx;
  run.elapsed = 0;
  G.car.topBonus = 0;
  G.heat = run.cfg.heatFloor + run.M.policeStart;
  /* the first district a new player ever drives has no pursuit in it,
     whatever the node or the contract says — the mugging at 9 seconds is
     how you lose the player who was deciding whether to have a second run.
     The flag holds for the whole district: banked heat and elite floors
     re-created the cop mid-district when only the start was zeroed. */
  run.grace = run.act === 1 && run.district === 1 && (Save.data.runs || 0) < 3;
  if (run.grace) G.heat = 0;
  G.tier = Math.min(3, Math.floor(G.heat));
  G.policeCool = 0;
  if (run.L.hazards) seedHazards();

  if (skipBrief) beginDistrict(); else showBrief();
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
  /* The city ends at act 3 — unless the player armed the Loop at the boss.
     Past there the ladder simply keeps climbing: fresh board, wrapping
     themes, quotas still compounding. The ceiling is the player. */
  if (run.act >= 3 && !run.loopArmed) { G.crashReason = 'Run complete'; endRun(true); return; }
  run.loopArmed = false;
  run.act++;
  setTheme(run.act);
  /* clear the marker before the board is drawn: districtCfg reads the
     current node while it is costing out the new act's quotas */
  run.row = -1; run.col = -1; run.node = null;
  run.route = makeRoute(run.act);
  toast(run.act > 3 ? 'THE LOOP — lap ' + (run.act - 3) : 'Act ' + run.act,
        run.act > 3 ? 'pink' : 'gold');
  showMap();
}

function showBrief(){
  const cfg = G.run.cfg;
  G.state = 'brief';
  UI.hud.classList.add('off');
  $('bkicker').textContent = cfg.boss ? 'Pursuit unit' : 'District ' + cfg.n;
  $('bname').textContent = cfg.name;
  /* The route is the strategic layer and the brief is the tactical one, so
     the brief has to state what the road is actually made of: three named
     stretches, what each is worth, and the rule each one plays by. A
     district that does not announce its own shape reads as the last one. */
  const legs = cfg.boss ? '' :
    '<div class="legs">' + cfg.stages.map((s, i) => {
      const z = zoneById(s.zone);
      return '<div class="leg"><b>' + (i + 1) + '</b>' +
             '<span class="lname">' + z.name + '</span>' +
             '<span class="lgate">bank ' + fmt(Math.round(G.run.quota * s.cut)) + '</span>' +
             (s.pay > 1 ? '<span class="lpay">&times;' + s.pay.toFixed(2) + '</span>' : '') +
             '</div>';
    }).join('') + '</div>';
  const rules = zoneRules(cfg);
  const ruleLine = rules.length
    ? '<div class="brules">' + rules.map(r =>
        '<span><b>' + r.name + '</b> ' + r.desc + '</span>').join('') + '</div>'
    : '';
  $('bobj').innerHTML = cfg.boss
    ? cfg.bossDef.blurb + '<br><b>Bank into it until its integrity breaks — ' +
      'no single cash-in takes more than a fifth of it.</b>' + ruleLine
    : 'Three stretches. Miss a checkpoint and the district ends there.' +
      legs + ruleLine;
  const k = NHChips.contractById(G.run.contract);
  $('bsub').textContent = (cfg.boss ? cfg.bossDef.sub : cfg.elite ? 'Elite run' : 'Standard run') +
    (k && k.id !== 'clear' ? '  ·  ' + k.name : '');
  /* gate ticks on the travel bar, placed where the gates actually are */
  UI.objDist.parentNode.style.backgroundImage = cfg.boss ? 'none' :
    cfg.stages.slice(0, -1).map(s =>
      'linear-gradient(90deg,transparent ' + (s.end / cfg.len * 100).toFixed(1) +
      '%,rgba(255,214,110,.75) ' + (s.end / cfg.len * 100).toFixed(1) +
      '%,rgba(255,214,110,.75) ' + (s.end / cfg.len * 100 + 0.7).toFixed(1) +
      '%,transparent ' + (s.end / cfg.len * 100 + 0.7).toFixed(1) + '%)').join(',');
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
  /* The hint used to be touch-only, on the assumption that a keyboard player
     would have read the menu. Landing straight in gameplay removes that menu,
     so desktop needs it too. */
  if (G.run.district === 1) showControlHint();
}

/* ---- a gate: the end of one stretch and the terms of the next ----
   Three of these per district. Each is a real fail state, so the district
   asks its question three times instead of once at the very end, and each
   one you clear turns the road up: hotter pursuit, thicker traffic, and a
   larger share of every bank. Depth has to pay, or the extra road is just
   more road. */
function passGate(){
  const run = G.run, cfg = run.cfg;
  if (cfg.boss) { failDistrict('The unit got away'); return; }

  const st = cfg.stages[G.stage];
  const last = G.stage >= cfg.stages.length - 1;
  const owed = Math.round(run.quota * st.cut);

  if (run.banked < owed) {
    failDistrict(last ? 'Quota missed' : 'Checkpoint missed — ' +
                 fmt(run.banked) + ' of ' + fmt(owed));
    return;
  }
  if (last) { clearDistrict(); return; }

  G.stage++;
  const next = cfg.stages[G.stage];
  const zone = zoneById(next.zone);
  /* the new stretch's rule takes over from the old one's */
  rebuildMods();
  /* clearing a gate welds a little hull back on — the reward for depth is
     the ability to survive more of it */
  G.hp = Math.min(G.hpMax, G.hp + Math.round(G.hpMax * 0.14));
  G.heat = Math.min(3.0, G.heat + 0.9);
  addXP(8);
  G.flash = Math.max(G.flash, 0.35);
  NHAudio.bank(2);
  toast('Checkpoint ' + G.stage + ' cleared — ' + zone.name, 'gold');
  /* the next stretch is already generated ahead of the car; what changes is
     the pressure inside it — the density target climbs with the stretch
     index, and the top-up in step() fills to it over the next few seconds */
  if (G.stage >= 2 && G.police.length < 4) addPolice(true);
}

function clearDistrict(){
  /* Beating a pursuit unit is the milestone of an act, so it is also the
     one guaranteed full rebuild — otherwise a run that limps through a boss
     fight arrives in the next act already dead. */
  G.hp = (G.run && G.run.M && G.run.M.clearHeal) || (G.run && G.run.cfg && G.run.cfg.boss)
    ? G.hpMax
    : Math.min(G.hpMax, G.hp + Math.round(G.hpMax * 0.70));
  /* Clearing used to open a second card screen. Chips and perks were the
     same object — run-long modifiers picked from three cards — delivered by
     two systems writing into one table, so seventeen of the twenty-two chips
     were literally a perk on the same axis. Clearing now pays a lump of XP
     into the one track that exists. */
  const run = G.run;
  run.cleared++;
  /* No separate depth bonus here. Overtime already pays for the extra road
     twice — surplus banking keeps scoring at half, and every point of XP
     earned in overtime runs at 1.5 — and a third payout stacked on the clear
     screen would be the same reward counted again. */
  G.coinsRun += 140 + run.district * 30;
  const wasLvl = run.level;
  const xpPaid = Math.round((20 + run.district * 4) * (run.L ? run.L.xpMul : 1));
  addXP(20 + run.district * 4);
  G.state = 'cleared';
  UI.hud.classList.add('off');
  NHAudio.bank(2);
  $('clDistrict').textContent = run.cfg.name;
  $('clBanked').textContent = fmt(run.banked);
  $('clCoins').textContent = fmt(140 + run.district * 30);
  $('clXp').textContent = '+' + fmt(xpPaid);
  $('clLevel').textContent = run.level;
  const atCap = run.level >= LEVEL_CAP;
  $('clNext').textContent = atCap ? 'MAX' : fmt(Math.floor(run.xp)) + ' / ' + fmt(xpFor(run.level));
  $('clXpFill').style.width = (atCap ? 1 : clamp(run.xp / xpFor(run.level), 0, 1)) * 100 + '%';
  $('clLvl').classList.toggle('off', G.pendingLevels <= 0);
  $('clLvl').textContent = run.level > wasLvl
    ? 'Level ' + run.level + ' \u2014 take a perk' : '';
  /* the act-3 boss (and every boss after it) offers the Loop: cash out a
     finished city, or keep driving a ladder that never ends */
  const finalBoss = run.cfg && run.cfg.boss && run.act >= 3;
  $('btnLoop').classList.toggle('hide', !finalBoss);
  $('btnCleared').firstChild.textContent = finalBoss ? 'Cash out' : 'Keep going';
  show(UI.cleared);
}

function leaveCleared(){
  hide(UI.cleared);
  G.state = 'play';
  UI.hud.classList.remove('off');
  /* The level owed for the clear is handed over before the map. Arming
     awaitingAdvance first matters: takePerk is what resumes the route, and
     without the flag the run would sit in 'play' on a finished district. */
  if (G.pendingLevels > 0) {
    G.awaitingAdvance = true;
    maybeLevelUp();
    if (G.state === 'levelup') return;
    G.awaitingAdvance = false;                 // nothing left to offer, at cap
  }
  advance();
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

function endRun(won){
  G.state = 'over';
  hide(UI.map); hide(UI.contract); hide(UI.depot); hide(UI.cleared); hide(UI.brief);
  hide(UI.levelup); hide(UI.cleared);
  const isBest = G.score > Save.data.best;
  if (isBest) { Save.data.best = G.score; Ads.celebrate(); }
  const reached = G.run ? G.run.district : 1;
  if (reached > (Save.data.deepest || 0)) Save.data.deepest = reached;
  /* Clearing districts is the achievement, so it pays on top of raw score —
     and the score term is capped. Uncapped, coins tracked the superlinear
     score curve: a god run paid 156k while a casual one paid 1.3k, so prices
     tuned for one starved the other. Wrecks and clears carry the floor. */
  const cleared = G.run ? G.run.cleared : 0;
  G.coinsRun = Math.floor((G.coinsRun + cleared * 350 + G.totalWreck * 2
             + Math.min(G.score / 80, 2500 + cleared * 900)) * G.spec.payout);
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
  $('btnDouble').disabled = false;
  refreshOverOffers();

  /* guarded so a deferred ad callback can never draw a stale over-panel
     across a run the player has already restarted */
  const showOver = () => { if (G.state === 'over') show(UI.over); };
  /* Every 3rd run end, never within 4 minutes of the last ad — three
     20-second learning deaths must not read as three ad breaks — and never on
     a transition that is also offering a rewarded continue. CrazyGames allows
     one or the other between levels, not both: "you can have either a midgame
     ad and restart, or a 'watch rewarded to keep playing', but not both". The
     revive is the continue, so it wins. */
  if (!offeringRevive() && Save.data.runs % 3 === 0 && G.playSinceAd > 240) {
    G.playSinceAd = 0;
    Ads.midroll(showOver);
  } else showOver();
}

/* one revive per run, and only when the run was worth saving */
function canRevive(){ return !G.revived && G.score >= 400; }
function offeringRevive(){ return canRevive() && Ads.rewardOffered(); }

/* Keeps the game-over offers honest. A rewarded button that does nothing is
   grounds for rejection, so an offer that cannot be served is withdrawn and
   explained rather than left sitting there disabled and unexplained. */
function refreshOverOffers(note){
  const live = Ads.rewardOffered();
  const rev  = canRevive();
  $('btnRevive').classList.toggle('hide', !(rev && live));
  $('btnDouble').classList.toggle('hide', !live);

  const coin = $('btnRevCoin');
  coin.classList.toggle('hide', !rev);
  coin.disabled = Save.data.coins < REVIVE_COST;
  coin.innerHTML = 'Revive for ' + fmt(REVIVE_COST) + ' coins';

  const el = $('ovAdNote');
  el.textContent = note || (live ? '' : 'Ad-funded bonuses are unavailable — an ad blocker, or ads are off for this build.');
  el.classList.toggle('hide', !el.textContent);
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
$('btnCleared').onclick = () => { NHAudio.ui(true); leaveCleared(); };
$('btnLoop').onclick = () => {
  NHAudio.ui(true);
  /* only a boss clear can arm the Loop — arming it from any other cleared
     screen would make a later CASH OUT loop anyway */
  if (G.run && G.run.cfg && G.run.cfg.boss && G.run.act >= 3) {
    G.run.loopArmed = true;
    toast('The Loop — no way back but through', 'pink');
  }
  leaveCleared();
};
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

/* The price of the non-ad revive. CrazyGames requires an alternative to
   watching a rewarded ad, and coins are the currency the game already pays
   out on every run, win or lose — so the alternative is one the player has
   been earning towards whether or not they ever watch an ad. It is also the
   only revive on offer when ads are unavailable. */
const REVIVE_COST = 250;

function doRevive(){
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
}

$('btnRevive').onclick = () => {
  Ads.rewarded('Reviving your run', ok => {
    /* No reward on adError — their rules are explicit about that. Say so and
       leave the coin option standing. */
    if (!ok) { refreshOverOffers('No ad available right now — try again later'); return; }
    doRevive();
  });
};

$('btnRevCoin').onclick = () => {
  if (Save.data.coins < REVIVE_COST) return;
  Save.data.coins -= REVIVE_COST;
  Save.flush();
  NHAudio.ui(true);
  doRevive();
};

$('btnDouble').onclick = () => {
  Ads.rewarded('Doubling your coins', ok => {
    if (!ok) { refreshOverOffers('No ad available right now — try again later'); return; }
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
  return Math.round(DAILY_BASE * Math.min(7, streak)
       * (Tree.has('t_int') ? 1.5 : 1));
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
  /* the pool the car actually sits in — hot enough that the subject pops
     off the deck instead of dissolving into it */
  const pool = g.createRadialGradient(cx, cy, 8, cx, cy, W * 0.46);
  pool.addColorStop(0, 'rgba(190,230,255,' + (0.27 * flick).toFixed(3) + ')');
  pool.addColorStop(0.55, 'rgba(120,190,255,0.07)');
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = pool;
  g.beginPath(); g.ellipse(cx, cy, W * 0.46, H * 0.30, 0, 0, TAU); g.fill();
  g.restore();

  /* --- turntable: a rotating hazard-dash ring under the car ---
     radii clamped against the bay height so the short, wide mobile bay
     does not push the ring off the deck */
  const trx = Math.min(W * 0.235, H * 0.42), try_ = Math.min(W * 0.155, H * 0.34);
  g.save();
  g.strokeStyle = 'rgba(150,175,215,0.16)';
  g.lineWidth = 2;
  g.beginPath(); g.ellipse(cx, cy, trx, try_, 0, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,177,61,0.30)';
  g.lineWidth = 5;
  g.setLineDash([18, 26]);
  g.lineDashOffset = -bayT * 30;
  g.beginPath(); g.ellipse(cx, cy, trx * 0.92, try_ * 0.9, 0, 0, TAU); g.stroke();
  g.setLineDash([]);
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
  /* nose up, with a slow turntable sway so the showroom reads as alive
     without ever fighting the top-down read */
  g.rotate(-Math.PI / 2 + Math.sin(bayT * 0.4) * 0.10);

  /* under-glow before the shadow, so the car sits in its own light */
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.5;
  const liv = spec.col || CL.cyan;
  const ug = g.createRadialGradient(0, 0, 4, 0, 0, spec.len * 0.9);
  ug.addColorStop(0, hexA(liv, 0.5));
  ug.addColorStop(1, hexA(liv, 0));
  g.fillStyle = ug;
  g.beginPath(); g.ellipse(0, 0, spec.len * 0.9, spec.wid * 1.6, 0, 0, TAU); g.fill();
  g.restore();

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

  /* a just-bought part flashes over the car for a beat: the purchase is a
     moment, not a re-rendered form */
  if (G.bayFlash && G.bayFlash.t > 0) {
    G.bayFlash.t -= 1 / 60;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.max(0, G.bayFlash.t) * 0.9;
    g.scale(1.06, 1.06);
    drawFitted(g, spec, sc);
    g.restore();
  }
  g.restore();

  /* --- showroom glint: a bright band sweeping the bay every few seconds --- */
  const sweep = (bayT % 6) / 6;
  if (sweep < 0.35) {
    const sx = (sweep / 0.35) * (W + H) - H * 0.5;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gl = g.createLinearGradient(sx - 70, 0, sx + 70, 0);
    gl.addColorStop(0, 'rgba(200,235,255,0)');
    gl.addColorStop(0.5, 'rgba(200,235,255,0.08)');
    gl.addColorStop(1, 'rgba(200,235,255,0)');
    g.fillStyle = gl;
    g.save();
    g.transform(1, 0, -0.35, 1, 0, 0);
    g.fillRect(sx - 80, 0, 160, H);
    g.restore();
    g.restore();
  }

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

/* ---------------- workshop icons ----------------
   Every purchasable thing in the garage is drawn as an object, because a
   card that is only name+description+price reads as a settings form no
   matter how it is skinned. All vector, all cached per id. */
const wsIconCache = new Map();
function wsIcon(kind, id, w, h){
  const key = kind + ':' + id;
  let c = wsIconCache.get(key);
  if (c) return c.cloneNode ? cloneIcon(c) : c;
  c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  c.style.width = '100%'; c.style.height = 'auto';
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.translate(w / 2, h / 2);
  g.lineJoin = 'round'; g.lineCap = 'round';
  (kind === 'gear' ? drawGearIcon : kind === 'up' ? drawUpIcon : drawBranchIcon)(g, id, w, h);
  wsIconCache.set(key, c);
  return cloneIcon(c);
}
function cloneIcon(src){
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.style.width = '100%'; c.style.height = 'auto';
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function drawGearIcon(g, id){
  g.lineWidth = 2.5;
  if (id === 'prow') {                      // the ram bar, face on
    g.strokeStyle = CL.amber; g.fillStyle = '#232C40';
    g.beginPath(); g.roundRect(-26, -6, 52, 12, 5); g.fill(); g.stroke();
    for (const x of [-16, 0, 16]) {
      g.beginPath(); g.roundRect(x - 3, 6, 6, 10, 2); g.fill(); g.stroke();
    }
    g.fillStyle = hexA(CL.amber, 0.85);
    for (const x of [-20, -7, 7, 20]) { g.beginPath(); g.arc(x, 0, 1.8, 0, TAU); g.fill(); }
  } else if (id === 'welder') {             // gas bottle + torch hose
    g.strokeStyle = '#2FE08A'; g.fillStyle = '#183226';
    g.beginPath(); g.roundRect(-22, -12, 18, 26, 6); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-13, -12); g.lineTo(-13, -17); g.stroke();
    g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(14, -14, 20, 2); g.stroke();
    g.fillStyle = '#2FE08A';
    g.beginPath(); g.moveTo(20, 2); g.lineTo(27, 6); g.lineTo(19, 9); g.closePath(); g.fill();
  } else if (id === 'turbine') {            // bonnet scoop with vanes
    g.strokeStyle = CL.cyan; g.fillStyle = '#0E1421';
    g.beginPath(); g.moveTo(-24, 10); g.lineTo(-14, -10); g.lineTo(24, -10);
    g.lineTo(24, 10); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = hexA(CL.cyan, 0.6);
    for (const x of [-6, 4, 14]) { g.beginPath(); g.moveTo(x, -7); g.lineTo(x - 4, 7); g.stroke(); }
  } else if (id === 'missile') {            // twin tubes, tips hot
    g.strokeStyle = CL.magenta; g.fillStyle = '#191F30';
    for (const y of [-9, 5]) {
      g.beginPath(); g.roundRect(-24, y, 40, 8, 4); g.fill(); g.stroke();
      g.fillStyle = hexA(CL.magenta, 0.9);
      g.beginPath(); g.arc(18, y + 4, 3.2, 0, TAU); g.fill();
      g.fillStyle = '#191F30';
    }
  } else if (id === 'shockplate') {         // riveted flank plate, arcing
    g.strokeStyle = CL.cyan; g.fillStyle = '#1B2334';
    g.beginPath(); g.roundRect(-26, -8, 40, 16, 4); g.fill(); g.stroke();
    g.fillStyle = hexA(CL.cyan, 0.8);
    for (const x of [-19, -8, 3]) { g.beginPath(); g.arc(x, 0, 1.8, 0, TAU); g.fill(); }
    g.strokeStyle = '#EAFBFF';
    g.beginPath(); g.moveTo(17, -10); g.lineTo(22, -2); g.lineTo(18, -2); g.lineTo(24, 8); g.stroke();
  } else if (id === 'blackbox') {           // box + whip aerial
    g.strokeStyle = CL.ice; g.fillStyle = '#0E1420';
    g.beginPath(); g.roundRect(-18, -4, 24, 16, 3); g.fill(); g.stroke();
    g.strokeStyle = CL.cyan;
    g.beginPath(); g.moveTo(12, -2); g.quadraticCurveTo(14, -14, 22, -16); g.stroke();
    g.fillStyle = CL.cyan;
    g.beginPath(); g.arc(22, -16, 2.2, 0, TAU); g.fill();
  }
}

function drawUpIcon(g, id){
  g.lineWidth = 2.4;
  if (id === 'engine') {                    // speedo arc, needle pinned
    g.strokeStyle = CL.cyan;
    g.beginPath(); g.arc(0, 4, 14, Math.PI, TAU); g.stroke();
    g.strokeStyle = hexA(CL.cyan, 0.5);
    for (let i = 0; i <= 4; i++) {
      const a = Math.PI + i / 4 * Math.PI;
      g.beginPath(); g.moveTo(Math.cos(a) * 11, 4 + Math.sin(a) * 11);
      g.lineTo(Math.cos(a) * 14, 4 + Math.sin(a) * 14); g.stroke();
    }
    g.strokeStyle = CL.amber;
    g.beginPath(); g.moveTo(0, 4); g.lineTo(9, -6); g.stroke();
  } else if (id === 'grip') {               // tyre, tread showing
    g.strokeStyle = CL.cyan; g.fillStyle = '#12161F';
    g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = hexA(CL.cyan, 0.55);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      g.beginPath(); g.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
      g.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); g.stroke();
    }
  } else if (id === 'armor') {              // hull plate chevron
    g.strokeStyle = CL.cyan; g.fillStyle = '#101827';
    g.beginPath(); g.moveTo(0, -13); g.lineTo(12, -7); g.lineTo(12, 5);
    g.lineTo(0, 13); g.lineTo(-12, 5); g.lineTo(-12, -7); g.closePath();
    g.fill(); g.stroke();
    g.strokeStyle = hexA(CL.cyan, 0.55);
    g.beginPath(); g.moveTo(-6, -2); g.lineTo(0, 2); g.lineTo(6, -2); g.stroke();
  } else if (id === 'impact') {             // burst
    g.strokeStyle = CL.amber;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, r1 = i % 2 ? 6 : 9;
      g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.lineTo(Math.cos(a) * (r1 + 6), Math.sin(a) * (r1 + 6)); g.stroke();
    }
    g.fillStyle = hexA(CL.amber, 0.9);
    g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill();
  } else if (id === 'nitro') {              // flame
    g.fillStyle = hexA(CL.amber, 0.9); g.strokeStyle = CL.amber;
    g.beginPath();
    g.moveTo(0, -13);
    g.quadraticCurveTo(10, -2, 6, 6);
    g.quadraticCurveTo(4, 11, 0, 13);
    g.quadraticCurveTo(-4, 11, -6, 6);
    g.quadraticCurveTo(-10, -2, 0, -13);
    g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(4, 3, 0, 8);
    g.quadraticCurveTo(-4, 3, 0, -4); g.fill();
  } else if (id === 'payout') {             // coin
    g.strokeStyle = CL.amber; g.fillStyle = '#241B08';
    g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = hexA(CL.amber, 0.9); g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(-3, -7); g.lineTo(-3, 7); g.moveTo(3, -7); g.lineTo(3, 7); g.stroke();
  }
}

function drawBranchIcon(g, id){
  g.lineWidth = 2.2;
  if (id === 'offense') {                   // crosshair
    g.strokeStyle = CL.magenta;
    g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.stroke();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      g.beginPath(); g.moveTo(dx * 5, dy * 5); g.lineTo(dx * 13, dy * 13); g.stroke();
    }
  } else if (id === 'defense') {            // shield
    g.strokeStyle = CL.cyan; g.fillStyle = '#101827';
    g.beginPath(); g.moveTo(0, -11); g.lineTo(10, -7); g.lineTo(10, 2);
    g.quadraticCurveTo(10, 9, 0, 12); g.quadraticCurveTo(-10, 9, -10, 2);
    g.lineTo(-10, -7); g.closePath(); g.fill(); g.stroke();
  } else {                                  // greed: coin stack
    g.strokeStyle = CL.amber; g.fillStyle = '#241B08';
    for (const y of [5, 0, -5]) {
      g.beginPath(); g.ellipse(0, y, 10, 4.5, 0, 0, TAU); g.fill(); g.stroke();
    }
  }
}

/* one station on screen at a time — the tab rail kills the settings scroll */
let gTab = 'tune';
function syncGTabs(){
  document.querySelectorAll('#gTabs .gTab').forEach(b =>
    b.classList.toggle('on', b.dataset.sec === gTab));
  document.querySelectorAll('#garage .gSec').forEach(s =>
    s.classList.toggle('on', s.dataset.sec === gTab));
}
$('gTabs').addEventListener('click', e => {
  const b = e.target.closest('.gTab');
  if (!b) return;
  gTab = b.dataset.sec;
  NHAudio.ui(true);
  syncGTabs();
  $('gWork').scrollTop = 0;      // each station starts at its own top
});

function renderGarage(){
  const bal = Save.data.coins;
  const spec = G.spec = activeSpec();
  $('gCoins').textContent = fmt(bal);
  syncGTabs();

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
      '<span class="ico"></span>' +
      '<div class="info">' +
        '<div class="nm">' + u.name + '<em>' + u.read(lvl) + '</em></div>' +
        '<div class="pips">' + Array.from({ length:UP_MAX }, (_, i) =>
          '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join('') + '</div>' +
      '</div>' +
      '<button ' + (maxed || !afford ? 'disabled' : '') + '>' +
        (maxed ? 'Max' : fmt(cost)) + '</button>';
    el.querySelector('.ico').appendChild(wsIcon('up', u.id, 40, 34));
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
      '<span class="ico"></span>' +
      '<div class="nm">' + g.name + '</div>' +
      '<div class="ds">' + g.desc + '</div>' +
      (owned
        ? '<span class="stamp">Fitted</span>'
        : '<span class="tag">' + fmt(g.price) +
          (broke ? '<em>short ' + fmt(g.price - bal) + '</em>' : '') + '</span>');
    el.querySelector('.ico').appendChild(wsIcon('gear', g.id, 76, 44));
    const buy = () => {
      if (owned) return;
      if (!Hangar.buy(g.id)) {
        toast('Short ' + fmt(g.price - Save.data.coins) + ' coins', 'red');
        NHAudio.ui(false);
        return;
      }
      toast(g.name + ' fitted', 'gold');
      NHAudio.ui(true);
      G.bayFlash = { t: 1 };
      renderGarage();
    };
    el.onclick = buy;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buy(); } };
    gear.appendChild(el);
  }
  $('gwGear').textContent = Save.data.gear.length + ' / ' + GEAR.length;

  /* --- the crew: three doctrines, permanent, the long sink --- */
  const treeEl = $('gTree');
  treeEl.innerHTML = '';
  let ranksOwned = 0, ranksTotal = 0;
  const BR = { offense:'Offense', defense:'Defense', greed:'Greed' };
  for (const br of ['offense', 'defense', 'greed']) {
    const col = document.createElement('div');
    col.className = 'tBranch ' + br;
    col.innerHTML = '<div class="tHead"><span class="ico"></span>' + BR[br] + '</div>';
    col.querySelector('.ico').appendChild(wsIcon('branch', br, 28, 26));
    for (const t of TREE.filter(x => x.br === br)) {
      const r = Tree.rank(t.id);
      ranksOwned += r; ranksTotal += t.ranks;
      const maxed = r >= t.ranks;
      const cost = maxed ? 0 : t.cost[r];
      const broke = !maxed && bal < cost;
      const el = document.createElement('div');
      el.className = 'tNode' + (maxed ? ' owned' : '') + (broke ? ' broke' : '');
      el.setAttribute('role', 'button');
      el.tabIndex = maxed ? -1 : 0;
      el.innerHTML =
        '<div class="nm">' + t.name +
          (t.ranks > 1 ? '<i class="tPips">' + Array.from({ length:t.ranks }, (_, k) =>
            '<b class="' + (k < r ? 'on' : '') + '"></b>').join('') + '</i>' : '') +
        '</div>' +
        '<div class="ds">' + t.desc + '</div>' +
        (maxed
          ? '<span class="stamp">Trained</span>'
          : '<span class="tag">' + fmt(cost) +
            (broke ? '<em>short ' + fmt(cost - bal) + '</em>' : '') + '</span>');
      const buyNode = () => {
        if (maxed) return;
        if (!Tree.buy(t.id)) {
          toast('Short ' + fmt(cost - Save.data.coins) + ' coins', 'red');
          NHAudio.ui(false);
          return;
        }
        toast(t.name + (t.ranks > 1 ? ' ' + (Tree.rank(t.id)) : '') + ' — trained', 'gold');
        NHAudio.chip();
        G.spec = activeSpec();
        renderGarage();
      };
      el.onclick = buyNode;
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buyNode(); } };
      col.appendChild(el);
    }
    treeEl.appendChild(col);
  }
  $('gwTree').textContent = ranksOwned + ' / ' + ranksTotal;

  /* --- paint shop: the cheapest reason to open the tab tomorrow --- */
  const livEl = $('gLiv');
  livEl.innerHTML = '';
  for (const l of LIVERIES) {
    const owned = Livery.owned(l.id);
    const worn = (Save.data.livery || 'stock') === l.id;
    const broke = !owned && bal < l.price;
    const el = document.createElement('div');
    el.className = 'liv' + (worn ? ' worn' : '') + (broke ? ' broke' : '');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.innerHTML =
      '<i class="sw" style="background:radial-gradient(circle at 34% 30%,' +
        hexA('#FFFFFF', 0.75) + ' 0%,' + l.col + ' 38%,' + l.col2 + ' 100%)"></i>' +
      '<div class="nm">' + l.name + '</div>' +
      (worn ? '<span class="stamp">On car</span>'
            : '<span class="tag' + (owned ? ' own' : '') + '">' +
              (owned ? 'Owned' : fmt(l.price)) + '</span>');
    const wear = () => {
      if (worn) return;
      if (!Livery.buyOrWear(l.id)) {
        toast('Short ' + fmt(l.price - Save.data.coins) + ' coins', 'red');
        NHAudio.ui(false);
        return;
      }
      toast(l.name + ' — sprayed', 'gold');
      NHAudio.ui(true);
      G.spec = activeSpec();
      G.bayFlash = { t: 1 };
      renderGarage();
    };
    el.onclick = wear;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wear(); } };
    livEl.appendChild(el);
  }
  $('gwLiv').textContent = (1 + (Save.data.liveries || []).length) + ' / ' + LIVERIES.length;

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
  hide(UI.menu); hide(UI.over); hide(UI.map); hide(UI.cleared); hide(UI.brief);
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
hide(UI.brief); hide(UI.cleared); hide(UI.map); hide(UI.contract); hide(UI.depot);
hide(UI.daily); hide(UI.board); hide(UI.levelup);
setCtrlLabel();
setEngineLabel();
setMute();
if (hasTouch) $('btnCtrl').classList.add('show');
bootIntoPlay();
requestAnimationFrame(frame);

/* debug handle for tuning passes and automated playtests */
window.__NH = {
  G, cam, CARS, Save, QF, setQuality, startRun, toMenu, GS, IN, Ads, setPause,
  MS, get adMuted(){ return adMuted; },   // ad audio must not dip before adStarted
  get renderScale(){ return renderScale; }, get ftAvg(){ return ftAvg; },
  get workAvg(){ return workAvg; },
  beginDistrict, takePerk, districtCfg, bank, showMap, enterNode,
  takeContract, openNodes, advance, addXP, leaveCleared, xpFor,
  get offers(){ return G.offers; },
  setTheme, theme: () => ({ id:TH.id, name:TH.name, asphalt:TH.asphalt, left:TH.left }),
  ZONES, zoneById, zoneEnv, pickZones, zoneRules, passGate,
  env: () => ({ id:envNow().id, floor:envNow().floor, rail:envNow().rail }),
  get stage(){ return G.stage; },
  addBoss, bossDamage, BOSS_BITE,
  endRun, showBoard, recordRun, failDistrict, damage,
  POWERS, takePickup, chainTimeProbe: () => chainTime(), smash,
  GSdebug: () => ({ raw:+GS.raw.toFixed(3), steer:+GS.steer.toFixed(3) })
};
})();
