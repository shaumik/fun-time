/* ============================================================
   NEON HEAT — audio
   Fully synthesised. Same principle as the renderer: no asset files,
   so nothing to license, nothing to download, nothing to sound cheap.
   A four-layer synthwave bed whose arrangement tracks run intensity,
   plus a small SFX set driven off gameplay state.
   ============================================================ */
window.NHAudio = (() => {
'use strict';

let ac = null, master = null, musicBus = null, sfxBus = null;
let ready = false, muted = false, engineOff = false;
/* Ducking is separate from the user's mute so an ad can silence the game
   without destroying the setting they chose. */
let ducked = false;
/* The portal can mute us, and its setting outranks the in-game toggle —
   a player who muted on the CrazyGames page must stay muted even if they
   then hit the sound button in here. */
let siteMuted = false;
const MASTER = 0.9;
function applyMaster(){
  if (!master) return;
  const silent = muted || ducked || siteMuted;
  master.gain.setTargetAtTime(silent ? 0 : MASTER, ac.currentTime, 0.04);
}

/* ---- musical material ---------------------------------------------------
   A natural-minor vamp: i - VI - III - VII. Bright enough to drive to,
   dark enough to read as a police chase.                                   */
const PROG = [
  { root: 55.00, chord: [55.00, 65.41, 82.41] },   // Am
  { root: 43.65, chord: [43.65, 65.41, 87.31] },   // F
  { root: 65.41, chord: [65.41, 82.41, 98.00] },   // C
  { root: 49.00, chord: [49.00, 61.74, 73.42] }    // G
];
const BASS_STEPS = [0, 0, 7, 0, 0, 12, 0, 7, 0, 0, 7, 0, 12, 0, 7, 3];
const ARP_STEPS  = [0, 4, 7, 12, 7, 4, 7, 12, 0, 4, 7, 12, 14, 12, 7, 4];
const semi = (f, n) => f * Math.pow(2, n / 12);

const BPM = 126;
const STEP = 60 / BPM / 4;          // sixteenth notes
let step = 0, nextTime = 0, timer = null;
let intensity = 0, targetInt = 0;

/* persistent voices */
let engOsc1, engOsc2, engFilt, engGain, engSub, engHi, engHiGain, engVib;
let sqNoise, sqFilt, sqGain;
let sirOsc, sirGain, sirLfo;

/* ---------------------------------------------------------------- helpers */
function noiseBuffer(secs){
  const n = Math.floor(ac.sampleRate * secs);
  const b = ac.createBuffer(1, n, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let NOISE = null;
function noiseSource(loop){
  const s = ac.createBufferSource();
  s.buffer = NOISE;
  s.loop = !!loop;
  return s;
}
/* one-shot envelope helper: returns the gain node to route through */
function env(dest, peak, attack, decay, at){
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(dest);
  return g;
}

/* ------------------------------------------------------------------- init */
function init(){
  if (ready) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  NOISE = noiseBuffer(2);

  master = ac.createGain();
  master.gain.value = (muted || ducked || siteMuted) ? 0 : MASTER;
  master.connect(ac.destination);

  /* a touch of compression keeps the bed from fighting the SFX */
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3.2; comp.attack.value = 0.004;
  comp.connect(master);

  /* Take the glare off the whole mix in one place. Synthesised material has
     no tape, no room and no mic to round it off, so every edge that would
     normally be softened by the recording chain arrives intact — which is
     what makes it tiring long before it makes it loud. */
  const air = ac.createBiquadFilter();
  air.type = 'lowpass'; air.frequency.value = 8200; air.Q.value = 0.6;
  const shelf = ac.createBiquadFilter();
  shelf.type = 'highshelf'; shelf.frequency.value = 3400; shelf.gain.value = -7;
  air.connect(shelf); shelf.connect(comp);

  musicBus = ac.createGain(); musicBus.gain.value = 0.50; musicBus.connect(air);
  sfxBus   = ac.createGain(); sfxBus.gain.value   = 0.80; sfxBus.connect(air);

  buildEngine();
  buildSqueal();
  buildSiren();

  ready = true;
  nextTime = ac.currentTime + 0.08;
  tick();
}

function resume(){
  if (!ready) { init(); return; }
  if (ac.state === 'suspended') ac.resume();
}

/* ---------------------------------------------------------- engine voice
   An electric drivetrain, not a combustion one. The first version was two
   detuned sawtooths through a Q=6 resonant lowpass, which is a growl with a
   honk sitting in it — fine for one lap and grating for twenty. This is a
   motor whine instead: smooth triangles rising with speed, a quiet inverter
   overtone above them, a sine hum underneath, and no resonance anywhere.
   It is also mixed far lower, so the music carries the scene and the car
   sits under it rather than in front of it. */
function buildEngine(){
  engFilt = ac.createBiquadFilter();
  engFilt.type = 'lowpass';
  engFilt.frequency.value = 260;
  engFilt.Q.value = 0.7;                       // no resonant peak to honk

  engGain = ac.createGain();
  engGain.gain.value = 0;

  engOsc1 = ac.createOscillator(); engOsc1.type = 'triangle'; engOsc1.frequency.value = 50;
  engOsc2 = ac.createOscillator(); engOsc2.type = 'triangle'; engOsc2.frequency.value = 50;
  engOsc2.detune.value = 8;                    // slow beating, so it breathes
  engSub  = ac.createOscillator(); engSub.type  = 'sine';     engSub.frequency.value  = 25;

  /* the inverter: a quiet octave-and-a-bit above, which is what makes an EV
     read as electric rather than as a flute */
  engHi = ac.createOscillator(); engHi.type = 'sine'; engHi.frequency.value = 100;
  engHiGain = ac.createGain(); engHiGain.gain.value = 0.08;
  engHi.connect(engHiGain); engHiGain.connect(engFilt);

  /* a touch of vibrato keeps it from reading as a test tone */
  engVib = ac.createOscillator(); engVib.type = 'sine'; engVib.frequency.value = 0.32;
  const vibAmt = ac.createGain(); vibAmt.gain.value = 4;      // cents
  engVib.connect(vibAmt); vibAmt.connect(engOsc1.detune); vibAmt.connect(engOsc2.detune);

  engOsc1.connect(engFilt); engOsc2.connect(engFilt); engSub.connect(engFilt);
  engFilt.connect(engGain); engGain.connect(sfxBus);
  engOsc1.start(); engOsc2.start(); engSub.start(); engHi.start(); engVib.start();
}

function buildSqueal(){
  sqFilt = ac.createBiquadFilter();
  sqFilt.type = 'bandpass';
  sqFilt.frequency.value = 2300;
  sqFilt.Q.value = 7;
  sqGain = ac.createGain();
  sqGain.gain.value = 0;
  sqNoise = noiseSource(true);
  sqNoise.connect(sqFilt); sqFilt.connect(sqGain); sqGain.connect(sfxBus);
  sqNoise.start();
}

function buildSiren(){
  sirGain = ac.createGain(); sirGain.gain.value = 0;
  sirOsc = ac.createOscillator(); sirOsc.type = 'square'; sirOsc.frequency.value = 620;
  const sirFilt = ac.createBiquadFilter();
  sirFilt.type = 'lowpass'; sirFilt.frequency.value = 1400;
  /* the classic two-tone wail is just a slow LFO on pitch */
  sirLfo = ac.createOscillator(); sirLfo.type = 'sine'; sirLfo.frequency.value = 1.1;
  const lfoAmt = ac.createGain(); lfoAmt.gain.value = 150;
  sirLfo.connect(lfoAmt); lfoAmt.connect(sirOsc.frequency);
  sirOsc.connect(sirFilt); sirFilt.connect(sirGain); sirGain.connect(sfxBus);
  sirOsc.start(); sirLfo.start();
}

/* --------------------------------------------------------------- drum kit */
function kick(at, vel){
  const o = ac.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(150, at);
  o.frequency.exponentialRampToValueAtTime(44, at + 0.11);
  const g = env(musicBus, 0.72 * vel, 0.006, 0.22, at);
  o.connect(g); o.start(at); o.stop(at + 0.3);
}
function snare(at, vel){
  /* Band-passed, not high-passed. A highpass at 1.6k lets everything above it
     through, so the crack carried the full top octave on every backbeat. */
  const n = noiseSource(false);
  const f = ac.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.value = 1500; f.Q.value = 0.8;
  const g = env(musicBus, 0.22 * vel, 0.004, 0.17, at);
  n.connect(f); f.connect(g); n.start(at); n.stop(at + 0.28);

  /* more body under it, so it reads as a drum rather than as a hiss */
  const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = 185;
  const g2 = env(musicBus, 0.20 * vel, 0.004, 0.11, at);
  o.connect(g2); o.start(at); o.stop(at + 0.18);
}
function hat(at, vel){
  /* This was noise high-passed at 7.2 kHz on sixteenths — the most fatiguing
     band there is, ticking away non-stop. Now a narrow band well below it. */
  const n = noiseSource(false);
  const f = ac.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.value = 5200; f.Q.value = 1.4;
  const g = env(musicBus, 0.040 * vel, 0.002, 0.028, at);
  n.connect(f); f.connect(g); n.start(at); n.stop(at + 0.06);
}
function bassNote(at, freq){
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(220 + intensity * 260, at);
  f.frequency.exponentialRampToValueAtTime(120, at + 0.16);
  f.Q.value = 2.4;              // was 9 — a resonant squelch on every note
  const g = env(musicBus, 0.28, 0.008, 0.16, at);
  o.connect(f); f.connect(g); o.start(at); o.stop(at + 0.24);
}
function arpNote(at, freq, vel){
  /* triangle rather than square: the odd harmonics of a square are what made
     the arpeggio glassy once the filter opened up */
  const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1900; f.Q.value = 0.9;
  const g = env(musicBus, 0.075 * vel, 0.006, 0.15, at);
  o.connect(f); f.connect(g); o.start(at); o.stop(at + 0.2);
}
let padVoices = [];
function setPad(chord, at){
  padVoices.forEach(v => { try { v.g.gain.cancelScheduledValues(at); v.g.gain.setTargetAtTime(0.0001, at, 0.25); v.o.stop(at + 1.6); } catch (e) {} });
  padVoices = [];
  if (intensity < 1) return;
  for (const f0 of chord) {
    for (const det of [-6, 6]) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f0 * 4; o.detune.value = det;
      const flt = ac.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = 500 + intensity * 700; flt.Q.value = 1;
      const g = ac.createGain(); g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.020 + intensity * 0.010, at, 0.35);
      o.connect(flt); flt.connect(g); g.connect(musicBus);
      o.start(at);
      padVoices.push({ o, g });
    }
  }
}

/* ------------------------------------------------------------- sequencer */
function playStep(s, at){
  const bar = Math.floor(s / 16) % 4;
  const ch = PROG[bar];
  const i = s % 16;

  if (i === 0) setPad(ch.chord, at);

  /* layer in as the run escalates — arrangement is the intensity dial */
  if (intensity >= 0) {
    if (i % 4 === 0) kick(at, 1);
    if (intensity >= 2 && i === 14) kick(at, 0.6);
  }
  if (intensity >= 1 && (i === 4 || i === 12)) snare(at, 1);
  if (intensity >= 1 && i % 2 === 0) hat(at, i % 4 === 2 ? 1 : 0.55);
  if (intensity >= 3 && i % 2 === 1) hat(at, 0.32);

  if (BASS_STEPS[i] !== undefined && i % 2 === 0) bassNote(at, semi(ch.root, BASS_STEPS[i]));
  if (intensity >= 2) arpNote(at, semi(ch.chord[0] * 4, ARP_STEPS[i]), intensity >= 3 ? 1 : 0.6);
}

function tick(){
  if (!ready) return;
  intensity += (targetInt - intensity) * 0.08;
  while (nextTime < ac.currentTime + 0.14) {
    playStep(step, nextTime);
    step = (step + 1) % 64;
    nextTime += STEP;
  }
  timer = setTimeout(tick, 25);
}

/* ------------------------------------------------------------------- API */
const A = {
  init, resume,
  get on(){ return ready && !muted; },

  toggleMute(){
    muted = !muted;
    applyMaster();
    return muted;
  },
  isMuted(){ return muted; },

  /* portal-driven mute (CrazyGames SDK settings.muteAudio) */
  setSiteMute(on){
    if (siteMuted === !!on) return;
    siteMuted = !!on;
    applyMaster();
  },
  /* what the sound button should actually read */
  isSilenced(){ return muted || siteMuted; },
  /* The engine is the one voice you hear without pause for a whole run, so
     it gets its own switch. Killing it must not cost you the music. */
  setEngine(on){ engineOff = !on; },
  engineOn(){ return !engineOff; },
  /* the graph, for automated mix checks — see the engine-voice notes */
  _probe(){ return ready ? { ac, sfxBus, musicBus, engGain } : null; },
  isForced(){ return siteMuted; },

  /* silence for an ad or a backgrounded tab, then restore the user's setting */
  duck(on){
    if (ducked === !!on) return;
    ducked = !!on;
    applyMaster();
  },

  /* browsers throttle a hidden tab's timers; stop the sequencer outright */
  setActive(on){
    if (!ready) return;
    if (on) { if (ac.state === 'suspended') ac.resume(); }
    else if (ac.state === 'running') ac.suspend();
  },

  /* continuous state, called every frame */
  frame(st){
    if (!ready) return;
    const t = ac.currentTime;
    const spd = st.speed || 0;

    /* Faint at a crawl, present at speed, never loud. The old voice sat at a
       flat 0.055 whatever you were doing, which is why it nagged. */
    const drive = st.playing ? 1 : 0.22;
    const load = Math.min(1, spd / 620);
    engGain.gain.setTargetAtTime(engineOff ? 0 : (0.005 + load * 0.009) * drive, t, 0.10);

    /* Heard from across the street, not from inside the car. The previous
       pass put the fundamental at 258-958Hz, which is a sustained tone right
       in the band the ear is most sensitive to — quieter than the growl it
       replaced and far more tiring. Down an octave and a half, and buried
       under a low filter, it reads as a drivetrain you are near rather than
       a note being played at you. */
    const f = 46 + spd * 0.135 + (st.boost ? 22 : 0);
    engOsc1.frequency.setTargetAtTime(f, t, 0.07);
    engOsc2.frequency.setTargetAtTime(f, t, 0.07);
    engSub.frequency.setTargetAtTime(f * 0.25, t, 0.07);
    engHi.frequency.setTargetAtTime(f * 2.01, t, 0.07);
    /* the inverter shimmer only shows up once there is load on the motor */
    engHiGain.gain.setTargetAtTime(0.05 + load * 0.10, t, 0.12);
    engFilt.frequency.setTargetAtTime(210 + spd * 0.42 + (st.boost ? 260 : 0), t, 0.08);

    const sq = st.playing ? Math.min(1, (st.drift || 0) * (spd > 240 ? 1 : 0)) : 0;
    sqGain.gain.setTargetAtTime(0.055 * sq, t, 0.05);
    sqFilt.frequency.setTargetAtTime(1900 + sq * 1300, t, 0.06);

    const si = st.playing ? Math.min(1, (st.cops || 0) / 2) : 0;
    sirGain.gain.setTargetAtTime(0.020 * si, t, 0.25);

    targetInt = st.intensity || 0;
  },

  /* one-shots */
  bank(mult){
    if (!ready) return;
    const t = ac.currentTime;
    const base = 330 * Math.pow(2, Math.min(2.2, mult * 0.16) / 12 * 6);
    [0, 4, 7, 12].forEach((n, k) => {
      const o = ac.createOscillator(); o.type = 'triangle';
      o.frequency.value = semi(base, n);
      const g = env(sfxBus, 0.15, 0.005, 0.16, t + k * 0.045);
      o.connect(g); o.start(t + k * 0.045); o.stop(t + k * 0.045 + 0.24);
    });
  },
  /* Picking something up should read as a reward before you have parsed
     which one it was: a rising arpeggio, brighter and faster for a Boost. */
  pickup(hot){
    if (!ready) return;
    const t = ac.currentTime;
    const steps = hot ? [660, 880, 1320] : [523, 784, 1046];
    steps.forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t + i * 0.045);
      const g = env(sfxBus, 0.20, 0.004, 0.13, t + i * 0.045);
      o.connect(g); o.start(t + i * 0.045); o.stop(t + i * 0.045 + 0.2);
    });
  },
  nearMiss(){
    if (!ready) return;
    const t = ac.currentTime;
    const n = noiseSource(false);
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.24);
    const g = env(sfxBus, 0.24, 0.01, 0.22, t);
    n.connect(f); f.connect(g); n.start(t); n.stop(t + 0.32);
  },
  hit(power){
    if (!ready) return;
    const t = ac.currentTime, p = power || 1;
    const n = noiseSource(false);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
    const g = env(sfxBus, 0.42 * p, 0.003, 0.20, t);
    n.connect(f); f.connect(g); n.start(t); n.stop(t + 0.3);

    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g2 = env(sfxBus, 0.55 * p, 0.004, 0.26, t);
    o.connect(g2); o.start(t); o.stop(t + 0.36);
  },
  /* the crunch: a body-panel transient over a low thump, pitched by force */
  smash(power){
    if (!ready) return;
    const t = ac.currentTime, p = Math.min(1.7, power || 1);

    const n = noiseSource(false);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(1800 * p, t);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.18);
    const g = env(sfxBus, 0.5 * p, 0.002, 0.22, t);
    n.connect(f); f.connect(g); n.start(t); n.stop(t + 0.32);

    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180 * p, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.26);
    const g2 = env(sfxBus, 0.62 * p, 0.003, 0.3, t);
    o.connect(g2); o.start(t); o.stop(t + 0.4);

    /* a bright metallic ring on top so it reads as sheet metal, not a thud */
    const m = ac.createOscillator(); m.type = 'square';
    m.frequency.value = 620 + Math.random() * 340;
    const mf = ac.createBiquadFilter(); mf.type = 'highpass'; mf.frequency.value = 900;
    const g3 = env(sfxBus, 0.14 * p, 0.002, 0.1, t);
    m.connect(mf); mf.connect(g3); m.start(t); m.stop(t + 0.16);
  },

  spark(){
    if (!ready) return;
    const t = ac.currentTime;
    const n = noiseSource(false);
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3800;
    const g = env(sfxBus, 0.10, 0.002, 0.05, t);
    n.connect(f); f.connect(g); n.start(t); n.stop(t + 0.09);
  },
  ui(up){
    if (!ready) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(up ? 520 : 400, t);
    o.frequency.exponentialRampToValueAtTime(up ? 780 : 260, t + 0.08);
    const g = env(sfxBus, 0.08, 0.004, 0.09, t);
    o.connect(g); o.start(t); o.stop(t + 0.16);
  },
  chip(){
    if (!ready) return;
    const t = ac.currentTime;
    [0, 7, 12, 19].forEach((n, k) => {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.value = semi(523.25, n);
      const g = env(sfxBus, 0.16, 0.004, 0.42, t + k * 0.06);
      o.connect(g); o.start(t + k * 0.06); o.stop(t + k * 0.06 + 0.55);
    });
  },
  curse(){
    if (!ready) return;
    const t = ac.currentTime;
    [0, -1, -5].forEach((n, k) => {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = semi(146.83, n);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = env(sfxBus, 0.15, 0.02, 0.5, t + k * 0.05);
      o.connect(f); f.connect(g); o.start(t + k * 0.05); o.stop(t + k * 0.05 + 0.7);
    });
  },
  clear(){
    if (!ready) return;
    const t = ac.currentTime;
    [0, 4, 7, 12, 16, 19].forEach((n, k) => {
      const o = ac.createOscillator(); o.type = 'triangle';
      o.frequency.value = semi(261.63, n);
      const g = env(sfxBus, 0.17, 0.005, 0.3, t + k * 0.07);
      o.connect(g); o.start(t + k * 0.07); o.stop(t + k * 0.07 + 0.42);
    });
  },
  boss(){
    if (!ready) return;
    const t = ac.currentTime;
    for (const d of [0, 0.16]) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(82, t + d);
      o.frequency.exponentialRampToValueAtTime(55, t + d + 0.5);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 4;
      const g = env(sfxBus, 0.5, 0.01, 0.55, t + d);
      o.connect(f); f.connect(g); o.start(t + d); o.stop(t + d + 0.7);
    }
  },
  bossHit(){
    if (!ready) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.16);
    const g = env(sfxBus, 0.22, 0.003, 0.18, t);
    o.connect(g); o.start(t); o.stop(t + 0.24);
  },
  crash(){
    if (!ready) return;
    A.hit(1.5);
    const t = ac.currentTime;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.9);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    const g = env(sfxBus, 0.3, 0.01, 1.0, t);
    o.connect(f); f.connect(g); o.start(t); o.stop(t + 1.2);
  }
};
return A;
})();
