# NEON HEAT — design & monetization brief

**One line:** A drift roguelite. Climb a ladder of city districts, each demanding a points
quota banked before the checkpoint; clear one and you fit a chip from three; every third
district is a named pursuit unit with its own mechanic.

---

## Why this concept

**The genre problem first.** A top-down drift game that is only score-attack has no reason
to exist next to the hundred already on the platform. Polish alone does not differentiate —
it has to be a different *kind* of game. The roguelite ladder is what makes it one, and it
solves a concrete design failure at the same time: without a quota, nothing forces the
player to drift, so the safe line is the boring line and the whole game is optional. The
quota makes the risk mandatory.

**The art constraint second.** Hand-drawn sprites made without an illustrator are the most
common reason a self-published web game looks cheap. So there are no image files, and no
audio files either. Everything is generated at runtime, and the polish comes from a
rendering pipeline and a synthesiser rather than from assets. Nothing can look or sound
amateur because there is nothing authored to be bad.

**The platform third.** Driving is CrazyGames' strongest evergreen category behind .io, and
unlike .io it needs no servers and no concurrency floor to feel alive.

## The run

```
menu → district brief → drive (quota or boss) → clear → draft 1 of 3 chips → next district
                             │                                                    │
                             └── fail (wreck / miss quota / boss escapes) → game over
```

**Districts** get longer, hungrier and hotter. Quota grows 1.38× per district while the
player's build grows through chips — the two curves are meant to stay close, so a run ends
when the build stops keeping up rather than at a fixed wall.

**The bet.** Drift points accrue into a *pending* bank that only pays out when you release
the drift. Wreck while holding a fat bank and it is gone. Tying the payout to the button
rather than to the physics settling is what makes the wager legible: you choose when to
cash in.

**Heat** rises with every bank. Each tier adds a pursuit unit and multiplies every payout,
so the correct play is always slightly more dangerous than the comfortable one.

**Chips.** Seventeen across four tags (Engine, Chain, Combo, Heat, Risk, Defence), stacking
up to three deep. Effects are declarative — every chip writes into one flat modifier table
the physics and scoring read each frame — so builds stack and interact without special
cases anywhere in the engine.

**Overclocked offers** pair a stronger chip with a permanent curse: narrower streets,
heavier traffic, a hotter start, brittle chains, a dry nitro tank, a tighter camera. At most
one per draft, never on district 1, and the cost is always stated on the card. A hidden cost
is not a choice.

**Bosses** every third district, damaged only by *banking* into them — the fight runs on the
game's own verb rather than bolting on a new one.

| Unit | Division | Mechanic |
|---|---|---|
| WARDEN | Heavy Interdiction | Telegraphed charges; salts the road behind it with spike strips. |
| SIREN | Signals | Pulses every 7s, wiping any bank over 2,400. Punishes hoarding, not playing. |
| REAPER | Pursuit Special | Faster than you, and it brings two escorts. |

## Handling

Turn authority falls off with speed and drifting buys it back, so fast corners *require* the
slide. The slide itself is stabilised by a self-aligning torque that clamps the slip angle
to ~34° — without it a drift has no equilibrium and simply winds up into a spin, which made
the game unplayable in testing regardless of how good it looked.

Road width, top speed and camera zoom are tuned together so crossing the full street takes
about 0.9 seconds. An earlier build was at 0.4s, and no amount of skill made that readable.

## Monetization

| Placement | Trigger | Notes |
|---|---|---|
| Rewarded — Revive | On wreck, once per run | A player deep in a run they have invested chips in is the highest-intent moment the format has — far better than reviving a score chase. |
| Rewarded — 2× Coins | Game over | Coins pay on districts cleared as well as score, so the double-up has a visible target. |
| Interstitial (midgame) | Every 3rd run end | Within CrazyGames' frequency guidance without feeling hostile. |

`Ads` in `src/game.js` loads the CrazyGames SDK v3, awaits `SDK.init()`, and brackets play
with `gameplayStart`/`gameplayStop` so the portal never counts menu time as gameplay. The
game is paused and the audio ducked *before* the ad request rather than on `adStarted`, so
an ad that opens instantly never gets a frame of game sound over it, and a watchdog resumes
play if an ad hangs without ever calling back. Off-platform every call degrades to a
simulated placement, so the flow stays demonstrable.

The portal's `settings.muteAudio` is honoured at init and through a change listener, and it
outranks the in-game sound button — while the site has muted the game the button is disabled
and cannot bring audio back, which is what their docs require.

Banner ads are deliberately not wired. See [SUBMISSION.md](SUBMISSION.md).

Meta progression (coins, cars, four upgrade tracks) persists across runs and is separate
from the per-run chip build — the roguelite layer resets, the garage layer does not.

## Audio

Fully synthesised, no files. A four-layer synthwave bed over an i–VI–III–VII vamp at 126 BPM,
whose *arrangement* is the intensity dial: kick alone early, then snare and hats, then a
square arpeggio and a wider filter as the run gets deeper and hotter. Gameplay voices are
an engine (two detuned saws plus sub, pitch and filter tracking speed), tyre squeal
(band-passed noise following slip), a two-tone siren driven by an LFO, and one-shots for
banking, near misses, impacts, chip picks, curses and boss stingers.

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
overclocked — used identically on draft cards and the in-run build rail.

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

Three details make it survivable in practice. The anchor trails the thumb, so the stick
never saturates somewhere you cannot reach. The handbrake has hysteresis — engage at 42% of
travel, release at 22% — so an unsteady grip does not chatter the drift on and off. And the
stick draws itself the moment you touch: a target-free control you cannot see is a control
you cannot learn, so a ring marks the anchor and a dot shows what it is reading.

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

Two signals drive it, because neither alone works. Frame delta says whether we are missing
the target, but it is clamped by vsync — on a 60Hz display a perfect frame still reads
16.7ms, so it can never indicate headroom, and a renderer that had dropped resolution could
never earn it back. Work time — what is actually spent in step plus render — is
vsync-independent and is what says it is safe to give resolution back.

All UI is DOM rather than canvas, so menus, the HUD and the draft cards stay pixel-sharp
regardless of render scale. Only the game world softens.

## Scope of this prototype

Built: full drift model with self-aligning torque, procedural districts, quota and boss
objectives, three boss archetypes with distinct mechanics, 17 chips and 6 curses with a
weighted draft, traffic and pursuit AI, spike-strip hazards, off-screen threat indicators,
particles and decals, bloom pipeline with adaptive quality, synthesised music and SFX,
garage with four cars and four upgrade tracks, localStorage persistence, and a
responsive layout with keyboard and touch input.

Not built: leaderboards, daily rewards, a tutorial, and banner ads. The SDK integration is
verified against a mock covering every call and callback, but has not run against the real
SDK — that needs one pass on their platform.
