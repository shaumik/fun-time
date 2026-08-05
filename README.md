# NEON HEAT

A demolition-drift **roguelite** for web distribution, played with one axis.

**Something is behind you and it never stops closing. Wrecking traffic is the only
thing that pushes it back. How far do you get?**

That is the whole objective, and it is on screen from the first second. The Wall
closes at a fixed rate in world units per second — independent of your speed, so it
is a clock wearing a costume rather than a race you could win with a throttle you do
not have. Every car you wreck shoves it back. A car taken on its own is worth 95m; the
fourth car of a single pass is worth 460m, because pushback escalates *within a pass*
and resets when you stop hitting things.

So the question every few seconds is **which line takes the most cars**, and that —
road-reading under pressure — is the skill the game trains and the only one it asks
for.

Traffic arrives in readable finite **formations**: line-abreast, echelon, column,
wedge. Nothing spawns behind you, and a formation you misread is gone. Holding
station needs about 290m of pushback per formation, so one car cannot cover it, two
bleeds slowly and three gains ground.

**Mistakes are a budget of five, and wrecking costs none of them.** A barrier, a
pursuit unit or an armoured van you should have gone around costs exactly one. There
is one way to get one back — the Repair pickup — so a run has a slope, and the eighth
stretch is genuinely more dangerous than the first because you arrive holding what
you have left.

Three acts — The Grid, the Sunken Docks and the Undercity — built out of twelve
**zones**, four per act, three to a district with a scenery-and-escalation gate
between each. Every act ends in a named pursuit unit that blocks the road while the
Wall keeps closing.

**Depth is the score.** "Reached the Foundry" is comparable and brag-able; a
six-figure point total is not. Points still accumulate, underneath.

**Around 129 KB total. Zero asset files — no images, no audio.** Every pixel and every
note is generated at runtime. See [DESIGN.md](DESIGN.md) for the art constraint and
[REVAMP.md](REVAMP.md) for why the quota model was replaced.

## Play

```
npx serve .          # or any static server
open http://localhost:3000
```

Opening `index.html` over `file://` also works; only `localStorage` degrades (saves fall
back to in-memory for the session).

| Input | Action |
|---|---|
| <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or <kbd>A</kbd> <kbd>D</kbd> | Steer — the whole control surface |
| <kbd>Enter</kbd> | Garage / start run / leave a district brief |
| <kbd>1</kbd>–<kbd>3</kbd> | Pick a perk on level-up |
| <kbd>M</kbd> / <kbd>Esc</kbd> | Mute / back to menu |

The menu also carries an **Engine** toggle: the car is the one voice you hear without pause
for a whole run, so silencing it must not cost you the music.

## Mobile

Plays in portrait and landscape on a phone. The stage fills the viewport rather than
letterboxing to 16:9 — a hard aspect lock turned a 390&times;844 phone into a 390&times;219 strip
using a quarter of the screen.

**Controls are gesture-based, not pads.** Fixed buttons ask you to hit a target while your
eyes are on the road, which is the wrong demand on a phone. Instead the first finger down
becomes a virtual stick wherever it lands:

Drag sideways to steer. That is the entire input — the handbrake and the nitro pull are
both gone, so the stick carries one axis and there is nothing to aim at.

Full lock sits at 26% of screen width (~100px on a phone) with a small deadzone and a
squared response, so small thumb movements barely turn and holding a line is possible; an
earlier 50px linear stick made the difference between a lane change and full lock a twitch.
The anchor trails your thumb so it never saturates out of reach, a ring shows where it
anchored, and a tick shows what the car is actually being given. A two-pad layout is still
there behind a **Controls** toggle on the menu.

**The car reverses itself.** Hit a rail square and it backs out after a moment and turns to
face down the road — there is no reverse control to add in a game with one axis.

- The HUD rails stack in portrait, the perk cards become a single column, and keyboard hints are
  hidden on touch devices.
- `--u`, the unit every UI size derives from, is taken from the narrow axis in portrait;
  camera zoom is bounded by width as well as height so the full street always fits.
- Rendering demotes itself on slower hardware, which on a phone means dropping to device
  pixel ratio 1 and skipping the wide bloom tap.

The slide is automatic: lean hard on the wheel above 420 and the tail comes round on its
own, held at a stable angle by a self-aligning torque rather than winding up into a spin.
You provoke the drift, you no longer operate it.

**Traffic is ammunition, not obstacle.** Every wreck pushes the Wall back and opens or
extends a pass. Threading a gap pays thin but holds the pass open, which is how you carry a
four-car line through a formation that only had three cars in it.

**The convoy.** A quarter of the way into every district, three armoured haulers are
announced and run in formation. They outpace ordinary traffic so catching them means
committing; their armour bounces a bump at cruising pace, so cracking one needs Boost, a
Surge or real speed; and they leave if you dawdle. Taking all three pays a bonus worth a
quarter of the district's quota.

**Power-ups** sit in the traffic lanes and fire the moment you touch them: Boost, Repair,
Ram Plate (free wrecks), Surge (stops the clock), Magnet (traffic steers onto your line),
Bazooka (four auto-fired rockets) and Frenzy (double pay). Two more — Reinforced and
Overclock — last until the end of the district rather than a few seconds, and are rare.

**Pursuit is ammunition too.** Police carry three armour pips — ram them boosted or plated,
or catch them with a weapon — and a takedown pays coins on the spot and vents heat. The
road also deals exploding tankers, armored coin couriers, and (at high heat) kamikaze bikes
that hunt you.

**There is one fail state and it is the Wall.** No quota, no checkpoint verdict, no
overtime. Clearing act 3 offers **THE LOOP**: keep driving an endless ladder through a
fourth storm-front city.

**The garage sits between runs**, and it is a bay rather than a form: a rendered deck with
your car on it, wearing every part you have bolted on. It is built on one rule:

> Anything permanent may change **what you can do** or **how many options you get**. Only
> six purchases change **how strong you are**, and the Wall's closing curve is authored
> against all six being owned.

That inversion is why `powerIndex()` — a function whose entire job was to scale difficulty
back up in proportion to what the player had bought — is gone. Tier A is power (six
purchases, capped). Tier B is choice: a fourth perk card, a reroll, a permanent perk ban,
your starting city. Tier C is access: new tools, new places. Tier D is paint. Coins pay on
**depth**, not score, because score was a 120× spread that no price ladder could serve.

**Districts are three stretches, not one road.** Each district draws three zones and runs
you through them in order, with a gate between each. A gate is escalation and a change of
scenery — never a verdict. Nothing is healed there: the run's downward slope is the point.

**Zones are places, not palettes.** Neon Blocks, Sodium Row, The Skyway, Glasshouse, The
Wharf, The Spillway, Rail Yard, Cannery Row, The Undercity, Underpass 9, Foundry Line and
The Catacombs. Each one changes the floor treatment (lattice, standing water, live rails,
blown dust, or nothing at all under an elevated deck), how the road is edged (neon rail,
bollards, chain-link, poured concrete, an unfenced quay), what is built beside it (towers,
sheds, container stacks, support pylons), what crosses overhead (signage, service gantries,
tunnel ribs), and how hard the road bends. Most carry a rule as well — the sealed tube kills
the lights and doubles what threading pays, the pour floor cooks every wreck — and it
applies while you are in that stretch, not for the whole district.

**Run structure.** A route map per act with Run, Elite, Depot and Boss nodes, each node
naming the three zones it is made of; an event chosen before every district (boon + bane,
stated up front). Events now wager the three things that matter: how fast the Wall closes,
how far each car shoves it, and how long a pass stays open. Eight perk levels, roughly one
per stretch cleared.

A single run-wide bar shows all fifteen stretches across the three acts, with act
boundaries marked, so you always know where you are and how far is left.

**Pursuit units are road-blocks, not health bars.** A unit sits across the road and takes
the same damage everything else does — cars taken on the line beside it — while the Wall
keeps closing. One verb, one economy. At two thirds and one third it breaks off, does the
one thing it is for, and comes back on a shorter fuse. See [DESIGN.md](DESIGN.md).

## Layout

```
index.html        development shell (source of truth for markup)
SUBMISSION.md     build, upload, store copy, requirements checklist
src/style.css     all UI — HUD, briefs, perks, garage, ad overlay
src/audio.js      synthesised music bed and SFX, no audio files
src/chips.js      perks, curses and events; pure data + one flat modifier table
src/game.js       engine: physics, districts, bosses, AI, renderer, post FX, meta
build.mjs         inlines the above into dist/
dist/index.html   self-contained single file — this is what you zip for CrazyGames
dist/neon-heat.zip  the CrazyGames upload
dist/standalone/  the same game with no portal SDK, for self-hosting / itch.io
press/            1920x1080 store screenshots, generated from the game
DESIGN.md         concept, monetization, art direction
```

```
node build.mjs
```

## Notes for integration

**To submit to CrazyGames, see [SUBMISSION.md](SUBMISSION.md).** `npm run build` produces
`dist/neon-heat.zip` — that is the upload.

`Ads` in `src/game.js` loads the CrazyGames SDK v3, awaits `init()`, brackets play with
`gameplayStart`/`gameplayStop` — the first one held back until the player actually steers —
and pauses and mutes the game around every ad. Off-platform
each call degrades to a simulated placement so the flow stays demonstrable. Two rewarded
placements and one midgame interstitial are wired; banners are not.

**Performance is adaptive.** The renderer is fill-rate bound, so framerate tracks window
area — a maximised 1440p window is ~4x the pixels of a 720p one. The backing store scales
itself continuously to hold ~60fps and CSS scales it back up; effects are only dropped once
there is no resolution left to give. All UI is DOM, so menus and the HUD stay sharp
regardless. Audio starts on the first key or pointer press, as browsers require.

`window.__NH` exposes game state, `QF` (quality flags), `setQuality()` and the district
lifecycle (`nextDistrict`, `beginDistrict`, `takeOffer`) for tuning and automated playtests.
Balance was validated by driving the real input path with an in-page steering controller
rather than by eye.

## Not built yet

Leaderboards, daily rewards, a tutorial, and banner ads. The SDK integration is verified
against a mock covering every call and callback, but has not run against the real SDK.
