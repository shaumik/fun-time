/* ============================================================
   NEON HEAT — perks, curses and events
   Every perk writes into a flat modifier table the physics and
   scoring read each frame. Keeping effects declarative means builds
   stack and interact without special-casing anywhere in the engine.

   Perks and chips used to be two pools delivered by two card screens,
   writing into this same table. They are one pool now — 49 perks, three
   offered per level, fifteen levels deep.
   ============================================================ */
window.NHChips = (() => {
'use strict';

/* the full modifier surface — anything a perk can touch lives here */
function defaults(){
  return {
    bankMul: 1,        // legacy scale, still read by a few cards
    wreckMul: 1,       // payout multiplier on a wreck specifically
    /* ---- the three that matter now ----
       The wall is the run's only clock, so everything a perk can do to help
       is one of: slow it down, shove it further per car, or hold the pass
       open long enough to join two formations into one line. */
    wallSpeed: 1,      // multiplier on how fast the wall closes. Lower is better.
    pushBonus: 0,      // extra world units of pushback per car taken
    passWindow: 0,     // extra seconds a pass stays open
    mistakes: 0,       // extra errors the run can absorb
    multRate: 0.40,    // legacy: chain links -> multiplier slope
    multCap: 12,
    topMul: 1,
    gripMul: 1,
    chainTime: 3.2,    // seconds on the chain clock, reset by every wreck
    boostTime: 1,      // scales how long a Boost pickup lasts
    powerTime: 1,      // scales how long the timed pickups last
    pickupRate: 1,     // how many power-ups are on the road
    boostChain: 0,     // extra chain links for a wreck made while boosting
    nearMul: 1,        // near-miss bonus scale
    nearChain: 0,      // extra seconds a thread puts back on the clock
    nearTop: 0,        // top speed gained per near miss, resets each district
    ghostOnBank: 0,    // seconds police lose your trail after a bank
    shockOnBank: 0,    // banking spins out nearby pursuit
    crumple: 0,        // crashes absorbed per district
    heatBonus: 0,      // extra scoring at Heat 2+
    roadMul: 1,        // curse: narrower streets
    trafficMul: 1,     // curse: heavier traffic
    policeStart: 0,    // curse: pursuit starts hotter
    brittle: 0,        // curse: wall contact ends the chain outright
    zoomMul: 1,        // curse: tighter camera
    hullMax: 1,        // hull capacity multiplier
    hullCost: 1,       // hull taken per wreck
    bankHeal: 0,       // extra hull welded back on each bank

    /* everything below hooks the toys rather than the base loop */
    ballTime: 1,       // wrecking ball duration scale
    droneTime: 1,      // escort drone duration scale
    arcHops: 0,        // extra chain-lightning hops
    wellPull: 1,       // singularity radius/strength scale
    convoyPay: 1,      // hauler payout scale
    convoyArmour: 0,   // armour knocked off every hauler
    rocketBonus: 0,    // extra rockets per Bazooka
    startShield: 0,    // seconds of Ram Plate at each district start
    startDrones: 0,    // seconds of Escort Drones at each district start
    coinPerWreck: 0,   // garage coins per wreck
    scoreMul: 1,       // flat multiplier on everything banked
    chainStep: 0,      // extra links granted every fifth wreck

    /* ---- weapons ----
       Everything above is a number the engine multiplies by. These are
       systems the engine has to *run*: the perk pool was 49 cards deep and
       every one of them was a passive buff, and the eight that touched a toy
       only extended a toy you still had to find on the road. A card that
       reads "singularities pull harder" is a dead card until a singularity
       shows up. These grant the verb outright. */
    punt: 0,           // wrecked cars fire forward and bowl through traffic
    cook: 0,           // seconds until a wreck detonates; 0 = never
    cookR: 0,          // detonation radius
    slick: 0,          // seconds between burning slicks dropped behind you
    ballAlways: 0,     // the wrecking ball is out for the whole run
    arcAlways: 0,      // every wreck arcs without the pickup
    dronesAlways: 0,   // escort drones for the whole run
    autoload: 0        // seconds between free rockets
  };
}

/* Overclocked offers pair a stronger perk with a permanent drawback. The
   drawback is always legible up front — a hidden cost is not a choice. */
/* ============================================================
   PERKS
   The in-run build, and the only one. A perk arrives at a level-up — earned
   by wrecking, banking and clearing — so it always reads as a reward for the
   last thirty seconds rather than for a menu you walked through. Forty-nine
   of them so that fifteen levels never show you the same three twice, and so
   that two runs diverge inside the first district.

   They are deliberately weighted toward the *toys* rather than toward the
   base numbers: a perk that says "+9% top speed" is a stat line, and a perk
   that says "your wrecking ball never stops" changes what the run is.
   ============================================================ */
const PERKS = [
  /* ---- the chain ---- */
  /* ---- the pass ----
     Everything here does one of the only three useful things: hold the line
     open longer, shove harder per car, or slow the wall. A card that
     multiplied a score would be talking about a number nobody can lose to. */
  { id:'p_clock',   name:'Long Fuse',      rarity:'common',   tag:'Line',
    desc:'A pass stays open 0.45s longer.', apply(M){ M.passWindow += 0.45; } },
  { id:'p_step',    name:'Momentum',       rarity:'uncommon', tag:'Line',
    desc:'Every car you take shoves 30m further.', apply(M){ M.pushBonus += 30; } },
  { id:'p_thread',  name:'Needle',         rarity:'common',   tag:'Line',
    desc:'Threading a gap holds the pass open another 0.4s.',
    apply(M){ M.nearChain += 0.4; } },
  { id:'p_rate',    name:'Snowball',       rarity:'uncommon', tag:'Line',
    desc:'A pass stays open 0.8s longer — two formations become one line.',
    apply(M){ M.passWindow += 0.8; } },
  { id:'p_cap',     name:'Roadblock',      rarity:'rare',     tag:'Line',
    desc:'They close 18% slower for the rest of the run.',
    apply(M){ M.wallSpeed *= 0.82; } },

  /* ---- weapons: cards that hand you a verb, not a coefficient ----
     Everything else in this pool multiplies something the engine already
     does. These make it do something new, and they are owned from the moment
     you take the card rather than waiting on a pickup to show up. */
  { id:'w_punt',    name:'Kickoff',        rarity:'uncommon', tag:'Weapon',
    desc:'The car you hit is launched down the road and wrecks what it bowls into.',
    apply(M){ M.punt = Math.max(M.punt, 1); } },
  { id:'w_punt2',   name:'Break Shot',     rarity:'rare',     tag:'Weapon',
    desc:'Cars you hit are launched, and pass the hit on twice more down the lane.',
    apply(M){ M.punt = Math.max(M.punt, 1) + 2; } },
  { id:'w_cook',    name:'Fuel Cell',      rarity:'uncommon', tag:'Weapon',
    desc:'Wrecks cook off a beat later and take out anything close.',
    apply(M){ M.cook = M.cook || 0.7; M.cookR = Math.max(M.cookR, 165); } },
  { id:'w_cook2',   name:'Thermite',       rarity:'rare',     tag:'Weapon',
    desc:'Wrecks detonate sooner and twice as wide.',
    apply(M){ M.cook = 0.42; M.cookR = Math.max(M.cookR, 165) + 105; } },
  { id:'w_slick',   name:'Tailgunner',     rarity:'uncommon', tag:'Weapon',
    desc:'You leave a burning wake. Anything that follows you into it goes up.',
    apply(M){ M.slick = M.slick ? M.slick * 0.6 : 0.45; } },
  { id:'w_ball',    name:'Dead Weight',    rarity:'rare',     tag:'Weapon',
    desc:'The wrecking ball is out for the rest of the run.',
    apply(M){ M.ballAlways = 1; } },
  { id:'w_arc',     name:'Live Wire',      rarity:'rare',     tag:'Weapon',
    desc:'Every wreck arcs to the nearest car, no pickup needed.',
    apply(M){ M.arcAlways = 1; } },
  { id:'w_drones',  name:'Wingmen',        rarity:'rare',     tag:'Weapon',
    desc:'Two escort drones fly with you for the rest of the run.',
    apply(M){ M.dronesAlways = 1; } },
  { id:'w_load',    name:'Autoloader',     rarity:'uncommon', tag:'Weapon',
    desc:'A rocket loads itself every 5s, forever.',
    apply(M){ M.autoload = M.autoload ? M.autoload * 0.6 : 5; } },

  /* ---- the ball ---- */
  { id:'p_ball1',   name:'Heavy Iron',     rarity:'common',   tag:'Ball',
    desc:'The wrecking ball lasts 60% longer.', apply(M){ M.ballTime += 0.6; } },
  { id:'p_ball2',   name:'Second Chain',   rarity:'rare',     tag:'Ball',
    desc:'Wrecking balls last two and a half times as long.',
    apply(M){ M.ballTime += 1.5; } },

  /* ---- the drones ---- */
  { id:'p_dr1',     name:'Long Patrol',    rarity:'common',   tag:'Drones',
    desc:'Escort drones stay 60% longer.', apply(M){ M.droneTime += 0.6; } },
  { id:'p_dr2',     name:'Standing Escort',rarity:'rare',     tag:'Drones',
    desc:'Every district starts with 8s of escort drones.',
    apply(M){ M.startDrones += 8; } },

  /* ---- the arc ---- */
  { id:'p_arc1',    name:'Conductor',      rarity:'uncommon', tag:'Arc',
    desc:'Arc lightning jumps one extra car.', apply(M){ M.arcHops += 1; } },
  { id:'p_arc2',    name:'Substation',     rarity:'rare',     tag:'Arc',
    desc:'Arc lightning jumps two extra cars.', apply(M){ M.arcHops += 2; } },

  /* ---- the well ---- */
  { id:'p_well1',   name:'Event Horizon',  rarity:'uncommon', tag:'Well',
    desc:'Singularities pull half again as hard, and wider.',
    apply(M){ M.wellPull += 0.5; } },
  /* the four that came across from the old chip table — the only ones of
     the twenty-two that were not already a perk on the same axis */
  { id:'p_slip',    name:'Slipstream',     rarity:'common',   tag:'Risk',
    desc:'Threading pays +50% and puts 0.35s back on the clock.',
    apply(M){ M.nearMul += 0.5; M.nearChain += 0.35; } },
  { id:'p_after',   name:'Afterburn',      rarity:'uncommon', tag:'Power',
    desc:'A wreck made under boost counts as two links.',
    apply(M){ M.boostChain += 1; } },
  { id:'p_kin',     name:'Kinetic Battery',rarity:'uncommon', tag:'Risk',
    desc:'Each thread adds 1.5% top speed for the district.',
    apply(M){ M.nearTop += 0.015; } },
  { id:'p_coil',    name:'Coil Pack',      rarity:'rare',     tag:'Engine',
    desc:'Top speed +20%, but a pass closes 0.35s sooner.',
    apply(M){ M.topMul += 0.20; M.passWindow -= 0.35; } },

  { id:'p_well2',   name:'Collapse',       rarity:'rare',     tag:'Well',
    desc:'Singularities pull twice as hard and last 60% longer.',
    apply(M){ M.wellPull += 1; M.powerTime += 0.6; } },

  /* ---- the convoy ---- */
  { id:'p_cv1',     name:'Hijacker',       rarity:'uncommon', tag:'Convoy',
    desc:'Haulers pay 60% more.', apply(M){ M.convoyPay += 0.6; } },
  { id:'p_cv2',     name:'Can Opener',     rarity:'rare',     tag:'Convoy',
    desc:'Haulers lose a layer of armour — one good hit cracks them.',
    apply(M){ M.convoyArmour += 1; } },

  /* ---- power-ups ---- */
  { id:'p_pu1',     name:'Scrap Sense',    rarity:'common',   tag:'Power',
    desc:'Half again as many power-ups on the road.', apply(M){ M.pickupRate += 0.5; } },
  { id:'p_pu2',     name:'Slow Burn',      rarity:'common',   tag:'Power',
    desc:'Timed power-ups last 40% longer.', apply(M){ M.powerTime += 0.4; } },
  { id:'p_pu3',     name:'Munitions',      rarity:'uncommon', tag:'Power',
    desc:'The Bazooka carries three extra rockets.', apply(M){ M.rocketBonus += 3; } },
  { id:'p_pu4',     name:'Cold Start',     rarity:'uncommon', tag:'Power',
    desc:'Every district starts with 6s of Ram Plate.', apply(M){ M.startShield += 6; } },
  { id:'p_pu5',     name:'Deep Cell',      rarity:'common',   tag:'Power',
    desc:'Boost pickups burn 70% longer.', apply(M){ M.boostTime += 0.7; } },

  /* ---- hull ---- */
  /* ---- mistakes ----
     A small countable budget, so a card that adds one is a large card. There
     are deliberately few of these: the run's downward slope is what makes
     the eighth stretch different from the first. */
  { id:'p_h1',      name:'Spot Weld',      rarity:'common',   tag:'Panel',
    desc:'One more mistake before the run ends.', apply(M){ M.mistakes += 1; } },
  { id:'p_h2',      name:'Bull Bar',       rarity:'common',   tag:'Panel',
    desc:'Barriers no longer cost you a mistake — they only cost the line.',
    apply(M){ M.wallMul = 0; } },
  { id:'p_h3',      name:'Field Kit',      rarity:'uncommon', tag:'Panel',
    desc:'Repair pickups are twice as common.', apply(M){ M.pickupRate += 0.4; M.repairBias = 1; } },
  { id:'p_h4',      name:'Ablative',       rarity:'rare',     tag:'Panel',
    desc:'Two more mistakes.', apply(M){ M.mistakes += 2; } },
  { id:'p_h5',      name:'Crumple Zone',   rarity:'uncommon', tag:'Panel',
    desc:'Survive one run-ending mistake per district.', apply(M){ M.crumple += 1; } },

  /* ---- pay ---- */
  { id:'p_pay1',    name:'Fence',          rarity:'common',   tag:'Pay',
    desc:'Every car you take shoves 15m further.', apply(M){ M.pushBonus += 15; } },
  { id:'p_pay2',    name:'Blood Money',    rarity:'rare',     tag:'Pay',
    desc:'Score up 45%, and every car shoves 20m further.',
    apply(M){ M.scoreMul += 0.45; M.pushBonus += 20; } },
  { id:'p_pay3',    name:'Chop Shop',      rarity:'uncommon', tag:'Pay',
    desc:'Every wreck is worth 14 coins in the garage.',
    apply(M){ M.coinPerWreck += 14; } },
  { id:'p_pay4',    name:'Insurance',      rarity:'uncommon', tag:'Pay',
    desc:'Threading pays double.', apply(M){ M.nearMul += 1; } },

  /* ---- the car ---- */
  { id:'p_c1',      name:'Big Bore',       rarity:'common',   tag:'Engine',
    desc:'Top speed +8%.', apply(M){ M.topMul += 0.08; } },
  { id:'p_c2',      name:'Cold Rubber',    rarity:'common',   tag:'Handling',
    desc:'Grip +22%.', apply(M){ M.gripMul += 0.22; } },
  { id:'p_c3',      name:'Wide Streets',   rarity:'uncommon', tag:'Handling',
    desc:'Every street is 15% wider.', apply(M){ M.roadMul *= 1.15; } },
  { id:'p_c4',      name:'Overdrive',      rarity:'rare',     tag:'Engine',
    desc:'Top speed +18% and the camera pulls back.',
    apply(M){ M.topMul += 0.18; M.zoomMul *= 1.10; } },

  /* ---- traffic ---- */
  { id:'p_t1',      name:'Rush Hour',      rarity:'common',   tag:'Risk',
    desc:'Half again as much traffic to hit.', apply(M){ M.trafficMul += 0.5; } },
  { id:'p_t2',      name:'Gridlock',       rarity:'uncommon', tag:'Risk',
    desc:'Double traffic, and wrecks pay 20% more.',
    apply(M){ M.trafficMul += 1; M.wreckMul += 0.2; } },

  /* ---- heat ---- */
  { id:'p_he1',     name:'Adrenal Feed',   rarity:'uncommon', tag:'Heat',
    desc:'+55% scoring while Heat is 2 or higher.', apply(M){ M.heatBonus += 0.55; } },
  { id:'p_he2',     name:'Ghost Plates',   rarity:'common',   tag:'Heat',
    desc:'Banking makes pursuit lose you for 3s.', apply(M){ M.ghostOnBank += 3; } },
  { id:'p_he3',     name:'Static Discharge',rarity:'uncommon',tag:'Heat',
    desc:'Banking spins out any pursuit close behind.', apply(M){ M.shockOnBank = 1; } },
  { id:'p_he4',     name:'Marked Man',     rarity:'rare',     tag:'Heat',
    desc:'Pursuit starts a tier hotter, and everything pays 30% more.',
    apply(M){ M.policeStart += 1; M.scoreMul += 0.30; } },

  /* ---- the greedy ones ---- */
  { id:'p_g1',      name:'Glass Cannon',   rarity:'rare',     tag:'Risk',
    desc:'Every car shoves 70m further. You start on two fewer mistakes.',
    apply(M){ M.pushBonus += 70; M.mistakes -= 2; } },
  { id:'p_g2',      name:'Featherweight',  rarity:'uncommon', tag:'Risk',
    desc:'Top speed +14%, but one fewer mistake.',
    apply(M){ M.topMul += 0.14; M.mistakes -= 1; } },
  { id:'p_g3',      name:'Redline',        rarity:'rare',     tag:'Risk',
    desc:'A pass closes 0.5s sooner, but every car shoves 55m further.',
    apply(M){ M.passWindow -= 0.5; M.pushBonus += 55; } },
  { id:'p_g4',      name:'Tunnel Vision',  rarity:'uncommon', tag:'Risk',
    desc:'The camera sits tighter, and scoring is up 25%.',
    apply(M){ M.zoomMul *= 0.88; M.scoreMul += 0.25; } },
  { id:'p_g5',      name:'Last Stand',     rarity:'rare',     tag:'Panel',
    desc:'On your last mistake, they close 30% slower.',
    apply(M){ M.lastStand = 1; } },
  { id:'p_g6',      name:'Salvage Rights', rarity:'common',   tag:'Pay',
    desc:'Clearing a district repairs the hull completely.',
    apply(M){ M.clearHeal = 1; } }
];

const perkById = id => PERKS.find(p => p.id === id);

/* Three offers, no repeats of what is already fitted. Rarity odds improve
   with level so the late choices feel like the reward for getting there. */
function rollPerks(owned, level, takenCurses){
  const pool = PERKS.filter(p => !owned.includes(p.id));
  const W = level >= 11 ? { common: 22, uncommon: 40, rare: 38 }
          : level >= 6  ? { common: 42, uncommon: 40, rare: 18 }
                        : { common: 62, uncommon: 31, rare: 7 };
  const picks = [];
  const used = new Set();
  /* A weapon is nine cards in fifty-eight, and left to chance a run can go
     six levels without being offered one — which reads as "this pool is all
     passive buffs", because for that player it was. So the first weapon is
     guaranteed: until you own one, one slot in the offer is reserved for it.
     After that they take their chances with everything else. */
  const armed = owned.some(id => { const p = perkById(id); return p && p.tag === 'Weapon'; });
  for (let n = 0; n < 3 && pool.length; n++) {
    let avail = pool.filter(p => !used.has(p.id));
    if (!armed && n === 0) {
      const guns = avail.filter(p => p.tag === 'Weapon' &&
                                     (level >= 4 || p.rarity !== 'rare'));
      if (guns.length) avail = guns;
    }
    if (!avail.length) break;
    let total = 0;
    for (const p of avail) total += W[p.rarity];
    let r = Math.random() * total, chosen = avail[0];
    for (const p of avail) { r -= W[p.rarity]; if (r <= 0) { chosen = p; break; } }
    used.add(chosen.id);
    /* At most one offer per level carries a curse, never before level 4, and
       the odds climb as the run deepens. This is where the old Overclocked
       chips went: the risk survived, the second draft screen did not. */
    let curse = null;
    const curseOK = level >= 4 && !picks.some(p => p.curse);
    if (curseOK && chosen.rarity !== 'common' &&
        Math.random() < Math.min(0.42, 0.06 + level * 0.03)) {
      const left = CURSES.filter(c => !(takenCurses || []).includes(c.id));
      if (left.length) curse = left[Math.floor(Math.random() * left.length)];
    }
    picks.push(curse ? Object.assign({ curse }, chosen) : chosen);
  }
  return picks;
}

const CURSES = [
  { id:'narrow', name:'Narrow Streets', desc:'Every street is 20% tighter.',
    apply(M){ M.roadMul *= 0.80; } },
  { id:'gridlock', name:'Gridlock', desc:'Half again as much traffic.',
    apply(M){ M.trafficMul += 0.5; } },
  { id:'marked', name:'Marked', desc:'Pursuit starts one tier hotter.',
    apply(M){ M.policeStart += 1; } },
  { id:'brittle', name:'Brittle', desc:'Scraping a barrier ends your chain outright.',
    apply(M){ M.brittle = 1; } },
  { id:'scavenged', name:'Scavenged', desc:'Half as many power-ups on the road.',
    apply(M){ M.pickupRate *= 0.5; } },
  { id:'tunnel', name:'Tunnel Vision', desc:'The camera sits 15% tighter.',
    apply(M){ M.zoomMul *= 0.85; } }
];

/* ============================================================
   EVENTS
   Chosen *before* a district. Each is a boon welded to a bane, both stated
   up front, and each changes how the district actually drives rather than
   only what the numbers say. This is the wager the player makes going in,
   and risk is what buys levels: +50% XP at risk 1, double at risk 2.
   ============================================================ */
const CONTRACTS = [
  { id:'clear', name:'Clear Night', risk:0,
    bane:'Nothing out of the ordinary.',
    boon:'Standard payout.',
    apply(M, L){} },

  { id:'demolition', name:'Demolition Derby', risk:2,
    bane:'Two fewer mistakes.',
    boon:'Every car shoves 60m further.',
    apply(M, L){ M.mistakes -= 2; M.pushBonus += 60; L.wreckPay = 2; } },

  { id:'featherweight', name:'Featherweight', risk:2,
    bane:'One fewer mistake.',
    boon:'Threading pays four times over and holds the line much longer.',
    apply(M, L){ M.mistakes -= 1; M.nearMul += 3; M.nearChain += 0.6; } },

  { id:'armoured', name:'Armoured Up', risk:1,
    bane:'Top speed down 15%.',
    boon:'Three more mistakes.',
    apply(M, L){ M.topMul -= 0.15; M.mistakes += 3; } },

  { id:'downpour', name:'Downpour', risk:1,
    bane:'Wet asphalt — grip down 30%.',
    boon:'Every car shoves 45m further.',
    apply(M, L){ M.gripMul *= 0.70; M.pushBonus += 45; L.wet = 1; } },

  { id:'rush', name:'Rush Hour', risk:1,
    bane:'Twice the traffic.',
    boon:'Threading pays triple and keeps the clock alive.',
    apply(M, L){ M.trafficMul += 1; M.nearMul += 2; M.nearChain += 0.5; } },

  { id:'blackout', name:'Blackout', risk:1,
    bane:'City power is out. You drive on headlights.',
    boon:'A pass stays open 0.7s longer.',
    apply(M, L){ M.passWindow += 0.7; L.blackout = 1; } },

  { id:'dragnet', name:'Dragnet', risk:2,
    bane:'Pursuit is already on you at Heat 2.',
    boon:'Every car shoves 50m further.',
    apply(M, L){ M.policeStart += 2; M.pushBonus += 50; } },

  { id:'roadworks', name:'Roadworks', risk:2,
    bane:'The road is littered with spike strips.',
    boon:'They close 25% slower.',
    apply(M, L){ L.hazards = 1; M.wallSpeed *= 0.75; } },

  /* This used to empty the streets entirely, which was a boon back when the
     game was about dodging. Once traffic became the *scoring* verb, zero
     cars meant zero points and the contract was not hard, it was
     unwinnable. Same flavour, inverted into a real wager: far fewer cars,
     each one worth a great deal more. */
  { id:'ghost', name:'Ghost Town', risk:2,
    bane:'The streets are nearly empty — a third of the traffic.',
    boon:'Every wreck pays three times over.',
    apply(M, L){ M.trafficMul *= 0.34; L.wreckPay *= 3; } },

  { id:'overpressure', name:'Overpressure', risk:2,
    bane:'Grip down 20% and a pass closes 0.4s sooner.',
    boon:'Top speed up 30%.',
    apply(M, L){ M.gripMul *= 0.80; M.passWindow -= 0.4; M.topMul += 0.30; } },

  { id:'scrapyard', name:'Scrapyard', risk:2,
    bane:'Touching a barrier ends your chain outright.',
    boon:'Power-ups everywhere — two and a half times as many.',
    apply(M, L){ M.brittle = 1; M.pickupRate += 1.5; } },

  { id:'narrows', name:'The Narrows', risk:2,
    bane:'Streets 25% tighter.',
    boon:'Every car shoves 90m further.',
    apply(M, L){ M.roadMul *= 0.75; M.pushBonus += 90; } }
];

/* Offer a safe option alongside real wagers, weighted by how deep the run
   is — later districts stop offering the free ride. */
function rollContracts(district, elite){
  const pool = CONTRACTS.filter(c => c.id !== 'clear');
  const picks = [];
  const used = new Set();
  const want = 3;

  if (!elite && district <= 2) { picks.push(CONTRACTS[0]); used.add('clear'); }

  while (picks.length < want && used.size < CONTRACTS.length) {
    /* the opening district never deals a risk-2 wager: a learner who takes
       Dragnet on district 1 is dead in twenty seconds and knows only that
       the game is unfair */
    const avail = pool.filter(c => !used.has(c.id) && (!elite || c.risk >= 1)
                                && (district > 1 || c.risk < 2));
    if (!avail.length) break;
    const c = avail[Math.floor(Math.random() * avail.length)];
    used.add(c.id);
    picks.push(c);
  }
  return picks;
}
const contractById = id => CONTRACTS.find(c => c.id === id);

const curseById = id => CURSES.find(c => c.id === id);

/* Level params a contract can bend, separate from the persistent modifier
   table so they reset when the district ends. */
function levelDefaults(){
  return { quotaMul: 1, wet: 0, blackout: 0, hazards: 0, wreckPay: 1, xpMul: 1 };
}

function build(curseIds, contractId, perkIds){
  const M = defaults();
  const L = levelDefaults();
  for (const id of (perkIds || [])) { const p = perkById(id); if (p) p.apply(M, L); }
  for (const id of curseIds) { const c = curseById(id); if (c) c.apply(M); }
  const k = contractById(contractId);
  /* Risk is the whole point of an event, so it has to buy something the
     safe option cannot: levels. Risk 1 is half again the XP, risk 2 double. */
  if (k) { k.apply(M, L); L.xpMul *= 1 + k.risk * 0.5; }
  return { M, L };
}

return { defaults, levelDefaults, CURSES, CONTRACTS, PERKS,
         curseById, contractById, perkById, rollContracts, rollPerks, build };
})();
