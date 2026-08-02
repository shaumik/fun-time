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

## 1a. Check

```
npm run check
```

Drives `dist/index.html` against a mocked v3 SDK in headless Chromium and
asserts 97 things their QA looks at — click depth to gameplay, SDK event
ordering, rewarded-button behaviour under Basic Launch and adblock, identity
handling for guests and signed-in players, and legibility at all ten iframe
sizes they list. Needs `npm i` once for Playwright. A green run proves this
side of the contract; it does **not** prove the handshake with the real SDK.

## 1b. Covers and preview videos

```
node tools/make-covers.mjs      # covers/*.png
node tools/make-preview.mjs     # covers/*.mp4
```

Everything the submission form asks for, generated from the running game:

| File | Spec |
|---|---|
| `covers/landscape-1920x1080.png` | 16:9, mandatory |
| `covers/portrait-800x1200.png` | 2:3, mandatory |
| `covers/square-800x800.png` | 1:1, mandatory |
| `covers/preview-landscape-1920x1080.mp4` | 16:9 1080p, 18s, ~17 MB |
| `covers/preview-portrait-720x1080.mp4` | 2:3 1080p, 18s, ~8 MB |

All five are shot in **The Grid**, so the set reads as one game — a run now
draws three districts of five at random, and left alone that produced a
magenta landscape next to an orange square.

Against their restrictions: no borders, no text but the title, no icons or
store logos, nothing copyrighted. The videos carry no sound, no black bars,
no cursor and no promotional text, sit inside the 15–20s window and well
under the 50 MB ceiling, and open on the matching static cover so the
thumbnail dissolves into the preview. Nothing is pre-accelerated — their
processing speeds it up at their end.

The preview capture drives the game on a virtual clock (`requestAnimationFrame`
and `performance.now` are replaced before the game loads), so a slow
screenshot cannot become a hitch in the footage and every frame is exactly
1/60s of game time. The bot's hull is topped up and it is walked through the
between-district screens, because a preview that ends on a game over screen
is a preview whose last frame is two rewarded-ad buttons.

## 2. Upload

Developer portal → **Submit game** → upload `dist/neon-heat.zip`.

## 3. Store listing copy

Paste-ready. Edit to taste.

**Title:** NEON HEAT

**Short description**
> Steer. That's the only control. Everything else is what you hit.

**Description**
> Steer. That's the only control. No brake, no boost button — just a car doing 400km/h
> through rush hour, and nothing gets out of the way.
>
> Every car you smash joins the chain and the multiplier climbs. Bank it before the clock
> runs out or you lose the lot. Buses pay more than coupes. Hit a Ram Plate and wrecks stop
> costing you anything at all.
>
> Then the police turn up. Then something with a name — and the only way to hurt it is to
> keep smashing while it rams you.
>
> Die and you keep the coins. Bolt on a harpoon that fires itself. Take a perk that cooks
> the wreckage behind you. Roll a new set of streets and go again.
>
> **58 perks · 9 weapons · 5 districts · 5 pursuit units · one axis**

**Controls**
> Desktop — Arrow keys or A/D to steer. That is the whole control. M to mute.
> Mobile — touch anywhere and drag sideways to steer. Nothing else to press. Hit a rail
> head-on and the car reverses out by itself.

Key handling reads `KeyboardEvent.code`, which names physical positions, so an
AZERTY player reaching for ZQSD gets the same bindings without rebinding —
their "Q" is physically `KeyA`. Escape is deliberately unbound: it is on their
restricted list because the browser and their own fullscreen control own it.

**Suggested tags:** driving, racing, drift, crash, destruction, roguelite, arcade, 1 player, singleplayer

**Screenshots:** `press/` — 1920×1080 captures of the title, a pile-up mid-chain, a boss chase,
a level-up, and the garage. Generated from the running game, so they are honest.

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
| `gameplayStart()` / `gameplayStop()` bracketing play | Yes, incl. menus, briefs, level-ups, ads, and a backgrounded tab |
| Ads via `SDK.ad.requestAd()` | Yes — rewarded and midgame |
| Game paused and muted for the duration of an ad | Yes, before the request rather than on `adStarted` |
| Works in an iframe | Yes — no navigation, no popups, no top-level access |
| Survives blocked `localStorage` | Yes — falls back to in-memory saves |
| Runs on mobile, portrait and landscape | Yes, with gesture controls |
| No console errors | Verified against a mocked SDK |
| `happytime()` used sparingly | On a boss kill and a new personal best only |
| `settings.muteAudio` honoured, outranking the in-game toggle | Yes — verified silent, and unmutable from in-game while set |
| Midgame never paired with a "keep playing" rewarded offer | Yes — the midgame is skipped on any run end where Revive is live |
| Continue-without-watching matches the ad offer in size/font/weight | Yes — measured identical at 215×50 on a 390-wide viewport |
| Safe-area insets honoured on notched devices | Yes — every edge-anchored element, in both orientations |
| No custom fullscreen button | Yes — none exists |
| No cross-promotion or external links | Yes — the build requests nothing but the SDK |
| **New players land in gameplay** | Yes — **zero clicks**; a first-ever load starts district 1 directly |
| **No rewarded button without effect** | Yes — `hasAdblock()` up front, and the offers are withdrawn on `adblock` / `adsDisabledBasicLaunch` |
| **An alternative to watching an ad** | Yes — revive is also purchasable with coins |
| **Unfilled ads tell the player to retry** | Yes — transient codes keep the offer up and toast |
| **CrazyGames username *and* avatar shown** | Yes — on the records board, guests excluded |
| **Guest signing in mid-session detected** | Yes — `addAuthListener` |
| **`systemInfo` used for device detection** | Yes — overrides the local hover/touch probe once init resolves |
| **`reportGameCompletedPercentage`** | Yes — deepest district over the 15 authored ones, monotonic |
| **`setGameContext` / `clearGameContext`** | Yes — act, district, level and node type |
| **Escape not bound to anything** | Yes — it is a restricted key and used to abandon the run |
| **Text legible at `devicePixelRatio:1`** | Yes — 10px floor on every font, verified at all ten iframe sizes |
| **Wheel and right-click swallowed** | Yes — except the garage work order, which scrolls |
| **iOS audio revived on a user gesture** | Yes — `touchend`, `click` and `pointerdown`, handling `interrupted` too |

## 6. Before you hit submit

Two things I could not verify from here, both worth ten minutes:

1. **Run it once on their platform.** The SDK integration is tested against a *mock* — every
   call and callback is exercised (init, loading, gameplay bracketing, rewarded, midgame,
   ad errors, and a hung ad that never calls back), but never against the real SDK. The
   shape matches their current docs; the handshake is unproven. Their preview tool at
   `crazygames.com/preview` is the place to prove it, and it also reports back on the
   SDK features you implemented.
2. **Test on a real iPhone.** iOS Safari is where web games break — audio unlock and
   viewport behaviour especially. Emulated Chromium is not a substitute. The audio
   context now resumes on `touchend`/`click` and handles the `interrupted` state their
   docs describe, but that path has only been exercised in Chromium.
3. **Look at the first thirty seconds yourself.** The single biggest change here is that
   new players no longer pass through four screens before driving. Load the build with
   an empty `localStorage` and check the run it drops you into is one you would want a
   stranger judging the game on.

**Two calls left open, both yours to make:**

1. **Progress save stays on localStorage + APS.** Their docs call the Data module
   "preferred" but list APS as an allowed alternative, and this game has no in-game
   purchases, so APS is legal. Switching to the Data module means the submission form's
   Progress Save answer *must* change to "using the Data Module" in the same breath —
   the module is disabled otherwise and saves break silently. Not worth doing blind.
   Keep answering **"Yes, using LocalStorage"** while this build ships as-is.
2. **No banner ads.** `requestBanner` is still unwired. Banners are optional, and their
   rules around them are easy to fail — not during gameplay, only on screens open five
   seconds or more, never covering UI at any size, two per view maximum. Shipping
   without them is not a rejection; shipping them badly is.

Not built, in case it comes up in review: no *global* leaderboard — theirs is a
server-to-server API and this build has no backend to hold the key, so what ships is a
local top-ten of the player's own runs.

Onboarding is now in gameplay rather than in front of it, which is what their
guidelines ask for: a first-ever load drops straight into district 1 and a single
timed line names the control for whichever input the player is on. Returning players
get the menu, garage and route board exactly as before — the rule is about *new*
users, and a player with a save has already seen the flow.

**No sitelock either**, and that one is deliberate. Their guide suggests checking that
`"crazygames"` appears within the last three parts of the hostname and blanking the
screen otherwise. The failure mode is asymmetric: the upside is deterring clone sites,
the downside of getting the domain list wrong is a black screen for real players on a
CrazyGames domain this build never got to see. It is a ten-minute change once you can
test against the live platform, and a bad bet before then.

## 7. Ad placement summary

| Placement | Trigger |
|---|---|
| Rewarded — revive | On a wreck, once per run, only if the run was worth saving |
| Rewarded — double coins | Game over screen |
| Paid revive (no ad) | Same screen, priced `500 + 250 × district` from banked coins |
| Midgame interstitial | Every third run end, **unless** the Revive offer is live or ads are known dead |

All four buttons on that screen — both ad offers, the paid alternative and
"Spend it in the garage" — are measured identical in width, height, font size,
weight and family, which is their explicit requirement for the
continue-without-watching path.

When no ad can serve, the two ad routes are removed rather than disabled-and-
clickable, an inline notice says why (never a popup — their adblock rules
forbid those), and the coin revive carries the screen. `unfilled` and
`adCooldown` are treated as transient: the offer stays and the player is told
to try again.

All three degrade to a simulated overlay when the SDK is absent, so the flow stays
demonstrable off-platform.

That exception is the ads policy, not a preference: a midgame ad and a "watch a
rewarded ad to keep playing" offer may not both sit between the same two attempts.
Revive is that offer, so it wins the slot whenever it is available — which also
means the midgame lands mostly on short runs, where there is nothing to revive.
Double-your-coins is unaffected, because it pays out a run that has already ended
rather than continuing the current one.

Nothing in the game requests an ad while the car is moving. Every placement sits on
the game-over screen, which is what their driving-game guidance asks for.

**One judgment call left open.** Their driving-genre ad guide suggests capping a
revive at *once per session*; this build caps it at once per *run*, which is what
the phrase most likely means and what the genre does as standard. Read strictly, a
player who takes a revive in run 1 should not be offered one again in run 2. That
is a monetization decision rather than a compliance fix, so it is left as-is —
`reviveOffered` in `endRun()` is the single place to tighten if you disagree.
