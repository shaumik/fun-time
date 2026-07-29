# Submitting NEON HEAT to CrazyGames

> **Read section 8 before you submit.** Two things are still outstanding, and one
> of them (game covers) is a hard requirement that cannot be met from this repo.

## 0. The launch process, and which one we are aiming at

CrazyGames runs a **two-stage launch**, and this changes what "compliant" means:

| | **Basic Launch** | **Full Launch** |
|---|---|---|
| Audience | Limited, 2-week test window | Global release |
| SDK | **Optional** — no CrazyGames-specific integration needed | **Required** |
| Monetization | **Disabled** (video ads, banners, IAP all off) | Enabled, revenue share starts |
| QA | Basic review | Full review |
| Gate | — | Promoted on engagement metrics |

Promotion from Basic to Full is decided by three metrics measured over the
two weeks, benchmarked against the rest of the platform:

| Metric | Benchmark | What it is |
|---|---|---|
| Average play time | 10+ min | Time in a single session |
| Day 1 retention | 10–15% | Players who come back the next day |
| Conversion | 80%+ | Players who play for **at least one minute** |

We submit as **Basic Launch**. The SDK is already integrated and stays in the
build — ads are simply disabled by the platform during Basic, which is
explicitly allowed ("If you choose to integrate the SDK during Basic Launch,
ads remain disabled"). That means one build serves both stages and there is no
second integration pass to do when we get promoted.

Note the conversion metric: it counts players reaching **one minute of play**.
That is the reason for the landing change in section 3.

## 1. Build

```
npm run build
```

Produces:

| File | What it is |
|---|---|
| `dist/neon-heat.zip` | **Upload this.** One file, `index.html` at the zip root. ~92 KB. |
| `dist/index.html` | The same build, unzipped, for local checking. |
| `dist/mockup.html` | The shareable pitch page. **Not** part of the submission. |

The build warns if anything other than the CrazyGames SDK would be requested at
runtime, or if the SDK tag went missing.

## 2. Technical limits

| Limit | Theirs | Ours |
|---|---|---|
| Initial download | ≤ 50 MB (≤ 20 MB for the mobile homepage) | **92 KB** |
| Total file size | ≤ 250 MB | 92 KB |
| File count | ≤ 1500 | **1** |
| Load time | under 10 s is the conversion benchmark | one file, no fetches |

Nothing here is close to a limit. The game ships zero image and zero audio
files — every pixel and every sound is generated at runtime.

## 3. Landing directly in gameplay

Full Implementation requires the game to **land directly in gameplay**, and the
conversion metric punishes anything that delays the first minute of play.

This build used to open on a menu, and a first-time player had to cross five
screens before driving: menu → garage → route map → contract wager → district
brief. That is now a cold boot straight into the opening district — first
standard node on the board, no wager, driving within a second of load
(`bootIntoPlay()` in `src/game.js`).

None of those screens were deleted. They sit between runs, from the second run
on, by which point the player has the vocabulary to read them.

**Onboarding** follows their guidelines: it is in gameplay, not in front of it;
it is visual and one line long; it names only the single control the game has;
and it is skippable — it clears the moment the player steers, and expires on
its own after 5 s regardless.

## 4. Controls and restricted keys

Desktop — **← →**, or A/D. That is the whole control. M to mute.
Mobile — touch anywhere and drag sideways to steer. Nothing else to press.

- **Escape is deliberately unbound.** Their restricted-keys guidance notes that
  Escape already exits fullscreen on the web. It used to quit the run here, so a
  fullscreen player pressing it lost their run as a side effect of un-fullscreening.
- **AZERTY** is handled. Input is read from `event.code` (physical key position),
  so the QWERTY A/D positions land under a French player's Q/D with no remap.
  `KeyQ` is additionally accepted, so reaching for the key *printed* A also works.
- Ctrl/Cmd+W is not bound to anything.

## 5. SDK integration

Loaded via `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js">` in
`<head>`, `await SDK.init()` before any other call, everything else best-effort
behind try/catch.

Verified against a mocked SDK in a real browser (`test/sdk.mjs`). Observed call
order on boot:

```
init → loadingStart → loadingStop → addSettingsChangeListener → gameplayStart
```

and on a rewarded ad: `gameplayStop → requestAd:rewarded → adStarted → adFinished`.

| Requirement | Status |
|---|---|
| `index.html` at the zip root | Yes, and the build enforces it |
| No external requests except the SDK | Yes — build warns on any other host |
| SDK loaded and `await SDK.init()` before use | Yes |
| `loadingStart()` / `loadingStop()` | Yes (immediate — the whole game is inline) |
| `gameplayStart()` / `gameplayStop()` bracketing play | Yes, incl. menus, briefs, level-ups, ads, and a backgrounded tab |
| GameplayStart event fires (Full Implementation) | Yes — on boot, since boot lands in gameplay |
| Ads via `SDK.ad.requestAd()` only, no external ads | Yes — rewarded and midgame, no other ad code exists |
| **Works with AdBlock** | Yes — see below |
| Game paused and muted for the duration of an ad | Yes, before the request rather than on `adStarted` |
| Works in an iframe | Yes — no navigation, no popups, no top-level access |
| Survives blocked `localStorage` | Yes — falls back to in-memory saves |
| Runs on mobile, portrait and landscape | Yes, with gesture controls |
| No console errors | Verified in Chromium, with and without the SDK |
| `happytime()` used sparingly | On a boss kill and a new personal best only |
| `settings.muteAudio` honoured, outranking the in-game toggle | Yes — verified silent, and unmutable from in-game while set |

**AdBlock.** When an ad blocker eats the SDK script the game runs normally and
rewards are granted immediately. It specifically does **not** mime an ad: the
simulated placement (a progress bar, for the off-platform demo) is now suppressed
whenever the SDK script tag is present, i.e. in the submitted build. A player
under AdBlock is never shown a fake ad they have to sit through. Verified: reward
granted in 1 ms, ad overlay never shown, no page errors.

## 6. Store listing copy

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
> Partway through every district, three armoured haulers are called in. They outrun normal
> traffic and shrug off a bump at cruising speed, so taking them means committing — and they
> pay a quarter of your quota if you crack all three before they get away.
>
> Coins from a failed run still buy something you keep. The garage sits between every run —
> six tuning tracks and permanent hardware you can see bolted onto the car: a harpoon that
> auto-fires into the nearest car, plating that detonates everything around you every fifth
> link, a welder that repairs the hull between chains.
>
> Every district demands a points quota before the checkpoint, and you choose the route and
> the event you drive under before each one — risk pays XP, and XP is the only thing that
> levels you. Fifteen levels, three perks offered at each, drawn from fifty-eight — nine of
> them weapons you own outright: a car you punt down the road that bowls through traffic,
> wreckage that cooks off behind you, a burning wake. Some come
> Overclocked: stronger, but welded to a permanent curse — narrower streets, heavier
> traffic, a hotter start. Every third district sends a named pursuit unit after you, and
> the only way to hurt it is to keep banking while it rams you.
>
> Banking raises Heat. Heat puts more units behind you and multiplies every payout, so the
> right line is always a little more dangerous than the comfortable one.

**Controls**
> Desktop — Arrow keys or A/D to steer. That is the whole control. M to mute.
> Mobile — touch anywhere and drag sideways to steer. Nothing else to press. Hit a rail
> head-on and the car reverses out by itself.

**Suggested tags:** driving, racing, drift, crash, destruction, roguelite, arcade, 1 player, singleplayer

**Content rating:** must clear **PEGI 12**. The game is vehicle-on-vehicle
demolition with no characters, no blood, no gore and no human injury depicted —
comfortably inside it, on the same footing as the driving/destruction games
already on the platform.

## 7. Form answers

**Does your game save progress?**
> **Yes, using LocalStorage** (refer to Automatic Progress Save)

Saves live under the `neonheat.v1` key: best score, deepest district, coins, owned cars,
tuning levels, purchased hardware and the control-scheme preference. The Data Module is not
used, so pick the LocalStorage option — CrazyGames then syncs that key to a signed-in
player's account automatically, which gives cloud saves with no code change. Writes are
wrapped in try/catch, so a blocked storage context degrades to in-memory rather than throwing.

**Game options**

| Option | Answer |
|---|---|
| The game supports mobile devices | **Check it.** Portrait and landscape, gesture controls, 60fps on a 390×844 viewport. |
| The game is an online multiplayer game | **Leave unchecked.** Single player, no server. |
| The game supports CrazyGames muting audio through SDK | **Check it.** `settings.muteAudio` is read at init and via `addSettingsChangeListener`. |

On that last one: the portal's setting outranks the in-game sound button, as their docs
require — while the site has muted us the button is disabled and clicking it cannot bring
audio back. Test it locally with `?muteAudio=true`.

**Privacy / user consent:** not required. The game collects no personal data
beyond what the SDK itself does, so no additional T&C or privacy notice is owed.

## 8. Outstanding — do not submit before reading

### 8a. Game covers are missing. This is a hard requirement.

The submission form requires **three cover images and two preview videos**. What
is in `press/` is five 1920×1080 gameplay screenshots — useful, but *not* covers.
Their guidance says explicitly: don't just take a screenshot.

Required:

| Asset | Spec |
|---|---|
| Landscape cover | 16:9 — **1920×1080** |
| Portrait cover | 2:3 — **800×1200** |
| Square cover | 1:1 — **800×800** |
| Landscape video | 1080p 16:9, 15–20 s, ≤ 50 MB, **no sound** |
| Portrait video | 1080p 2:3, 15–20 s, ≤ 50 MB, **no sound** |

All three images must share one visual identity so the game is recognisable at
any crop. Rules: no borders; no text other than the title (no "New", no "Play
Now"); no icons or store logos; nothing copyrighted; nothing blurry or
pixelated. Guidance: lead with a hero visual rather than a screenshot, put the
title on it, use a stylised font, keep it uncluttered.

For the videos: open on the static cover frame so the thumbnail transitions
seamlessly, then the best-looking gameplay. Avoid black-screen/logo transitions,
black bars, a visible mouse cursor, promo text, and social icons. Don't
fast-forward — they speed it up during processing.

**This is a design job and needs a person.** The screenshots in `press/` are
honest source material for it, and the game renders at any resolution, so
capturing portrait and square framings is easy — but the compositing, the title
treatment and the font are judgement calls.

### 8b. Run it once on their platform

The SDK integration is verified against a *mock* in a real browser — every call
and callback is exercised (init, loading, gameplay bracketing, rewarded, midgame,
ad errors, a hung ad that never calls back, and a blocked SDK script) — but never
against the real SDK. The shape matches their documented v3 API; the handshake is
unproven. Their **QA / Preview tool** on the developer portal runs the game as it
would appear on CrazyGames and reports which requirements it meets — use it
before submitting. It is reachable via "Submit a game".

Also worth ten minutes: **test on a real iPhone.** iOS Safari is where web games
break — audio unlock and viewport behaviour especially. Emulated Chromium is not
a substitute.

### 8c. Deliberately not built

- **No global leaderboard.** Theirs is a server-to-server API and this build has
  no backend to hold the key, so what ships is a local top-ten of the player's
  own runs.
- **No banner ads.** `requestBanner` is not wired; the rewarded and midgame
  placements are.
- **No account integration.** Optional — it applies "only when applicable", and
  this game has no login, no external auth and no server-side progress. Progress
  rides on the LocalStorage sync instead.
- **No multiplayer, no in-game purchases.** Both "only when applicable"; IAP is
  invite-only anyway.

## 9. Ad placement summary

| Placement | Trigger |
|---|---|
| Rewarded — revive | On a wreck, once per run, only if the run was worth saving |
| Rewarded — double coins | Game over screen |
| Midgame interstitial | Every third run end |

No ad ever interrupts live gameplay — every placement sits on a screen the
player is already stopped on. Under Basic Launch all of this is disabled by the
platform and none of it fires.
