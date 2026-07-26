# NEON HEAT

A top-down arcade drift game for web distribution. Hold the slide to build a combo,
straighten up to bank it, and outrun the police heat your own greed summons.

**80 KB total. Zero image assets.** Every pixel — the car, the city, the road, the light —
is generated at runtime. See [DESIGN.md](DESIGN.md) for why that is the central constraint
rather than a limitation, plus the monetization plan.

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
| <kbd>Enter</kbd> / <kbd>Esc</kbd> | Start run / back to menu |

Touch controls appear automatically on devices without hover.

Turn authority drops as you go faster and drifting buys it back, so fast corners *require*
the slide. That asymmetry is the whole handling model.

## Layout

```
index.html        development shell (source of truth for markup)
src/style.css     all UI — HUD, menus, garage, ad overlay
src/game.js       engine: physics, track gen, AI, particles, renderer, post FX, meta
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
grain and device pixel ratio in one step. `window.__NH` exposes game state, `QF` (quality
flags) and `setQuality()` for tuning and automated playtests.

## Not built yet

Audio, leaderboards, daily rewards, and the real SDK handshake (currently shimmed).
