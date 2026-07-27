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
> A drift roguelite. Hold the slide to build a bank, release to cash it in, and climb a
> ladder of city districts before the law catches up.

**Description**
> Every district demands a points quota banked before the checkpoint. Points only accrue
> while you are sideways — and they only pay out when you straighten up. Wreck while
> holding a fat bank and you lose the lot.
>
> Clear a district and you fit one chip from three. Some come Overclocked: stronger, but
> welded to a permanent curse — narrower streets, heavier traffic, a hotter start. Every
> third district sends a named pursuit unit after you, and the only way to hurt it is to
> keep banking while it rams you.
>
> Banking raises Heat. Heat puts more units behind you and multiplies every payout, so the
> right line is always a little more dangerous than the comfortable one.

**Controls**
> Desktop — Arrow keys or A/D to steer, Space to drift, Shift for nitro, M to mute.
> Mobile — touch anywhere and drag: sideways steers, pull back to drift, release forward to
> bank. A second finger anywhere is nitro.

**Suggested tags:** driving, racing, drift, roguelite, arcade, 1 player, singleplayer

**Screenshots:** `press/` — 1920×1080 captures of the title, a drift at ×6, a boss chase,
the chip draft, and the garage. Generated from the running game, so they are honest.

> These PNGs are marketing assets. The game build itself still ships zero image and zero
> audio files — everything in it is generated at runtime.

## 4. Requirements checklist

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

## 5. Before you hit submit

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

## 6. Ad placement summary

| Placement | Trigger |
|---|---|
| Rewarded — revive | On a wreck, once per run, only if the run was worth saving |
| Rewarded — double coins | Game over screen |
| Midgame interstitial | Every third run end |

All three degrade to a simulated overlay when the SDK is absent, so the flow stays
demonstrable off-platform.
