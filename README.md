# NEON HEAT

A drift **roguelite** for web distribution. Climb a ladder of city districts, each demanding
a points quota banked before the checkpoint. Clear one and you fit a chip from three. Every
third district is a named pursuit unit with its own mechanic.

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
| <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or <kbd>A</kbd> <kbd>D</kbd> | Steer |
| <kbd>Space</kbd> or <kbd>S</kbd> | Drift — hold to accrue, release to bank |
| <kbd>Shift</kbd> or <kbd>W</kbd> | Nitro |
| <kbd>Enter</kbd> | Start run / leave a district brief |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Pick a chip at the draft |
| <kbd>M</kbd> / <kbd>Esc</kbd> | Mute / back to menu |

## Mobile

Plays in portrait and landscape on a phone. The stage fills the viewport rather than
letterboxing to 16:9 — a hard aspect lock turned a 390&times;844 phone into a 390&times;219 strip
using a quarter of the screen.

- Four on-screen pads (steer left/right, nitro, drift) with a 60px minimum target, appearing
  only while driving so they never sit over the menus or the draft cards.
- The HUD rails stack in portrait, the draft becomes a single column, and keyboard hints are
  hidden on touch devices.
- `--u`, the unit every UI size derives from, is taken from the narrow axis in portrait;
  camera zoom is bounded by width as well as height so the full street always fits.
- Rendering demotes itself on slower hardware, which on a phone means dropping to device
  pixel ratio 1 and skipping the wide bloom tap.

Turn authority drops as you go faster and drifting buys it back, so fast corners *require*
the slide. A self-aligning torque clamps the slip angle so a slide holds an angle instead of
winding up into a spin — that pair is the whole handling model.

Points accrue into a *pending* bank while you hold the drift and only pay out when you
release. Wreck while holding a fat bank and it is gone.

## Layout

```
index.html        development shell (source of truth for markup)
src/style.css     all UI — HUD, briefs, draft, garage, ad overlay
src/audio.js      synthesised music bed and SFX, no audio files
src/chips.js      chips, curses and the weighted draft; pure data + a modifier table
src/game.js       engine: physics, districts, bosses, AI, renderer, post FX, meta
build.mjs         inlines the above into dist/
dist/index.html   self-contained single file — this is what you zip for CrazyGames
dist/mockup.html  body fragment for publishing as a shareable page
DESIGN.md         concept, monetization, art direction
```

```
node build.mjs
```

## Notes for integration

`Ads` in `src/game.js` calls `window.CrazyGames.SDK` when the game is hosted there and
falls back to a simulated placement otherwise, so the full monetization flow is
demonstrable standalone. Three rewarded placements and one interstitial are wired; see
DESIGN.md for the frequency rules.

Rendering demotes itself: sustained slow frames drop the wide bloom tap, window detail,
grain and device pixel ratio in one step. Audio starts on the first key or pointer press, as
browsers require.

`window.__NH` exposes game state, `QF` (quality flags), `setQuality()` and the district
lifecycle (`nextDistrict`, `beginDistrict`, `takeOffer`) for tuning and automated playtests.
Balance was validated by driving the real input path with an in-page steering controller
rather than by eye.

## Not built yet

Leaderboards, daily rewards, a tutorial, and the real SDK handshake (currently shimmed).
