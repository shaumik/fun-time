/* ============================================================
   NEON HEAT — chips, curses and the draft
   Every chip writes into a flat modifier table the physics and
   scoring read each frame. Keeping effects declarative means builds
   stack and interact without special-casing anywhere in the engine.
   ============================================================ */
window.NHChips = (() => {
'use strict';

/* the full modifier surface — anything a chip can touch lives here */
function defaults(){
  return {
    bankMul: 1,        // payout multiplier when you cash in
    wreckMul: 1,       // payout multiplier on a wreck specifically
    multRate: 0.60,    // chain links -> multiplier slope
    multCap: 9.9,
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
    bankHeal: 0        // extra hull welded back on each bank
  };
}

/* rarity drives both the draft weights and the card colour */
const CHIPS = [
  /* ---------------- common ---------------- */
  { id:'slipstream', name:'Slipstream', rarity:'common', tag:'Risk',
    desc:'Threading pays +50% and puts another 0.35s back on the clock.',
    apply(M){ M.nearMul += 0.5; M.nearChain += 0.35; } },

  { id:'slowburn', name:'Slow Burn', rarity:'common', tag:'Chain',
    desc:'The chain clock runs 0.9s longer.',
    apply(M){ M.chainTime += 0.9; } },

  { id:'coldrubber', name:'Cold Rubber', rarity:'common', tag:'Handling',
    desc:'Grip +20%. Snaps straight out of a slide.',
    apply(M){ M.gripMul += 0.20; } },

  { id:'bigbore', name:'Big Bore', rarity:'common', tag:'Engine',
    desc:'Top speed +9%.',
    apply(M){ M.topMul += 0.09; } },

  { id:'pressure', name:'Pressure Cell', rarity:'common', tag:'Engine',
    desc:'Boost pickups burn 60% longer.',
    apply(M){ M.boostTime += 0.60; } },

  { id:'magnet', name:'Scrap Magnet', rarity:'common', tag:'Power',
    desc:'Half again as many power-ups on the road.',
    apply(M){ M.pickupRate += 0.5; } },

  /* ---------------- uncommon ---------------- */
  { id:'afterburn', name:'Afterburn', rarity:'uncommon', tag:'Combo',
    desc:'A wreck made under boost counts as two links in the chain.',
    apply(M){ M.boostChain += 1; } },

  { id:'halflife', name:'Half Life', rarity:'uncommon', tag:'Power',
    desc:'Ram Plate and Surge last 70% longer.',
    apply(M){ M.powerTime += 0.70; } },

  { id:'interest', name:'Compound Interest', rarity:'uncommon', tag:'Combo',
    desc:'Multiplier climbs 35% faster.',
    apply(M){ M.multRate += 0.15; } },

  { id:'ghost', name:'Ghost Plates', rarity:'uncommon', tag:'Heat',
    desc:'Banking makes pursuit lose you for 3s.',
    apply(M){ M.ghostOnBank += 3; } },

  { id:'static', name:'Static Discharge', rarity:'uncommon', tag:'Heat',
    desc:'Banking spins out any pursuit close behind.',
    apply(M){ M.shockOnBank = 1; } },

  { id:'crumple', name:'Crumple Zone', rarity:'uncommon', tag:'Hull',
    desc:'Survive one totalled hull per district, patched to 45%.',
    apply(M){ M.crumple += 1; } },

  { id:'rollcage', name:'Roll Cage', rarity:'common', tag:'Hull',
    desc:'Hull +35%.',
    apply(M){ M.hullMax += 0.35; } },

  { id:'ram', name:'Ram Bar', rarity:'common', tag:'Hull',
    desc:'Wrecks cost 35% less hull.',
    apply(M){ M.hullCost *= 0.65; } },

  { id:'weld', name:'Field Weld', rarity:'uncommon', tag:'Hull',
    desc:'Every bank welds back an extra 9 hull.',
    apply(M){ M.bankHeal += 9; } },

  { id:'juggernaut', name:'Juggernaut', rarity:'rare', tag:'Hull',
    desc:'Hull +60%, and wrecks cost half.',
    apply(M){ M.hullMax += 0.60; M.hullCost *= 0.5; } },

  { id:'adrenal', name:'Adrenal Feed', rarity:'uncommon', tag:'Heat',
    desc:'+60% scoring while Heat is 2 or higher.',
    apply(M){ M.heatBonus += 0.6; } },

  { id:'kinetic', name:'Kinetic Battery', rarity:'uncommon', tag:'Risk',
    desc:'Each near miss adds +1.5% top speed for the district.',
    apply(M){ M.nearTop += 0.015; } },

  /* ---------------- rare ---------------- */
  { id:'redline', name:'Redline', rarity:'rare', tag:'Combo',
    desc:'Multiplier ceiling raised to ×20.',
    apply(M){ M.multCap = Math.max(M.multCap, 20); } },

  { id:'bloodmoney', name:'Blood Money', rarity:'rare', tag:'Combo',
    desc:'Every bank pays +75%.',
    apply(M){ M.bankMul += 0.75; } },

  { id:'overdrive', name:'Overdrive Coil', rarity:'rare', tag:'Engine',
    desc:'Top speed +20%, but the chain clock runs 0.4s shorter.',
    apply(M){ M.topMul += 0.20; M.chainTime -= 0.40; } },

  { id:'piledriver', name:'Pile Driver', rarity:'rare', tag:'Chain',
    desc:'Every wreck banks 45% more.',
    apply(M){ M.wreckMul += 0.45; } }
];

/* Overclocked offers pair a stronger chip with a permanent drawback.
   The drawback is always legible up front — no hidden costs. */
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
   CONTRACTS
   Chosen *before* a district, not after. Each is a boon welded to a bane,
   both stated up front, and each changes how the district actually drives
   rather than only what the numbers say. This is the wager the player
   makes going in; chips are the build they keep coming out.
   ============================================================ */
const CONTRACTS = [
  { id:'clear', name:'Clear Night', risk:0,
    bane:'Nothing out of the ordinary.',
    boon:'Standard payout.',
    apply(M, L){} },

  { id:'demolition', name:'Demolition Derby', risk:2,
    bane:'Hull cut to 60%.',
    boon:'Wrecks pay double and cost no hull at all.',
    apply(M, L){ M.hullMax *= 0.60; M.hullCost = 0; L.wreckPay = 2; } },

  { id:'featherweight', name:'Featherweight', risk:2,
    bane:'Every wreck costs triple hull.',
    boon:'Threading a gap pays four times over.',
    apply(M, L){ M.hullCost *= 3; M.nearMul += 3; } },

  { id:'armoured', name:'Armoured Up', risk:1,
    bane:'Top speed down 15%.',
    boon:'Hull doubled.',
    apply(M, L){ M.topMul -= 0.15; M.hullMax *= 2; } },

  { id:'downpour', name:'Downpour', risk:1,
    bane:'Wet asphalt — grip down 30%.',
    boon:'Every bank pays +50%.',
    apply(M, L){ M.gripMul *= 0.70; M.bankMul += 0.5; L.wet = 1; } },

  { id:'rush', name:'Rush Hour', risk:1,
    bane:'Twice the traffic.',
    boon:'Threading pays triple and keeps the clock alive.',
    apply(M, L){ M.trafficMul += 1; M.nearMul += 2; M.nearChain += 0.5; } },

  { id:'blackout', name:'Blackout', risk:1,
    bane:'City power is out. You drive on headlights.',
    boon:'The multiplier climbs 60% faster.',
    apply(M, L){ M.multRate += 0.25; L.blackout = 1; } },

  { id:'dragnet', name:'Dragnet', risk:2,
    bane:'Pursuit is already on you at Heat 2.',
    boon:'Heat pays double.',
    apply(M, L){ M.policeStart += 2; M.heatBonus += 1.0; } },

  { id:'roadworks', name:'Roadworks', risk:2,
    bane:'The road is littered with spike strips.',
    boon:'Quota cut by 35%.',
    apply(M, L){ L.hazards = 1; L.quotaMul *= 0.65; } },

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
    bane:'Grip down 20% and the chain clock is half a second shorter.',
    boon:'Top speed up 30%.',
    apply(M, L){ M.gripMul *= 0.80; M.chainTime -= 0.5; M.topMul += 0.30; } },

  { id:'scrapyard', name:'Scrapyard', risk:2,
    bane:'Touching a barrier ends your chain outright.',
    boon:'Power-ups everywhere — two and a half times as many.',
    apply(M, L){ M.brittle = 1; M.pickupRate += 1.5; } },

  { id:'narrows', name:'The Narrows', risk:2,
    bane:'Streets 25% tighter.',
    boon:'The multiplier ceiling comes off — \u00d725.',
    apply(M, L){ M.roadMul *= 0.75; M.multCap = Math.max(M.multCap, 25); } }
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
    const avail = pool.filter(c => !used.has(c.id) && (!elite || c.risk >= 1));
    if (!avail.length) break;
    const c = avail[Math.floor(Math.random() * avail.length)];
    used.add(c.id);
    picks.push(c);
  }
  return picks;
}
const contractById = id => CONTRACTS.find(c => c.id === id);

const byId = id => CHIPS.find(c => c.id === id);
const curseById = id => CURSES.find(c => c.id === id);

const RARITY_W = { common: 60, uncommon: 30, rare: 10 };

/* Draft three offers, no duplicates, skipping anything already maxed.
   Odds of an Overclocked (chip + curse) offer climb as the run deepens. */
function roll(owned, district, takenCurses, count, rareBias){
  const pool = CHIPS.filter(c => {
    const held = owned.filter(o => o === c.id).length;
    if (c.id === 'redline' || c.id === 'static') return held < 1;  // binary effects
    return held < 3;
  });

  const picks = [];
  const used = new Set();
  const want = count || 3;
  /* hazard pay: a risky contract or an elite skews the table toward rares */
  const W = rareBias ? { common: 18, uncommon: 38, rare: 44 } : RARITY_W;
  for (let n = 0; n < want && pool.length; n++) {
    let total = 0;
    const avail = pool.filter(c => !used.has(c.id));
    if (!avail.length) break;
    for (const c of avail) total += W[c.rarity];
    let r = Math.random() * total, chosen = avail[0];
    for (const c of avail) { r -= W[c.rarity]; if (r <= 0) { chosen = c; break; } }
    used.add(chosen.id);

    /* one offer at most per draft carries a curse, and never on district 1 */
    const curseOK = district > 1 && !picks.some(p => p.curse);
    const chance = Math.min(0.45, 0.10 + district * 0.045);
    let curse = null;
    if (curseOK && Math.random() < chance) {
      const left = CURSES.filter(c => !takenCurses.includes(c.id));
      if (left.length) curse = left[Math.floor(Math.random() * left.length)];
    }
    picks.push({ chip: chosen, curse });
  }
  return picks;
}

/* Level params a contract can bend, separate from the persistent modifier
   table so they reset when the district ends. */
function levelDefaults(){
  return { quotaMul: 1, wet: 0, blackout: 0, hazards: 0, wreckPay: 1 };
}

function build(ownedIds, curseIds, contractId){
  const M = defaults();
  const L = levelDefaults();
  for (const id of ownedIds) { const c = byId(id); if (c) c.apply(M); }
  for (const id of curseIds) { const c = curseById(id); if (c) c.apply(M); }
  const k = contractById(contractId);
  if (k) k.apply(M, L);
  return { M, L };
}

return { defaults, levelDefaults, CHIPS, CURSES, CONTRACTS,
         byId, curseById, contractById, roll, rollContracts, build };
})();
