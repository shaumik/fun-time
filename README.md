# NEON HEAT

A demolition-drift **roguelite** for web distribution. Drift to charge a multiplier, ram
traffic to cash it in, and pay for it out of a hull bar that only ever gets thinner. Pick a
route through a branching board of city districts, sign a contract that pairs a boon with a
bane before each one, bank a quota under those terms, and draft a chip on the way out.
Three acts — The Grid, the Sunken Docks and the Undercity, each with its own palette,
skyline and air — every one ending in a named pursuit unit.

**128 KB total. Zero asset files — no images, no audio.** Every pixel and every note is
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
| <kbd>1</kbd>–<kbd>4</kbd> | Pick a chip at the draft |
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

- The HUD rails stack in portrait, the draft becomes a single column, and keyboard hints are
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

**Power-ups** sit in the traffic lanes and fire the moment you touch them — Boost, Repair,
Ram Plate (free wrecks), and Surge, which stops the clock.

**The garage sits between runs**, and it is a bay rather than a form: a rendered deck with
your car on it, wearing every part you have bolted on. Coins earned by a failed run buy
tuning across six tracks and permanent hardware — a harpoon that auto-fires, plating that
detonates every fifth link, a welder that repairs you between chains. See
[DESIGN.md](DESIGN.md).

**Run structure.** A route map per act with Run, Elite, Depot and Boss nodes; a contract
chosen before every district (boon + bane, stated up front); a chip drafted after. Risk on
the contract sets the quality of the draft. See [DESIGN.md](DESIGN.md).

## Layout

```
index.html        development shell (source of truth for markup)
SUBMISSION.md     build, upload, store copy, requirements checklist
src/style.css     all UI — HUD, briefs, draft, garage, ad overlay
src/audio.js      synthesised music bed and SFX, no audio files
src/chips.js      chips, curses and the weighted draft; pure data + a modifier table
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
