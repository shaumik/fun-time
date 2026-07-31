# NEON HEAT

A demolition-drift **roguelite** for web distribution. Drift to charge a multiplier, ram
traffic to cash it in, and pay for it out of a hull bar that only ever gets thinner. Pick a
route through a branching board of city districts, pick an event that pairs a boon with a
bane before each one, and bank a quota under those terms. Wrecks and clears pay XP; every
level hands you a perk from three, fifteen levels deep out of a pool of fifty-eight — nine
of which are weapons that fire on their own rather than multiplying a number.
Three acts — The Grid, the Sunken Docks and the Undercity — built out of twelve **zones**,
four per act. A zone owns the ground under the car, what stands beside it, what passes over
it and one rule the road plays by, and a district is three of them in a row with a
checkpoint between each. Every act ends in a named pursuit unit that fights in three
phases.

**Around 130 KB total. Zero asset files — no images, no audio.** Every pixel and every note is
generated at runtime. See [DESIGN.md](DESIGN.md) for why that is the central constraint
rather than a limitation, plus the ladder design and monetization plan.

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

**Traffic is ammunition, not obstacle.** Every wreck adds a link to the chain, resets a
~3.2s clock and pays at the multiplier the chain has already earned. Let the clock hit zero
and everything banks automatically; wreck your hull first and it is gone. Threading a gap
pays thin but puts time back on the clock, so a thin hull changes how you drive rather than
ending you.

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

**Meet the quota and the district goes into overtime** — the road runs to the checkpoint at
×1.5 XP, and a wreck in overtime limps home instead of ending the run. Clearing act 3
offers **THE LOOP**: keep driving an endless ladder through a fourth storm-front city.

**The garage sits between runs**, and it is a bay rather than a form: a rendered deck with
your car on it, wearing every part you have bolted on — in the garage and on the road
alike. Coins earned by a failed run buy tuning across six tracks, permanent hardware — a
harpoon that auto-fires, plating that detonates every fifth link, a welder that repairs you
between chains — plus a fifteen-rank **Crew** skill tree and a six-livery paint shop that
recolors the car and its light trail. See [DESIGN.md](DESIGN.md).

**Districts are three stretches, not one road.** Each district draws three zones and runs
you through them in order, with a gate between each: a share of the quota you must have
banked by the time you reach it, or the district ends there. Clearing a gate welds hull
back on, puts more traffic on the road, raises the heat and raises what the next stretch
pays — a third of the quota by the first gate is worth ×1.00, the last stretch ×1.32. The
district no longer ends the instant the number is met; banking past it buys overtime, and
overtime pays coins and XP at the line.

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
stated up front). Risk on the event buys XP — half again at risk 1, double at risk 2 — and
XP is the only progression track inside a run. Quotas scale with how strong you actually
are (garage tuning, hardware, run level), so an upgrade always makes the road easier
without ever making it free.

**Pursuit units fight in phases.** Banking is still the only weapon, but no single cash-in
can take more than a fifth of a unit's integrity — a level-fifteen build used to hold
twenty thousand pending and end an act boss on the first bank. Five cash-ins is the floor
whatever you are driving, and the overflow is not thrown away, it banks as score. At two
thirds and one third it breaks off, does the one thing it is for — the WARDEN salts the
road behind it, the SIREN re-tunes to a lower hoarding ceiling, the REAPER calls in more
units — and comes back on a shorter fuse. See [DESIGN.md](DESIGN.md).

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
dist/mockup.html  body fragment for publishing as a shareable page
dist/neon-heat.zip  the CrazyGames upload
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
`gameplayStart`/`gameplayStop`, and pauses and mutes the game around every ad. Off-platform
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
