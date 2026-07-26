# NEON HEAT — design & monetization brief

**One line:** A top-down arcade drift game where you bank drift combos while police heat
escalates behind you. One-button drift, 60-second runs, garage progression.

---

## Why this concept

Three constraints drove the pick.

**1. No art team.** Hand-authored sprites made without an illustrator always read as
amateur — that is the single most common reason a self-published CrazyGames title looks
cheap. So the art direction is *rendering*, not *assets*: every pixel is generated at
runtime from geometry, gradients, particles and a bloom pipeline. There are no image
files in this project. Nothing can look like bad art because there is no art to be bad.
The look is carried by:

- a real bright-pass → blur → additive-composite bloom chain (not `shadowBlur`)
- pseudo-3D building extrusion driven off screen-space parallax
- persistent skid decals, tyre smoke, wall sparks, boost plumes
- camera that rotates to heading, zooms with speed, and shakes on impact
- typography treated as a first-class HUD element

**2. Driving is CrazyGames' strongest evergreen category** — behind only .io, and unlike
.io it needs no servers, no matchmaking, and no concurrency floor to feel alive.

**3. The loop has to generate ad impressions honestly.** Run length is tuned to 45–90s,
which puts a natural rewarded-video decision point (revive) and a natural interstitial
point (run end) close together without either feeling like a paywall.

## The loop

```
menu → run (45–90s) → crash → [revive? ad] → game over → [2× coins? ad] → garage → run
                                                              └ every 3rd run: interstitial
```

**In-run.** Hold drift. While sliding above a threshold angle at speed, points accumulate
into a *pending* bank with a rising multiplier. The bank is only paid out when you
straighten up cleanly — crash while holding a big bank and you lose all of it. That
tension is the whole game: every extra second of drift is a bet.

**Heat.** Banking raises Heat. At each Heat tier the police spawn behind you and ram.
Higher Heat multiplies every payout, so the correct play is always slightly more dangerous
than the comfortable one. Heat is what turns a score-attack game into a chase.

**Meta.** Coins buy cars (four distinct procedurally-drawn silhouettes and handling models)
and four upgrade tracks — Grip, Nitro, Armor, Payout. Progression is what converts a
one-session player into a D1 retained player, which is what actually moves revenue.

## Monetization

| Placement | Trigger | Notes |
|---|---|---|
| Rewarded — Revive | On crash, once per run | Highest-intent moment in the game. Offered only when the run is worth saving. |
| Rewarded — 2× Coins | Game over screen | Pure upside, no loss framing. Highest opt-in rate of the three. |
| Rewarded — Garage unlock boost | Garage, when short on coins | Converts stalled progression into an impression instead of a churn. |
| Interstitial (midroll) | Every 3rd run end | CrazyGames caps frequency; 3 runs ≈ their guidance without feeling hostile. |
| Banner | Menu + garage only | Never during play. |

Integration goes through `Ads` in `src/game.js`, which calls the real CrazyGames SDK
(`window.CrazyGames.SDK`) when present and falls back to a simulated ad overlay so the
prototype demonstrates the full flow standalone.

## Art direction

Committed single-theme — this is an arcade screen, not a document, so it does not follow
the viewer's light/dark preference.

| Token | Value | Role |
|---|---|---|
| Void | `#05060E` | Ground. Near-black, biased blue. |
| Asphalt | `#0D1120` | Road surface. |
| Cyan | `#3DE8FF` | Primary accent — player, road edges, UI. |
| Magenta | `#FF2E88` | Secondary — combo, city glow. |
| Red | `#FF3355` | Police, danger, crash. Semantic only. |
| Amber | `#FFB13D` | Coins, nitro. Semantic only. |
| Ice | `#C6D2E8` | Text. Blue-biased grey, never pure. |

Type is the racing-HUD vernacular: uppercase micro-labels at wide tracking sitting under
oversized tabular numerals. No webfonts — the CSP on the hosted build blocks font CDNs,
and a silent fallback would wreck the layout, so the stack is system-native with the
weight and tracking doing the work.

## Scope of this prototype

Built: full physics and drift model, procedural track generation, traffic, police AI and
heat tiers, combo banking, particles and decals, bloom pipeline, HUD, menu with attract-mode
AI driver, game over with live ad flow, garage with four cars and four upgrade tracks,
localStorage persistence, keyboard and touch input.

Not built: audio, leaderboards, daily rewards, the real SDK handshake (shimmed).
