# NEON HEAT — design & monetization brief

**One line:** A demolition roguelite you play with one axis. Steer — that is the entire
control surface — ram traffic to build a chain, and race a clock that resets with every
wreck, climbing a ladder of city districts on a hull you spend rather than protect.

---

## Why this concept

> **Something is behind you and it never stops closing. Wrecking traffic is the only
> thing that pushes it back. How far do you get?**

**The constraint that decides everything.** There is one input: where the car is on the
road. No throttle, no brake, no button. That is not a limitation to work around, it is
the design brief — and it means every system has exactly one job: *give the player a
reason to prefer one line over another, right now.*

That test is what the first version failed, underneath every other problem it had.
Every car on the road was worth what every other car was worth, so "hit whatever is
nearest" was optimal and an eight-line bot capped the multiplier. When the correct play
is that legible, you have motion, not decisions.

**What the quota model got wrong**, measured with a bot driving the real input path:

| Finding | Evidence |
|---|---|
| The quota never bound | 4/4 districts had their full quota met inside the first stretch, at 22–34% of the road. A bot that never targeted anything cleared district one with five wrecks. |
| No run-level arc | Hull was refilled at seven points. District 8 started as fresh as district 1. |
| No spatial decision | Uniform lane scatter. Every target equivalent. |

A threat you have already beaten cannot apply pressure, and the gates, overtime and
pacing curve stacked on top of it were scaffolding around a constraint that did not
bind. See [REVAMP.md](REVAMP.md) for the full disposition.

**The art constraint second.** Hand-drawn sprites made without an illustrator are the
most common reason a self-published web game looks cheap. So there are no image files
and no audio files. Everything is generated at runtime, and the polish comes from a
rendering pipeline and a synthesiser rather than from assets.

**The platform third.** Driving is CrazyGames' strongest evergreen category behind .io,
and unlike .io it needs no servers and no concurrency floor to feel alive.

## The three forces

**1. The Wall — the accelerator.** A pursuit mass at a tracked gap behind the car,
closing at a fixed rate in world units per second *independent of the player's speed*.
It is a clock wearing a costume: you cannot outrun it and you cannot hide from it by
driving well. It says *go*.

| Constant | Value |
|---|---|
| Opening gap | 700u — just off the bottom edge |
| Ceiling | 900u; pushback above it pays out as score rather than vanishing |
| Closing rate | 48 u/s at act 1 |
| Growth | +4 u/s per stretch cleared — **this is the entire difficulty curve** |
| Contact | run over, no grace |

**2. Mistakes — the brake.** Five, countable, displayed as an integer. A barrier, a
pursuit unit, or an armoured van you should have read and gone around costs exactly
one. **Wrecking traffic costs nothing.** The old build charged hull for the core verb,
which is precisely why it then needed seven separate places that gave hull back; stop
charging for the thing you are telling the player to do and the entire heal economy
becomes unnecessary. One repair source survives — the pickup — so the run has a slope.

**3. Formations — the decision.** Traffic arrives in readable finite packs: single,
pair, line-abreast, echelon, column, wedge. Nothing spawns behind you. **A pack you
misread is gone.**

## The pass, and why it is the whole game

Pushback escalates *within a single pass* and resets after 1.2s without contact:

| Cars on one line | Pushback | Cumulative |
|---|---|---|
| 1st | 95u | 95 |
| 2nd | 162u | 257 |
| 3rd | 275u | 532 |
| 4th | 467u | 999 |

Four cars on one line is worth 999u; four cars taken separately is 380u. A 2.6× edge
for reading the formation and committing to the line through it — and that gap *is* the
skill ceiling.

**The inequality that makes it a game.** A formation arrives every ~6.1s (spacing is set
by *relative* closing speed — the player does ~620 and traffic ~270, so packs converge
at about 350 u/s, not at the speedometer reading). Holding station needs ~290u from
each one. One car pays 95 and cannot cover it. Two pay 257 and bleed slowly. Three pay
532 and gain ground. So the road is only survivable if you take most of each formation.

Both numbers were measured wrong first. At 26-segment spacing the road was dense enough
that driving straight down the middle harvested 37 cars in a minute and the do-nothing
bot scored as well as the reading bot — the skill the game exists to train was worth
nothing. Fewer packs, tighter, with real empty road between them is what fixed it. And
at 110/×1.5 pushback a four-car line was worth only 1.75× four separate cars, which was
not enough of an edge to separate the two bots at all.

## What a run is

A route map per act with Run, Elite, Depot and Boss nodes. A district is three stretches
with a gate between each; **a gate is a scenery change and an escalation point, never a
verdict.** Nothing is healed there. One run-wide bar shows all fifteen stretches across
the three acts with act boundaries marked, so the player always knows where they are
and how far is left.

**Depth is the score.** "Reached the Foundry" is comparable, memorable and brag-able. A
six-figure point total is none of those, including to the player who earned it.

**Bosses are road-blocks, not health bars.** A unit sits across the road and takes the
same damage everything else does — cars taken on the line beside it — while the Wall
keeps closing. The old model damaged bosses only by banking, capped at a fifth of
integrity per cash-in, which made every fight exactly five cash-ins deep whatever you
were driving and threw away 97% of a good chain (measured: one chain swung 103,000 at a
12,000-point unit). One verb, one economy.

## The garage, and the rule that keeps it honest

> Anything permanent may change **what you can do** or **how many options you get**.
> Only six purchases change **how strong you are**, and the Wall's closing curve is
> authored against all six being owned.

That inversion is the fix. The old tree was fifteen percentage nodes, and it forced
`powerIndex()` into existence — a function whose only job was to scale difficulty back
up in proportion to what the player had bought. When a progression system needs an
anti-progression system, the axis is wrong, not the existence of progression. Measured,
the index grew 2.35× against income growth of 1.9×, so a maxed save failed districts a
fresh save cleared. Authoring against the ceiling instead means owning less makes the
game easier and there is nothing left to compensate for. `powerIndex()` is gone.

| Tier | Bounded? | Contents |
|---|---|---|
| **A — Power** | Six purchases, ~1.4× | Reinforced Frame ×3 (+1 mistake each), Heavy Bumper (+15u per car), Pre-Draft (open with a perk), Black Box (open each district plated) |
| **B — Choice** | Unbounded, zero inflation | Fourth perk card, one reroll per run, ban a perk from the pool for good, choose your starting city |
| **C — Access** | Unbounded | New tools in the draft pool, new cities by depth, coin and XP rate |
| **D — Cosmetic** | Unbounded | Six liveries, the rendered bay |

**Coins pay on depth, not score.** Score is superlinear in skill — measured, a god run
paid 156,000 against a casual 1,300, a 120× spread that no price ladder can serve at
both ends. Depth is bounded and roughly linear, so a great run pays about 2.5× a bad
one and "three more runs to the next unlock" is a promise the garage can keep.

## Perks

Eight levels, roughly one per stretch cleared, three cards each. Fifteen levels over a
five-minute run is a treadmill rather than a cadence — and measured, the old curve
delivered levels 2, 3 and 4 inside the same second, three perk screens back to back.

Every card does one of the only three useful things: **slow the Wall, shove harder per
car, or hold the pass open longer**. A card that multiplied a score would be talking
about a number nobody can lose to. Nine of them are weapons that grant a verb outright.

Events (boon + bane, chosen before you drive) wager the same three axes.

## Handling

Turn authority falls off with speed and drifting buys it back, so fast corners *require* the
slide. The slide itself is stabilised by a self-aligning torque that clamps the slip angle
to ~34° — without it a drift has no equilibrium and simply winds up into a spin, which made
the game unplayable in testing regardless of how good it looked.

Road width, top speed and camera zoom are tuned together so crossing the full street takes
about 0.9 seconds. An earlier build was at 0.4s, and no amount of skill made that readable.

## Records, and why there is no global board

CrazyGames does have a leaderboard, but it is a **server-to-server** API: scores are POSTed
to `leaderboard.crazygames.com` from your own backend, authenticated with a secret key. This
game is a single HTML file with no backend, and shipping that key inside the bundle would
hand it to anyone who opens devtools — so there is no global board here, and faking one would
be worse than not having it.

What there is instead is a board of your own ten best runs: score, district reached, cars
wrecked, and how long ago. It carries the "beat that" job on its own — the game-over screen
states your rank rather than only showing a best-ever badge you may never earn, and the run
you just finished is highlighted in the table so you can find yourself without counting.
Because CrazyGames syncs `localStorage` to a signed-in account, the board follows the player
across devices without any code.

`submitScore()` in `src/game.js` is the single seam a backend would plug into. If the SDK's
user module is present the player's portal username titles the board; everywhere else it
stays anonymous and nothing breaks.

## Monetization

| Placement | Trigger | Notes |
|---|---|---|
| Rewarded — Revive | On any run-ending failure, once per run | A player deep in a run they have invested perks in is the highest-intent moment the format has — far better than reviving a score chase. |
| Rewarded — 2× Coins | Game over | Coins pay on districts cleared as well as score, so the double-up has a visible target. |
| Interstitial (midgame) | Every 3rd run end | Within CrazyGames' frequency guidance without feeling hostile. |

`Ads` in `src/game.js` loads the CrazyGames SDK v3, awaits `SDK.init()`, and brackets play
with `gameplayStart`/`gameplayStop` so the portal never counts menu time as gameplay. The
session's *first* `gameplayStart` waits for the first steering input rather than for the
district to start running: on a zero-click start the road is already moving underneath the
onboarding hint, and the seconds spent reading that hint are not play. Every bracket after
it follows the play state directly. The
game is paused and the audio ducked *before* the ad request rather than on `adStarted`, so
an ad that opens instantly never gets a frame of game sound over it, and a watchdog resumes
play if an ad hangs without ever calling back. Off-platform every call degrades to a
simulated placement, so the flow stays demonstrable.

The portal's `settings.muteAudio` is honoured at init and through a change listener, and it
outranks the in-game sound button — while the site has muted the game the button is disabled
and cannot bring audio back, which is what their docs require.

**A revive has to undo the thing that killed you.** For a long time it did neither: the hull
was left on zero, so the next scrape ended the run again, and a missed quota put the player
back down *past* the checkpoint, which re-fired the same failure on the following frame — an
ad watched for nothing, which is the worst possible thing to sell. There are two kinds of
death and they need two different repairs. Hull is restored to 60%, and a district that ran
out of *road* rather than hull has its checkpoint pushed back by half its length, because
road is what you were short of. The extension can only ever lengthen the district, never
shorten it.

Banner ads are deliberately not wired. See [SUBMISSION.md](SUBMISSION.md).

## Levels

The addictive part of a roguelite is not the perk, it is the *cadence* of being handed a
choice. So there is a levelling track inside every run: **fifteen levels, three offers each,
drawn from a pool of fifty-eight.** No run sees the same board twice and two runs diverge
inside the first district.

XP comes off the things you were already doing — one per wreck (through *every* kill path,
weapons included), five per hauler, a lump per district cleared, and a slice of every bank —
so a level-up always reads as the reward for the last thirty seconds rather than for a menu
you walked through. The first level costs 26 XP so the first perk card lands ~20 seconds
into a first run; the curve totals ~1,180, which is roughly a full three-act run: capping is
an achievement, not a formality. Elites genuinely pay double XP, and **overtime** (below)
pays half again.

Perks are weighted deliberately toward the *toys* rather than the base numbers. "+9% top
speed" is a stat line; "your wrecking ball lasts two and a half times as long", "arc
lightning jumps two extra cars", "every district starts with escort drones" change what the
run *is*. Rarity odds shift with level, so late choices feel like the reward for having got
there — commons dominate before level 6 and rares are 38% of the table past level 11.

They stack live: taking a perk rebuilds the modifier table mid-district and relinks it to the
car, so a hull perk pays out the instant you take it rather than at the next brief.

| Layer | Lives for | Chosen |
|---|---|---|
| Perk | the run | On level-up, three at a time, fifty-eight in the pool |
| Contract | one district | Before you drive it |
| Hardware | forever | Bought in the garage |
| Crew rank | forever | Trained in the garage, fifteen ranks over three doctrines |

## Overtime

Meeting the quota used to clear the district on the spot — measured with a steering bot, a
skilled district was over at 32–40% of the road, so the better you played the less game you
got. The district is now *won* at the quota and *runs to the checkpoint* in overtime:
banking keeps paying, XP runs ×1.5, and a wreck in overtime is a limp to the checkpoint at
35% hull rather than a lost run. The back half of the road, which the best players never
used to see, is now exactly where the level-ups come from.

Dying mid-chain also salvages 40% of the pending bank. Chains run twenty seconds or more,
so at the moment of death an entire district's earnings used to be pending — measured,
nine of twenty deaths banked exactly zero, which starved the garage of the coins that make
the next run feel worth starting.

## Takedowns, and a road worth reading

Pursuit used to be the one thing on the road that was pure downside — invulnerable, in a
game whose thesis is that everything on the road is ammunition. Units now carry three
armour pips: ram them while boosted or plated, or catch them with the ball, a shockwave, a
blast or a slick. A takedown pays a chain link, 120 garage coins on the spot, and vents
0.6 heat — hunting the hunters trades income (the heat payout multiplier) for breathing
room, which is a real decision rather than a free lunch.

Traffic itself now has three special archetypes worth *choosing*: **tankers** whose payload
cooks off a beat after you crack them — free positional AoE; **armored cars** that bounce a
cruising bump exactly like a hauler and burst with coins when cracked properly; and at Heat
2+, **kamikaze bikes** that hunt the player and pay double if wrecked first.

## The Loop

Every act-3-or-later boss clear offers a choice: cash out a finished city, or arm **THE
LOOP** and keep driving. Acts keep climbing — a fourth storm-front theme (The Causeway)
enters the rotation, quotas keep compounding, bosses keep cycling with fatter integrity —
until the hull gives out. The ceiling is the player, and the board records how deep the
loop went.

## The garage

A roguelite that only resets is a roguelike. The garage is the other half of the contract:
it sits *between* runs rather than off to one side, so a run that ended badly still paid for
something you keep, and the next attempt starts further along. Every path into a run goes
through it — the menu's Start Run, the game-over screen's primary action, and Enter.

**One car.** Four selectable chassis were four stat rolls saying what the tuning tracks
already said — a choice between numbers rather than between ways to play, and it forced the
tuning tracks to stay weak so the chassis choice still mattered. Removing it cost nothing
that Engine and Impact do not now carry, and the silhouettes stay in the game as the traffic
and pursuit pool.

Two tiers of spend: **tuning** (six tracks, five levels each, stated in units rather than
pips — 371 km/h, 164 hp) and **hardware**, bought once, fitted forever, each changing a verb
rather than a number.

**It is a bay, not a form.** The left half is a rendered deck — poured plates, oil, work
lights, hazard chevrons, tyre marks leading out — with your actual car on it wearing every
part you have bought. The ram bar sits across the nose, the harpoon tubes run down the roof,
the welder bottle is strapped to the boot. Buying a part changes the picture, which is the
only reason to have a picture at all. Everything is drawn at runtime, like the rest of the
game; there is still not a single image file.

The right half is the work order, and the action bar is pinned above both. The first version
of this screen put **Roll out** at the bottom of a 1,300px scroll, behind everything you
might buy; now the way out and the balance you are spending never move. Anything out of
reach states the shortfall as a number rather than just dimming.

| Hardware | Cost | What it does |
|---|---|---|
| Ram Prow | 2,400 | Wrecks pay +25% and cost a fifth less hull. |
| Scrap Welder | 4,200 | Hull repairs itself whenever no chain is running. |
| Turbine Intake | 7,000 | Grabbing a Boost adds two links to a live chain. |
| Harpoon Rack | 9,000 | Auto-fires every 9s: detonates the nearest car ahead, free. |
| Shock Plating | 14,000 | Every fifth link in a chain detonates everything around you. |
| Black Box | 22,000 | Start every district with a Ram Plate already fitted. |

Prices were re-laddered against a *capped* coin economy. Coins used to track raw score,
which is superlinear in skill: a god run paid 156,000 while a casual one paid 1,300, so any
price tuned for one starved the other. The score term is now capped and the floor comes
from wrecks and districts cleared — a casual run pays much what it always did, a god run
pays an eighth, and the worst-case grind for any single item is four to six runs with the
daily drop closing the gap.

**The Crew** is the garage's third tier and its long sink: fifteen permanent nodes (twenty
ranks) across three doctrines — Offense (wreck pay, First Blood, Opening Salvo, wider blasts, boss
damage), Defense (hull, cheaper walls, faster heat decay under pressure, one survived
crash per run) and Greed (coins, XP, the daily drop, heat payout, starting at level 2).
~150,000 coins to finish. Every rank is felt in-run, and the quota index counts crew ranks
so training never makes the road free. **The Paint shop** sells six liveries; body, glow
and light-ribbon all read their colour from the fitted livery.

**Meta-progression must never be a tax.** Measured head-to-head with an identical bot, the
old quota index made a fully-tuned save *fail* districts a fresh save cleared — the index
grew 2.35× against income growth of ~1.9×. The per-level and per-gear coefficients were
halved; the index now tops out ~1.7× and an upgrade is always a net gain.

The Harpoon deliberately has no fire button. An active weapon would put back exactly the
kind of control the rest of this pass took out, and a top-down auto-cannon reads as
generous rather than passive — you still choose the line that puts a car in front of it.

**The first run is not empty.** A new player used to land in the garage with no coins,
nothing to buy and a bare car — the weakest possible first impression, given to everyone.
The Ram Prow is now free on the first Play. It costs the economy almost nothing and it means
the opening minute shows the game doing the thing the game is about.

**The daily drop** is the reason to open the tab tomorrow: 900 coins on day one, climbing to
6,300 on a seven-day streak and plateauing there, because an unbounded ramp only rewards the
player who was never going to quit. It pays on the calendar day rather than a rolling 24-hour
timer, so the claim never drifts later and later, and the streak survives a missed day —
punishing a single miss is how you lose the player who was going to come back on Wednesday.

Coins, tuning and hardware persist across runs; the perk build inside a run does not.
The roguelite layer resets, the garage layer does not.

## Audio

Fully synthesised, no files. A four-layer synthwave bed over an i–VI–III–VII vamp at 126 BPM,
whose *arrangement* is the intensity dial: the tune, the bass line and the arpeggio carry it,
and escalation opens the filter and brings in the pad.

**The kit sits well back.** A kick on every quarter with eighth-note hats over it is a drum
machine playing at you for the length of a run. The kick is on 1 and 3 only, hats do not
appear until Heat 2 and then only on quarters, and every drum voice is mixed roughly half
what it was. An earlier attempt replaced the whole bed with an ambient score, which was the
wrong lesson entirely — the tune was never the problem, the drumming was.

**The car is a distant electric drivetrain with its own switch.** Two detuned triangles
54 Hz idling to about 150 Hz flat out, a quiet inverter partial, a sine hum underneath and
slight vibrato, under a lowpass that never opens past ~530 Hz. At full speed the 2–5 kHz band
measures 72 dB below the low band. It is the one voice playing without pause for an entire
run, so it gets a dedicated toggle: engine off measures exactly zero with the music
unchanged.

**Impacts are weight, not brightness.** The wreck sound was band-passed noise from 1.8 kHz
plus a square wave through a 900 Hz high-pass — a square's odd harmonics with the body
stripped out, which is buzz and nothing else, on the most frequent event in the game. It is
now a lowpass sweeping 1.1 kHz down to 180, a sine thump falling to 32 Hz, and two detuned
triangles low in the midrange for sheet metal. Measured: 40 dB of rolloff from the body of
the hit to the 4–14 kHz band.

The remaining voices are tyre squeal (band-passed noise following slip), a two-tone siren
driven by an LFO, and one-shots for banking, threads, pickups, perk picks, curses and boss
stingers.

## Art direction

Committed single-theme — this is an arcade screen, not a document, so it does not follow the
viewer's light/dark preference.

| Token | Value | Role |
|---|---|---|
| Void | `#05060E` | Ground. Near-black, biased blue. |
| Asphalt | `#131A2C` | Road surface. |
| Cyan | `#3DE8FF` | Primary accent — player, left barrier, UI. |
| Magenta | `#FF2E88` | Secondary — combo, right barrier, city glow. |
| Red | `#FF3355` | Pursuit, curses, danger. Semantic only. |
| Amber | `#FFB13D` | Coins, nitro, rewarded offers. Semantic only. |
| Ice | `#C6D2E8` | Text. Blue-biased grey, never pure. |

Rarity has its own fixed encoding — cyan common, magenta uncommon, amber rare, red
overclocked — used identically on perk cards and the in-run build rail.

No webfonts: the CSP on the hosted build blocks font CDNs and a silent fallback would wreck
the HUD grid, so the stack is system-native with weight and tracking doing the work.

## Mobile

Portrait and landscape both play. The stage fills whatever viewport it is given; UI sizing
derives from the narrow axis in portrait, and camera zoom is bounded by width as well as
height so the full street is always framed — at the cost of a smaller car, which is the
right trade for a top-down game held upright.

Input is a gesture layer rather than on-screen buttons. Pads require aiming at a target
while your attention is on the road — in a game where steering is a continuous input and a
drift has to be held for seconds at a time, that is the wrong demand. The first touch
becomes a virtual stick wherever it lands: sideways steers (analogue, which the keyboard
cannot give), pulling back is the handbrake, releasing forward banks, and a second contact
anywhere is nitro.

Three details make it survivable in practice.

The anchor trails the thumb, so the stick never saturates somewhere you cannot reach.

**Travel and response curve matter more than anything else.** The first version put full
lock at 13% of screen width — about 50px on a phone — with a linear response, so the gap
between a lane change and full opposite lock was a thumb twitch and holding a line was
guesswork. Full lock is now at 26% of width (about 100px), with a 7% deadzone and a squared
response: 32px of thumb gives 12% of steering, and full lock is still there at the end of
the travel. Driving the game entirely through the touch layer, a plain proportional
controller now holds the centre line to about 10% of the road width at top speed and never
leaves the road.

And the stick draws itself the moment you touch: a target-free control you cannot see is a
control you cannot learn. A ring marks the anchor, a dot follows the thumb, and a separate
tick shows what the car is actually being given — after the response curve those are not
the same place, and hiding that would make the curve feel like lag.

On a phone the primary fail state should stay "missed the quota", not "fumbled a control".
The pad layout is retained behind a menu toggle for anyone who prefers it.

## Performance

The renderer is fill-rate bound — the bloom composite costs in direct proportion to
backing-store pixels — so framerate tracks window *area* almost exactly. Measured on one
machine:

| Backing store | FPS |
|---|---|
| 0.92 MP (1280×720) | 58 |
| 2.07 MP (1920×1080) | 40 |
| 3.69 MP (2560×1440) | 20 |

The standalone build fills the whole browser window, so a maximised 1440p or Retina display
renders three to four times the pixels a 720p one does. A fixed resolution cap is wrong on
most machines, so the backing store is instead scaled adaptively to hold the frame budget,
and CSS scales the result back up. Resolution is the first lever because it is continuous
and nearly invisible; dropping effects is the last resort, once there is no resolution left
to give.

It comes down in proportion to how far off budget it is, not in a fixed step. Cost goes
with area, so the scale that would hit the target is about sqrt(target/actual) — a machine
at 12fps reaches a holdable scale in one correction rather than four, which matters because
those four corrections were about five seconds of visible chop and they were the first five
seconds the player ever saw. Overshooting downward is cheap: the climb back is gentle and
continuous, and only runs when there is measured headroom.

Two signals drive it, because neither alone works. Frame delta says whether we are missing
the target, but it is clamped by vsync — on a 60Hz display a perfect frame still reads
16.7ms, so it can never indicate headroom, and a renderer that had dropped resolution could
never earn it back. Work time — what is actually spent in step plus render — is
vsync-independent and is what says it is safe to give resolution back.

All UI is DOM rather than canvas, so menus, the HUD and the perk cards stay pixel-sharp
regardless of render scale. Only the game world softens.

## Scope of this prototype

Built: full drift model with self-aligning torque, procedural districts, quota and boss
objectives, three boss archetypes with distinct mechanics, 58 perks and 6 curses with a
level-weighted offer, traffic and pursuit AI, spike-strip hazards, off-screen threat indicators,
particles and decals, bloom pipeline with adaptive quality, synthesised music and SFX,
garage with four cars and four upgrade tracks, localStorage persistence, and a
responsive layout with keyboard and touch input.

Not built: leaderboards, daily rewards, a tutorial, and banner ads. The SDK integration is
verified against a mock covering every call and callback, but has not run against the real
SDK — that needs one pass on their platform.
