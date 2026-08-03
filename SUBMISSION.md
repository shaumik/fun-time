# Submitting NEON HEAT to CrazyGames

> **Read section 10 before you submit.** One hard requirement — the game covers —
> cannot be met from this repo and needs a designer.

## 0. The launch process, and which one we are aiming at

CrazyGames runs a **two-stage launch**, and this changes what "compliant" means:

| | **Basic Launch** | **Full Launch** |
|---|---|---|
| Audience | Limited, 2-week test window | Global release |
| SDK | **Optional** — no CrazyGames-specific integration needed | **Required** |
| Monetization | **Disabled** (video ads, banners, IAP all off) | Enabled, revenue share starts |
| QA | Basic review | Full review |
| Gate | — | Promoted on engagement metrics |

Promotion is decided by three metrics measured over the two weeks, benchmarked
against the rest of the platform:

| Metric | Benchmark | What it is |
|---|---|---|
| Average play time | 10+ min | Time in a single session |
| Day 1 retention | 10–15% | Players who come back the next day |
| Conversion | 80%+ | Players who play for **at least one minute** |

We submit as **Basic Launch**, with the SDK already integrated and left in the
build — explicitly allowed, and it means one build serves both stages with no
second integration pass on promotion.

**The trap in that choice.** Their advertisement page is blunt about it: if you
ship the ads SDK into Basic Launch, QA checks that the game still runs cleanly
*with ads disabled*, and **rejects it if not** — naming "rewarded ad buttons
without effect" as the failure. Section 6 is how this build satisfies that.

## 1. Build

```
npm run build      # dist/
npm test           # the compliance harness, see section 9
```

| File | What it is |
|---|---|
| `dist/neon-heat.zip` | **Upload this.** One file, `index.html` at the zip root. ~129 KB. |
| `dist/index.html` | The same build, unzipped, for local checking. |
| `dist/standalone/neon-heat-standalone.zip` | The same game with no portal SDK, for self-hosting or itch.io. **Not** part of the submission. |

The build warns if anything other than the CrazyGames SDK would be requested at
runtime, if the SDK tag went missing, or if the standalone build picked up an
external host of any kind.

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

| Requirement | Theirs | Ours |
|---|---|---|
| Initial download (loading → first gameplayStart) | ≤ 50 MB, ≤ 20 MB for the mobile homepage | **129 KB** |
| Total file size | ≤ 250 MB | 129 KB |
| File count | ≤ 1500 | **1** |
| Time to gameplay | ≤ 20 s, and < 10 s is the conversion benchmark | one file, no fetches, no external assets |
| Relative paths only | required | nothing to reference — the build is a single inlined file |
| Chrome / Edge | required | verified in Chromium |
| Chromebook, 4 GB RAM | must run smoothly | dynamic resolution scaling + quality auto-tune already in the loop |
| Mouse, keyboard **and** touch | all required | see section 4 |
| Landscape on desktop | required | yes; portrait supported too |
| `user-select:none` on the body | required verbatim, all four prefixes | added — it was on `#stage` only |
| Safe-area insets (CrazyGames App fullscreen) | required | HUD now inset with `env(safe-area-inset-*)` |
| iOS audio after interruption | resume on a gesture; `interrupted` state | handled — see below |
| Orientation lock | do **not** implement; configure it in the form | none implemented |

Nothing is close to a size limit: the game ships zero image and zero audio
files, and generates every pixel and every sound at runtime.

**iOS audio.** Their technical page notes that iOS parks the AudioContext in
`interrupted` when the tab is backgrounded or a call comes in, and that WebKit
will not restart it from a visibility change — it needs a real gesture. The
context now accepts `interrupted` as well as `suspended`, and resumes on
`touchend` in addition to the existing pointer and key handlers.

## 3. Landing directly in gameplay

Full Implementation requires landing new users in gameplay immediately — *"a
maximum of 1 click is allowed"* if that is not feasible — and the conversion
metric punishes anything that delays the first minute of play.

This build used to open on a menu, with **five screens** before driving: menu →
garage → route map → contract wager → district brief. A cold boot now goes
straight into the opening district: first standard node on the board, no wager,
driving within a second of load, **zero clicks** (`bootIntoPlay()` in
`src/game.js`).

None of those screens were deleted. They sit between runs, from the second run
on, by which point the player has the vocabulary to read them.

**Onboarding** follows their quality guidelines: it happens in gameplay rather
than in front of it, it is visual and one line long, it names only the single
control the game has, and it is skippable — it clears on the first steering
input and expires after 5 s regardless.

## 4. Controls

| Device | Control |
|---|---|
| Desktop keyboard | **← →**, or A/D. That is the whole control. M to mute. |
| Desktop mouse | Move the cursor; the car steers toward it. Nothing to hold down. |
| Mobile / tablet | Touch anywhere and drag sideways. Hit a rail head-on and the car reverses out by itself. |

- **Mouse support was missing** and is a Basic requirement ("game supports
  mouse, keyboard, and touch"). Steering now follows the cursor's distance from
  the centre of the stage, with a dead zone at the middle. It arms on the first
  mouse movement and disarms the instant a steering key is pressed, so a
  keyboard player never fights a parked cursor.
- **Escape is deliberately unbound.** Their restricted-keys guidance notes it
  already exits fullscreen on the web. It used to quit the run, so a fullscreen
  player pressing it lost the run as a side effect of un-fullscreening.
- **AZERTY** is handled. Input is read from `event.code` (physical position), so
  the QWERTY A/D positions land under a French player's Q/D with no remap;
  `KeyQ` is additionally accepted for anyone reaching for the key *printed* A.
- **Ctrl/Cmd+W** is not bound to anything.
- **No custom fullscreen button.** Prohibited — CrazyGames provides fullscreen.

## 5. Gameplay requirements

| Requirement | Status |
|---|---|
| Legible at devicePixelRatio 1, at their listed iframe sizes | Yes — see below |
| Consistent physics across refresh rates (144 Hz, 165 Hz) | Yes — measured, 0.6% drift |
| English localization | Yes, and it is the only language |
| Intuitive controls on every device type | Yes — section 4 |
| Loads quickly, no errors or crashes | Verified in Chromium, with and without the SDK |
| Originality | Original code, original art, original name |
| No custom fullscreen button | Correct — none |
| No cross-promotion | Correct — the build contains no outbound links at all |
| PEGI 12 | Vehicle-on-vehicle demolition. No characters, no blood, no gore, no human injury depicted. |

**Legibility.** `npm run test/sizes.mjs` renders gameplay at all ten iframe
sizes they name, at DPR 1, into `press/iframe-sizes/`. This caught a real
problem: the HUD unit was derived from `height/100`, so at their two smallest
sizes — 821×462 and 800×450 — caption type fell to just over **6 px**. The unit
now has a floor of 5.6, which lifts the smallest captions to ~7.6 px and changes
nothing at the sizes that were already above it.

**Physics.** `test/physics.mjs` fakes the refresh rate by feeding the loop
synthetic timestamps, then drives the integrator directly at 60/144/165 Hz.
Worst drift is **0.59%**, which is the residual of one explicit Euler term and
converges as the timestep shrinks. Note this measures the integrator: a car left
with *no input at all* will wander off-road and into barriers, and that recovery
is chaotic rather than rate-stable — it is collision response, not integration,
and no player drives with no input.

## 6. Advertisement compliance

The ad layer was reworked specifically against this page. Every point below is
covered by `test/ads.mjs`.

| Rule | How it is met |
|---|---|
| Only ads requested through the CrazyGames SDK | No other ad code exists in the build |
| Ads must not interrupt gameplay | Every placement sits on a screen the player is already stopped on — never during a run |
| Game paused while requesting **and** showing | `adPause` blocks the loop from the request until `adFinished`/`adError` |
| **Mute only on `adStarted`, not on request** | Corrected — see below |
| Handle unfilled calls (`adError`) so the game continues | Yes, with a 25 s guard for callbacks that never arrive |
| Do **not** reward on `adError` | Correct — the player is told to try again later instead |
| No midgame ad on a navigational button | Midgame fires only at run end |
| Midgame frequency | Left to the SDK, as their page instructs |
| Rewarded button never on an active gameplay screen | Both rewarded offers live on the game-over screen |
| Rewarded offers must not be too frequent | Revive is once per run and only above 400 points |
| No chaining ads for one reward | One ad, one reward |
| Provide an alternative to watching an ad | **Revive for 250 coins**, same size and weight as the ad button |
| The non-ad option must not be visually deprioritized | Same footprint, neutral palette, no dimming |
| Clear that an ad is involved | Video glyph plus an "Ad" tag on both rewarded buttons |
| Clear that the reward is optional | Nothing is hidden or delayed; the continue button is the primary CTA |
| Never a midgame **and** a rewarded-continue on the same transition | Enforced — the revive offer suppresses the midgame |
| No banners | `requestBanner` is not wired |

**Two corrections to what this file used to claim:**

1. **Muting.** The previous build muted *before* the ad request, and this file
   argued that was better. Their page says the opposite, and explains why: the
   request may return nothing, and "muting and unmuting your music without a
   visual change is not user-friendly". Pausing and muting are now separate —
   the game blocks on request, the audio ducks only when `adStarted` fires.
   Measured: mute lands at 431 ms against an `adStarted` at 400 ms, and never at
   the moment of the request.

2. **AdBlock.** The previous build showed a *simulated* ad — a progress bar the
   player sat through for an ad that did not exist — and an earlier pass at this
   changed it to grant the reward outright. Both are wrong. Their rules say do
   not reward on `adError`, do not keep rewarded buttons clickable without
   effect, and never penalize a player for using an ad blocker. So the offer is
   **withdrawn and explained** instead: the ad buttons disappear, the coin
   revive remains, and a line says why. The rest of the game is untouched.

The same path covers Basic Launch, where ads are disabled platform-wide: the
first failed request tells the player to try again later, the second retires the
ad-funded offers for the session. No dead buttons, which is the specific thing
their QA rejects for.

## 7. Account integration

Not applicable, by their own scenario table — the game has no notion of users,
no login, no external auth and no back-end.

- No external login options. There are none of any kind.
- The **User module** is read purely to put a signed-in player's name on their
  own local record board; `null` is handled and play continues as a guest.
- **Progress save** uses their Automatic Progress Save system: everything lives
  under the single `neonheat.v1` LocalStorage key, which CrazyGames syncs to a
  signed-in account with no code change. Permitted here because the game has no
  in-game purchases. Writes are wrapped in try/catch, so a blocked storage
  context degrades to in-memory rather than throwing.

## 8. Form answers

**Does your game save progress?** → **Yes, using LocalStorage** (Automatic
Progress Save). Key `neonheat.v1`: best score, deepest district, coins, owned
cars, tuning levels, purchased hardware, control-scheme preference.

| Option | Answer |
|---|---|
| Supports mobile devices | **Check it.** Portrait and landscape, gesture controls, 60 fps on a 390×844 viewport. |
| Online multiplayer | **Leave unchecked.** Single player, no server. |
| Supports CrazyGames muting audio through SDK | **Check it.** `settings.muteAudio` read at init and via `addSettingsChangeListener`. |

The portal's mute outranks the in-game sound button, as required — while the
site has muted us the button cannot bring audio back. Test with `?muteAudio=true`.

**Orientation:** configure both. Do not expect the game to lock it — their
platform handles that, and implementing it is explicitly discouraged.

**Privacy / user consent:** not required. No personal data is collected beyond
what the SDK itself does, so no T&C or privacy notice is owed.

## 9. The test harness

`npm test` needs Playwright, which is deliberately not a dependency of the game:

```
npm install --no-save playwright
npm test
```

| Script | Covers |
|---|---|
| `test/smoke.mjs` | Boot state, 60 fps, Escape safety, external requests, console errors. Pass `mobile` for a 390×844 iPhone context. |
| `test/sdk.mjs` | SDK handshake against a mock: call order, rewarded flow, site mute outranking the in-game toggle, and a blocked SDK. |
| `test/flow.mjs` | The full screen flow — boot → run → over → garage → map → contract → brief → play → menu. |
| `test/ads.mjs` | Every rule in section 6: withdrawal, adError, mute timing, midgame/rewarded pairing, mouse steering. |
| `test/physics.mjs` | Integrator consistency at 60 / 144 / 165 Hz. |
| `test/sizes.mjs` | Renders all ten of their iframe sizes at DPR 1 into `press/iframe-sizes/`. |

Observed SDK call order on boot:
`init → loadingStart → loadingStop → addSettingsChangeListener`, then
`gameplayStart` on the player's first steering input — not on the frame the
district starts, which is a moment earlier and still behind the onboarding hint.
On a rewarded ad: `gameplayStop → requestAd:rewarded → adStarted → adFinished`.

## 10. Outstanding — do not submit before reading

### 10a. Game covers are missing. This is a hard requirement.

The form requires **three cover images and two preview videos**. `press/` holds
gameplay screenshots — useful source material, but *not* covers. Their guidance
says explicitly: don't just take a screenshot.

| Asset | Spec |
|---|---|
| Landscape cover | 16:9 — **1920×1080** |
| Portrait cover | 2:3 — **800×1200** |
| Square cover | 1:1 — **800×800** |
| Landscape video | 1080p 16:9, 15–20 s, ≤ 50 MB, **no sound** |
| Portrait video | 1080p 2:3, 15–20 s, ≤ 50 MB, **no sound** |

All three images must share one visual identity so the game is recognisable at
any crop. Rules: no borders; no text other than the title (no "New", no "Play
Now"); no icons or store logos; nothing copyrighted; nothing blurry. Guidance:
lead with a hero visual rather than a screenshot, put the title on it, use a
stylised font, keep it uncluttered.

Videos should open on the static cover frame so the thumbnail transitions
seamlessly. Avoid black-screen/logo transitions, black bars, a visible cursor,
promo text and social icons. Don't fast-forward — they speed it up in processing.

**This needs a person.** The game renders at any resolution, so capturing
portrait and square framings is easy; the compositing, title treatment and font
are judgement calls.

### 10b. Run it once on their platform

The SDK integration is verified against a *mock* in a real browser — init,
loading, gameplay bracketing, rewarded, midgame, ad errors, a hung ad that never
calls back, and a blocked SDK script — but never against the real SDK. The shape
matches their documented v3 API; the handshake is unproven.

Their **QA / Preview tool** on the developer portal runs the game as it would
appear on CrazyGames and reports which requirements it meets. Use it before
submitting; it is reachable via "Submit a game".

Also worth ten minutes: **test on a real iPhone.** iOS Safari is where web games
break — the audio interruption path in section 2 especially. Emulated Chromium is
not a substitute.

### 10c. Deliberately not built

- **No global leaderboard.** Theirs is a server-to-server API and this build has
  no backend to hold the key, so what ships is a local top-ten of the player's
  own runs.
- **No banner ads.** `requestBanner` is not wired.
- **No multiplayer, no in-game purchases.** Both apply "only when applicable";
  IAP is invite-only anyway.
- **No sitelock.** Optional, and it would only add a way to lock ourselves out.

### 10d. Documentation not yet read

This file was written against their Introduction, Requirements (intro,
Technical, Gameplay, Advertisement, Account integration), Basic Launch Guide,
SDK Introduction, Game Covers and Quality Guidelines pages. Still unread, and
worth a pass before submitting:

- **SDK module pages** — Video ads, Banners, Game, User, Data
- **Resources** — Mouse control, CrazyGames App / safe-area padding, Game
  Loading Tips, the ad monetization guides (the **Driving** one especially)
- **HTML5** — Sitelock, Common fixes
- FAQ & Contact, Payouts

## 11. Ad placement summary

| Placement | Trigger |
|---|---|
| Rewarded — revive | Game over, once per run, only above 400 points, and only when ads can actually serve |
| Rewarded — double coins | Game over |
| Coin revive (no ad) | Game over, 250 coins — the required alternative, and the only revive when ads are unavailable |
| Midgame interstitial | Every third run end, **and only when no revive is being offered** |

Under Basic Launch the platform disables all of it, and the game withdraws the
ad-funded offers rather than leaving them dead.

## 12. Store listing copy

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
> Desktop — Arrow keys or A/D to steer, or just move the mouse. That is the whole control.
> M to mute.
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
| `gameplayStart()` / `gameplayStop()` bracketing play | Yes, incl. menus, briefs, level-ups, ads, and a backgrounded tab. The first `gameplayStart` waits for the player's first steering input, i.e. once the onboarding hint has been answered |
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
