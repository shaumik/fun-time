# Submitting NEON HEAT to CrazyGames

## 1. Build

```
npm run build
```

Produces:

| File | What it is |
|---|---|
| `dist/neon-heat.zip` | **Upload this.** One file, `index.html` at the zip root. ~40 KB. |
| `dist/index.html` | The same build, unzipped, for local checking. |
| `dist/mockup.html` | The shareable pitch page. **Not** part of the submission. |

The build warns if anything other than the CrazyGames SDK would be requested at
runtime, or if the SDK tag went missing.

## 2. Upload

Developer portal → **Submit game** → upload `dist/neon-heat.zip`.

## 3. Store listing copy

Paste-ready. Edit to taste.

**Title:** NEON HEAT

**Short description**
> A demolition roguelite you play with one axis. Steer, ram everything, and beat the chain
> clock — then spend what you earned in the garage before the next run.

**Description**
> Traffic is ammunition, not scenery. Steering is the only control — no handbrake, no boost
> button — and you drive straight through the cars in front of you. Every wreck adds a link
> to your chain and resets a three-second clock; when it runs out, the whole pile banks at
> once. Wreck your hull before then and you lose the lot.
>
> Power-ups lie in the lanes and fire the instant you touch them: raw Boost, Repair, a Ram
> Plate that makes wrecks free, and Surge, which stops the clock dead.
>
> Coins from a failed run still buy something you keep. The garage sits between every run —
> six tuning tracks and permanent hardware you can see bolted onto the car: a harpoon that
> auto-fires into the nearest car, plating that detonates everything around you every fifth
> link, a welder that repairs the hull between chains.
>
> Every district demands a points quota before the checkpoint, and you choose the route and
> the terms you drive under before each one. Clear it and you fit one chip from three. Some
> come Overclocked: stronger, but welded to a permanent curse — narrower streets, heavier
> traffic, a hotter start. Every third district sends a named pursuit unit after you, and
> the only way to hurt it is to keep banking while it rams you.
>
> Banking raises Heat. Heat puts more units behind you and multiplies every payout, so the
> right line is always a little more dangerous than the comfortable one.

**Controls**
> Desktop — Arrow keys or A/D to steer. That is the whole control. M to mute.
> Mobile — touch anywhere and drag sideways to steer. Nothing else to press.

**Suggested tags:** driving, racing, drift, crash, destruction, roguelite, arcade, 1 player, singleplayer

**Screenshots:** `press/` — 1920×1080 captures of the title, a pile-up mid-chain, a boss chase,
the chip draft, and the garage. Generated from the running game, so they are honest.

> These PNGs are marketing assets. The game build itself still ships zero image and zero
> audio files — everything in it is generated at runtime.

## 4. Form answers

The submission form asks these directly. Answers for this build:

**Does your game save progress?**
> **Yes, using LocalStorage** (refer to Automatic Progress Save)

Saves live under the `neonheat.v1` key: best score, deepest district, coins, owned cars,
tuning levels, purchased hardware and the control-scheme preference. The Data Module is not used, so pick the
LocalStorage option — CrazyGames then syncs that key to a signed-in player's account
automatically, which gives cloud saves with no code change. Writes are wrapped in
try/catch, so a blocked storage context degrades to in-memory rather than throwing.

**Game options**

| Option | Answer |
|---|---|
| The game supports mobile devices | **Check it.** Portrait and landscape, gesture controls, 60fps on a 390×844 viewport. |
| The game is an online multiplayer game | **Leave unchecked.** Single player, no server. |
| The game supports CrazyGames muting audio through SDK | **Check it.** `settings.muteAudio` is read at init and via `addSettingsChangeListener`. |

On that last one: the portal's setting outranks the in-game sound button, as their docs
require — while the site has muted us the button is disabled and clicking it cannot bring
audio back. Test it locally with `?muteAudio=true`.

## 5. Requirements checklist

| Requirement | Status |
|---|---|
| `index.html` at the zip root | Yes, and the build enforces it |
| No external requests except the SDK | Yes — build warns on any other host |
| SDK loaded and `await SDK.init()` before use | Yes |
| `loadingStart()` / `loadingStop()` | Yes (immediate — the whole game is inline) |
| `gameplayStart()` / `gameplayStop()` bracketing play | Yes, incl. menus, briefs, drafts, ads, and a backgrounded tab |
| Ads via `SDK.ad.requestAd()` | Yes — rewarded and midgame |
| Game paused and muted for the duration of an ad | Yes, before the request rather than on `adStarted` |
| Works in an iframe | Yes — no navigation, no popups, no top-level access |
| Survives blocked `localStorage` | Yes — falls back to in-memory saves |
| Runs on mobile, portrait and landscape | Yes, with gesture controls |
| No console errors | Verified against a mocked SDK |
| `happytime()` used sparingly | On a boss kill and a new personal best only |
| `settings.muteAudio` honoured, outranking the in-game toggle | Yes — verified silent, and unmutable from in-game while set |

## 6. Before you hit submit

Two things I could not verify from here, both worth ten minutes:

1. **Run it once on their platform.** The SDK integration is tested against a *mock* — every
   call and callback is exercised (init, loading, gameplay bracketing, rewarded, midgame,
   ad errors, and a hung ad that never calls back), but never against the real SDK. The
   shape matches their current docs; the handshake is unproven.
2. **Test on a real iPhone.** iOS Safari is where web games break — audio unlock and
   viewport behaviour especially. Emulated Chromium is not a substitute.

Not built, in case it comes up in review: no leaderboards, no daily reward, no tutorial
beyond a one-time control hint, and no banner ads (`requestBanner` is not wired — the
rewarded and midgame placements are).

## 7. Ad placement summary

| Placement | Trigger |
|---|---|
| Rewarded — revive | On a wreck, once per run, only if the run was worth saving |
| Rewarded — double coins | Game over screen |
| Midgame interstitial | Every third run end |

All three degrade to a simulated overlay when the SDK is absent, so the flow stays
demonstrable off-platform.
