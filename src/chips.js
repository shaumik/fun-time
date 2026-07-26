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
    accrueMul: 1,      // rate the pending bank fills
    bankMul: 1,        // payout multiplier when you cash in
    multRate: 0.42,    // chain seconds -> multiplier slope
    multCap: 9.9,
    topMul: 1,
    gripMul: 1,
    nitroCap: 1,
    nitroRegen: 1,
    nitroDrain: 1,
    driftThresh: 0.20, // slip angle that counts as a drift
    chainGrace: 0.42,  // seconds after release before the bank pays
    nearMul: 1,        // near-miss bonus scale
    nearNitro: 0,      // nitro refunded per near miss
    nearTop: 0,        // top speed gained per near miss, resets each district
    afterburn: 0,      // multiplier per second while boosting mid-drift
    ghostOnBank: 0,    // seconds police lose your trail after a bank
    shockOnBank: 0,    // banking spins out nearby pursuit
    crumple: 0,        // crashes absorbed per district
    heatBonus: 0,      // extra scoring at Heat 2+
    roadMul: 1,        // curse: narrower streets
    trafficMul: 1,     // curse: heavier traffic
    policeStart: 0,    // curse: pursuit starts hotter
    brittle: 0,        // curse: wall contact ends the chain outright
    zoomMul: 1         // curse: tighter camera
  };
}

/* rarity drives both the draft weights and the card colour */
const CHIPS = [
  /* ---------------- common ---------------- */
  { id:'slipstream', name:'Slipstream', rarity:'common', tag:'Risk',
    desc:'Near misses pay +50% and refund nitro.',
    apply(M){ M.nearMul += 0.5; M.nearNitro += 0.12; } },

  { id:'feather', name:'Feathered Throttle', rarity:'common', tag:'Chain',
    desc:'Twice as long to bank after you straighten up.',
    apply(M){ M.chainGrace += 0.45; } },

  { id:'coldrubber', name:'Cold Rubber', rarity:'common', tag:'Handling',
    desc:'Grip +20%. Snaps straight out of a slide.',
    apply(M){ M.gripMul += 0.20; } },

  { id:'bigbore', name:'Big Bore', rarity:'common', tag:'Engine',
    desc:'Top speed +9%.',
    apply(M){ M.topMul += 0.09; } },

  { id:'deeptank', name:'Deep Tank', rarity:'common', tag:'Engine',
    desc:'Nitro tank +40%, refills 30% faster.',
    apply(M){ M.nitroCap += 0.40; M.nitroRegen += 0.30; } },

  { id:'hairtrigger', name:'Hair Trigger', rarity:'common', tag:'Chain',
    desc:'Shallower slides count as drifts.',
    apply(M){ M.driftThresh = Math.max(0.10, M.driftThresh - 0.07); } },

  /* ---------------- uncommon ---------------- */
  { id:'afterburn', name:'Afterburn', rarity:'uncommon', tag:'Combo',
    desc:'Nitro while drifting adds +0.6 multiplier per second.',
    apply(M){ M.afterburn += 0.6; } },

  { id:'interest', name:'Compound Interest', rarity:'uncommon', tag:'Combo',
    desc:'Multiplier climbs 35% faster.',
    apply(M){ M.multRate += 0.15; } },

  { id:'ghost', name:'Ghost Plates', rarity:'uncommon', tag:'Heat',
    desc:'Banking makes pursuit lose you for 3s.',
    apply(M){ M.ghostOnBank += 3; } },

  { id:'static', name:'Static Discharge', rarity:'uncommon', tag:'Heat',
    desc:'Banking spins out any pursuit close behind.',
    apply(M){ M.shockOnBank = 1; } },

  { id:'crumple', name:'Crumple Zone', rarity:'uncommon', tag:'Defence',
    desc:'Walk away from one wreck per district.',
    apply(M){ M.crumple += 1; } },

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
    desc:'Top speed +20%, but nitro burns 30% faster.',
    apply(M){ M.topMul += 0.20; M.nitroDrain += 0.30; } },

  { id:'longfuse', name:'Long Fuse', rarity:'rare', tag:'Chain',
    desc:'The pending bank fills 45% faster.',
    apply(M){ M.accrueMul += 0.45; } }
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
  { id:'drytank', name:'Dry Tank', desc:'Nitro no longer refills on its own.',
    apply(M){ M.nitroRegen = 0; } },
  { id:'tunnel', name:'Tunnel Vision', desc:'The camera sits 15% tighter.',
    apply(M){ M.zoomMul *= 0.85; } }
];

const byId = id => CHIPS.find(c => c.id === id);
const curseById = id => CURSES.find(c => c.id === id);

const RARITY_W = { common: 60, uncommon: 30, rare: 10 };

/* Draft three offers, no duplicates, skipping anything already maxed.
   Odds of an Overclocked (chip + curse) offer climb as the run deepens. */
function roll(owned, district, takenCurses){
  const pool = CHIPS.filter(c => {
    const held = owned.filter(o => o === c.id).length;
    if (c.id === 'redline' || c.id === 'static') return held < 1;  // binary effects
    return held < 3;
  });

  const picks = [];
  const used = new Set();
  for (let n = 0; n < 3 && pool.length; n++) {
    let total = 0;
    const avail = pool.filter(c => !used.has(c.id));
    if (!avail.length) break;
    for (const c of avail) total += RARITY_W[c.rarity];
    let r = Math.random() * total, chosen = avail[0];
    for (const c of avail) { r -= RARITY_W[c.rarity]; if (r <= 0) { chosen = c; break; } }
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

function build(ownedIds, curseIds){
  const M = defaults();
  for (const id of ownedIds) { const c = byId(id); if (c) c.apply(M); }
  for (const id of curseIds) { const c = curseById(id); if (c) c.apply(M); }
  return M;
}

return { defaults, CHIPS, CURSES, byId, curseById, roll, build };
})();
