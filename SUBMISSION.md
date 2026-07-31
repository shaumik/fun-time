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
| `dist/mockup.html` | The shareable pitch page. **Not** part of the submission. |

The build warns if anything other than the CrazyGames SDK would be requested at
runtime, or if the SDK tag went missing.

## 2. Technical requirements

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
`init → loadingStart → loadingStop → addSettingsChangeListener → gameplayStart`,
and on a rewarded ad: `gameplayStop → requestAd:rewarded → adStarted → adFinished`.

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
> Desktop — Arrow keys or A/D to steer, or just move the mouse. That is the whole control.
> M to mute.
> Mobile — touch anywhere and drag sideways to steer. Nothing else to press. Hit a rail
> head-on and the car reverses out by itself.

**Suggested tags:** driving, racing, drift, crash, destruction, roguelite, arcade, 1 player, singleplayer
