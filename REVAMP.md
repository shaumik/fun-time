# NEON HEAT — revamp spec

Plan of record for the gameplay rebuild. Supersedes the run/district/quota model in
DESIGN.md. No code has been changed yet; this is what to build and in what order.

---

## 1. The problem this solves

Measured with a bot driving the real input path, three findings killed the old model:

| Finding | Evidence |
|---|---|
| The quota never binds | 4/4 measured districts: full quota met inside stage 0, at 22–34% of the road. A bot that never targets anything cleared D1's quota with 5 wrecks. |
| No run-level arc | Hull is refilled at 7 points (bank, gate, clear, boss, pickup, depot, welder). District 8 starts as fresh as district 1. |
| No spatial decision | Every car is worth the same as every other car, so "hit the nearest thing" is optimal. An 8-line bot capped the multiplier. |

Root cause: with one input, the only thing a player can decide is **where the car is**.
Nothing in the old build made one line better than another, so no amount of meta-structure
on top could create a decision.

---

## 2. The objective

> **Something is behind you and it never stops closing. Wrecking traffic is the only thing
> that pushes it back. How far do you get?**

Stated in the game, on screen, from the first second. Loss is always attributable: the Wall
caught you, and you can name the pack you misread.

**The skill being trained:** road-reading under pressure — converting a formation into three
wrecks in one pass instead of one wreck in three passes.

---

## 3. Core loop — three forces

1. **The Wall (the accelerator).** Closes at a fixed rate regardless of your speed. It is a
   clock, not a race. Says *go*.
2. **Mistakes (the brake).** A small, countable budget spent only on errors — never on the
   verb. Says *but not like that*.
3. **Formations (the decision).** Traffic arrives in readable, finite packs. A pack you miss
   is gone. Says *which line?*

---

## 4. Numbers

Starting values to tune against the harness. All world units (`SEG = 56`, player top ≈ 620 u/s).

### The Wall
| Constant | Value | Note |
|---|---|---|
| `WALL_GAP_START` | 700u | just off the bottom edge |
| `WALL_GAP_MAX` | 900u | pushback above this is banked as distance bonus, not lost |
| `WALL_CLOSE` (act 1) | 55 u/s | ~12.7s to death from start with zero wrecks |
| `WALL_CLOSE` growth | +4 u/s per stretch cleared | **this is the entire difficulty curve** |
| Danger threshold | gap < 350u | wall visible, audio rises, edge vignette |
| Contact | run over | no grace, no revive-by-hull |

### Pushback — the pass, not the wreck, is the unit
| Cars in one pass | Pushback | Cumulative |
|---|---|---|
| 1st | 110u | 110 |
| 2nd | 165u | 275 |
| 3rd | 220u | 495 |
| 4th | 275u | 770 |

Pass ends after **1.2s** without contact. ×1.5 escalation per car.

### Formations
- Cadence: one pack every **5.5s** of road ahead.
- Size: 1–4 cars, mean **2.4**.
- Shapes: line-abreast, echelon, column, wedge. Placed in specific lanes with a deliberate gap.
- Nothing spawns behind the player. A missed pack does not come back.

### The tension this produces (why these numbers)
Holding station requires **55 u/s** of pushback.

| Play quality | Cars per pack | Pushback rate | Outcome |
|---|---|---|---|
| Naive (hits what it bumps into) | ~0.5 | ~10 u/s | dies in ~14s |
| Average (takes the near car) | 1 | 20 u/s | dies slowly |
| Competent (reads the pack) | 2.4 | ~53 u/s | holds station |
| Good (full read) | 3–4 | 90+ u/s | gains ground |

**Naive dies, competent survives, good gains.** That gradient is the game.

### Mistakes
- Budget: **5**. Displayed as an integer, not a bar.
- Wrecking a car: **0**. Never charge for the verb.
- Barrier contact: **1**. Pursuit contact: **1**. Wrong target (heavy/hazard/armoured): **1**.
- One repair source only: the Repair pickup, **+2 mistakes**.

### Run shape
- Stretch ≈ **45–60s**. Route map between stretches (keep the existing board).
- 3 acts, boss at the end of each. Target good run: **4–6 minutes**.
- Bosses become **road-blocks**, not health bars: the unit overtakes and blocks the road while
  the Wall keeps closing. Get past it before the Wall arrives.

---

## 5. Meta-progression

### The rule
> Anything permanent may change **what you can do** or **how many options you get**.
> Only six things may change **how strong you are**, and the difficulty curve is authored
> against all six being owned.

The old build had `powerIndex()` — a function whose job was to undo the player's purchases —
and it still measured a maxed save *failing districts a fresh save cleared*. That is what
happens when upgrades multiply the number the curve is tuned against. Authoring against the
maxed loadout deletes `powerIndex()` entirely: a new player has an easier game because they
own less, and nothing needs compensating.

**`WALL_CLOSE` is never an upgrade target.** It is the difficulty dial.

### Tier A — Power. Six purchases, hard-capped ≈ 1.4×
| Item | Effect |
|---|---|
| Reinforced Frame I / II / III | +1 mistake each (5 → 8) |
| Pre-Draft | start every run with 1 perk already taken |
| Black Box | start every run with a Ram Plate fitted |
| Heavy Bumper | +15u pushback per car (110 → 125 base) |

### Tier B — Choice. Unbounded, zero inflation
- Fourth card on every perk offer (3 → 4)
- One reroll per run
- Ban one perk from the pool permanently
- Choose your starting city

This tier feels excellent to buy and costs the balance nothing. The old build had none of it.

### Tier C — Access. The retention engine
- **Cars with real handling differences**, not stat rolls:
  - *Runner* — narrow, sharp turn. Fewer cars per pass, but survives lines nothing else can.
  - *Hauler* — wide, plows a full lane, turns badly. High ceiling on a straight read.
  - *Interceptor* — fast; packs arrive sooner, so it demands earlier reads.
- **Cities** unlocked by depth: Grid (start) → Docks (depth 6) → Undercity (depth 10) → Causeway (act 3 clear).
- **Tool unlocks** add cards to the draft pool. Each one makes runs more varied, not stronger —
  and turns the existing 58-perk pool into a progression track for free.

### Tier D — Cosmetic
Liveries, trails, the rendered bay. Keep all of it.

### Currency
Coins pay on **depth**, not score. Score was superlinear — measured 120× spread between a god
run (156,000) and a casual one (1,300) — which is why no price ladder could serve both.

```
coins = stretches_reached × 120  +  first-time-depth bonuses  +  daily drop
```

Spread target: a great run pays ≈ **2.5×** a bad one. Next unlock always ≈ 2–3 runs away, and
visible.

---

## 6. Disposition of existing systems

### Delete
| System | Location |
|---|---|
| Quota + power index | `game.js:1908-1929` |
| Stage cuts / stage pay | `game.js:1943-1944`, fail branch `7327-7331` |
| Overtime | `game.js:4243-4248`, taper `4191`, limp-home `4303-4315` |
| Chain clock | `chainTime()` `3079`, countdown `4479-4482` |
| Heat tiers | `4486-4490`, `heatMul` `4180` |
| Hull cost on wreck | `2777` |
| Hull heals (bank/gate/clear/welder) | `4234`, `7341`, `7367-7369`, `3333` |
| Boss integrity + bite cap | `BOSS_BITE` `2430`, `bossHp` `1968` |
| Crew tree stat nodes | `Tree` |
| Score as headline | `UI.score` |
| Dead duplicate in `districtCfg` | `1985-1994` (unreachable after `return` at `1980`) |

### Keep unchanged
Driving model and self-aligning torque · zone generator and zone rules · route map ·
track generation · renderer and post FX · audio · garage bay rendering · liveries ·
mobile input layer · adaptive quality.

### Rewrite against the new loop
- **Perks (58)** — now modify wall speed, pack density, pushback per car, mistake budget.
  Expect ~⅓ dead on arrival.
- **Contracts (boon/bane)** — same, keep the wager framing.
- **Traffic spawner** — `addTraffic` `~2350` and the density top-up `4614-4620` become pack spawning.
- **Chain/multiplier plumbing** `2768-2771` — becomes pushback-per-pass.
- **HUD** — four elements only:
  1. The Wall (a thing on screen, not a number)
  2. Route ahead — one bar for the whole run, never resets per stretch
  3. Cars taken **in this pass**
  4. Mistakes left, as an integer

---

## 7. Build order

**Phase 0 — prototype gate (do not skip)**
1. Build the Wall behind a flag.
2. Build formations.
3. Wire pushback-per-pass.
4. Play it with quota/gates/heat/XP/coins forced off, one zone, no perks.
   **Gate: it must be fun for 90 seconds with nothing else in it.** If it isn't, stop — the
   rest of this document is wasted work.

**Phase 1 — stop charging for the verb**
5. Wreck cost → 0.
6. Mistakes charged only for errors.
7. Remove all heals but the pickup.

**Phase 2 — cuts**
8. Quota, gates, overtime, chain clock, heat. (Order matters: 5–7 before 8–10, or the game is
   briefly unplayable.)

**Phase 3 — say what the game is**
9. HUD to four elements. Depth as the only score. Bosses as road-blocks. One perk per stretch.

**Phase 4 — meta**
10. Tier A/B/C/D garage. Depth-based coins. Author `WALL_CLOSE` against the maxed Tier A loadout.

---

## 8. Verification — what shipped, and what did not

All of sections 1–7 are built and on the branch. The suite passes: `flow`, `hud`, `ads`,
`sdk`, `sizes`. (`physics` flags integrator drift at high refresh rates; that is
pre-existing and unchanged — 9.9% before this work, 8.0% after, same code path.)

Harness drives the real input path via `MS.steer`. Three profiles, 6 runs each, fresh save:

| Profile | Behaviour | Target | **Measured (median)** | |
|---|---|---|---|---|
| `cruise` | follows road centre, never targets | dies < 25s | **20.6s** (14.6–120.9) | ✅ |
| `hunt` | always the nearest car | plateaus, 90–150s | **116.9s** (64.7–160.3) | ✅ |
| `reader` | solves for most cars per pass | 2–3× `hunt` | **80.6s** (19.1–166.1) — *below* `hunt` | ❌ |

Every death is attributable to a named event (`wall`, `traffic`, `police`). ✅

### The Phase 0 gate has NOT passed

The `reader` / `hunt` gap is the single assertion that decides whether this design works,
and it is currently **inverted**: solving for the best line performs *worse* than driving at
the nearest car. Two candidate explanations, and the harness cannot separate them:

1. **The bot is a bad proxy.** `reader` picks an entry car by a greedy heuristic and commits
   to it. The "best line" entry car is frequently *less reachable* than the nearest one, so
   the bot spends its time crossing the road instead of wrecking. A human reads the shape and
   steers through it; the bot solves a scoring function and drives at a point.
2. **Formations still are not asking a real question.** An earlier round showed that in a
   tight cluster the nearest car usually *is* on the best line — the clustering was doing the
   player's thinking. Baited shapes (a lead car in its own lane, cluster behind it elsewhere)
   were added to force the wrong choice to be attractive. They did not move the gap.

**Do not tune further against this bot.** The next step is a human playtest of the Phase 0
loop: does taking a four-car wedge on one line *feel* different from picking off three cars
separately, and can you see the bait coming in time to refuse it? That is a question about
readability at speed, and a scoring function cannot answer it.

If a human also cannot beat `hunt` by reading, the problem is (2) and the fix is in the
formation vocabulary — longer approach, more lateral separation between bait and cluster, or
slower relative closing speed to buy reading time.

### What is solid regardless

- The Wall works as the run's only clock. Doing nothing kills you in ~20s, every time.
- Death is always attributable — the sentence "I lost because ___" now completes.
- The run has a slope: mistakes carry across stretches with one repair source.
- Variance is very high — `cruise` ranged 14.6s to 120.9s, `reader` 19.1s to 166.1s. Six
  samples per profile is thin, and anything tuned on fewer is noise. Any future tuning pass
  needs 20+ runs per profile before a 20% difference means anything.

## 9. Open risks

1. **The camera is biased forward.** Addressed with `drawWall()` (a wall of light and dust
   spanning the road in world space) plus `drawRear()` (a screen-space band at the bottom edge
   that grows and beats faster as the gap closes). **Unverified by a human, and unverified in
   portrait**, where there is far less road visible — still the highest-risk item.
2. **Pack readability at speed.** 5.5s cadence at 620 u/s means a pack is visible for roughly
   one second before commitment. If the camera can't show enough road ahead, the read is a
   guess and the skill gradient collapses.
3. **Perk pool attrition.** A third of 58 cards may not survive the rewrite. Budget for
   authoring replacements, not just porting.
4. **Run length vs. platform.** 4–6 minutes is long for a web session. If retention data says
   otherwise, shorten stretches before shortening the ladder — the ladder is what makes depth
   brag-able.
