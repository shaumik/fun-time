# NEON HEAT — design & monetization brief

**One line:** A demolition roguelite you play with one axis. Steer — that is the entire
control surface — ram traffic to build a chain, and race a clock that resets with every
wreck, climbing a ladder of city districts on a hull you spend rather than protect.

---

## Why this concept

**The genre problem first.** A top-down drift game that is only score-attack has no reason
to exist next to the hundred already on the platform. Polish alone does not differentiate —
it has to be a different *kind* of game. Two things make it one.

The roguelite ladder is the first, and it solves a concrete design failure on the way:
without a quota, nothing forces the player to drift, so the safe line is the boring line and
the whole game is optional. The quota makes the risk mandatory.

The second is that **traffic is ammunition rather than obstacle**. Dodging is the default
verb of every top-down driving game there is, and it is a verb of avoidance: the best
outcome is that nothing happens. That is why the first playable version of this was
correctly called boring — a clean lap was the optimal lap, and a clean lap has no moment in
it. Ramming inverts the sign. The best outcome is a four-car pile-up you chose to cause, and
the cost is a hull bar that only ever goes down. What used to be a hazard to route around is
now the thing you aim at, and the road stops being empty.

**The art constraint second.** Hand-drawn sprites made without an illustrator are the most
common reason a self-published web game looks cheap. So there are no image files, and no
audio files either. Everything is generated at runtime, and the polish comes from a
rendering pipeline and a synthesiser rather than from assets. Nothing can look or sound
amateur because there is nothing authored to be bad.

**The platform third.** Driving is CrazyGames' strongest evergreen category behind .io, and
unlike .io it needs no servers and no concurrency floor to feel alive.

## The run

```
menu → ROUTE MAP ─┬─ Run   ─→ contract (boon + bane) → drive → clear → draft → back to map
                  ├─ Elite ─→ harder contract, rare chip guaranteed
                  ├─ Depot ─→ fit a free chip, or strip a curse. No driving.
                  └─ Boss  ─→ pursuit unit at the top of the act
        3 acts, each a fresh board. Wreck or miss a quota and the run ends.
```

**The route is the strategic layer.** A branching board per act, climbed bottom to top, with
two or three onward nodes at every step. An Elite costs more and pays a rare chip; a Depot
costs you a district of scoring but repairs your build.

Node kinds are gated by depth, because a choice can be dead as easily as it can be
duplicated. A Depot on the opening row offers nothing — there are no curses to strip and a
free chip is not worth skipping your first scoring district for — so the first two rows are
always Run against Elite, a straight safe-or-greedy opening, and Depots only appear once
there is a build to repair. The row before the boss drops Run entirely, making it the
familiar rest-or-push decision. A Depot also reads its own label at draw time: with nothing
fitted it promises a chip and not a repair. If the board is not visible, none of
those are decisions — which is exactly what the first version got wrong: it was a straight
line with a draft bolted on the end, and calling that a roguelite was generous.

**Every node states its terms on its face** — the place, what clearing it pays, the quota it
demands and the Heat it adds. The first pass drew the board as bare dots labelled RUN and
ELITE, which meant a fork between two Runs offered the player nothing to reason about. A
choice you cannot evaluate is not a choice, so siblings in a row are generated as *distinct*
kinds rather than sampled independently, and every place on the board gets its own name.

The board is drawn as a **transit map over a street plan**, not a flowchart. Routes run as
street sections — up, across, up — with rounded corners, because right angles are far easier
to trace than a field of crossing diagonals, and because a city is the right metaphor for a
game about driving through one. Stations are pins whose *ring colour, icon and size* all
carry the node's kind: Slay the Spire's map is widely criticised for exactly the opposite —
small symbols with no distinction in size or colour, so players have to comb each path, and
the community's own fix was to colour-code it. Routes are anchored to the top and bottom of
each node block rather than to the pin, so a line never crosses the label it belongs to.

**Contracts are chosen before you drive, not after.** Each pairs a boon with a bane, both
stated on the card, and each changes how the district *plays* rather than only what the
numbers say — Downpour cuts grip but pays +50% a bank, Blackout kills the city lights but
accelerates the multiplier, Ghost Town empties the streets and raises the quota 45%.
Risk is the currency: a risk-2 contract clears into a rare chip and a four-card draft, a
safe one into a standard three.

**Each act is a different city.** Every act used to drive through the same cyan-and-magenta
downtown, so a run that was escalating numerically looked identical the whole way up — which
is exactly what makes a roguelite feel like one level on repeat. Each act now has its own
ground, asphalt, barrier colours, skyline and air:

| Act | Place | Reads as |
|---|---|---|
| 1 | The Grid | Cyan and magenta, tall glass towers, clean air. |
| 2 | Sunken Docks | Amber and green rails, warm dark asphalt, long low warehouses, fog banks drifting across. |
| 3 | The Undercity | Violet and white, near-black ground, tall blocks crowding both sides, embers falling past. |

The generator is untouched; only what it is dressed in changes. That is the cheapest large
change available — the road you drive is identical, and the place you are driving through
is not.

**The convoy** is the thing in a district worth *wanting*. A district used to have exactly
one objective and it was a number — hit the quota, move on — with nothing in it you would go
out of your way for. A quarter of the way in, three armoured haulers are announced and run
in formation down one lane. They outpace ordinary traffic, so catching them is a decision to
commit; their armour bounces a bump at cruising pace, so cracking one needs Boost, a Surge,
or genuine speed; and they are gone if you dawdle. Every district now has a second question
in it: *did I take the convoy?*

The completion bonus is pegged to a quarter of the district's quota rather than to the
multiplier. Multiplied it paid 26,000 against a 7,000 target and turned the district into a
formality; as a fraction of what you actually need it stays a strong prize at any depth
without ever replacing playing the district. In testing a bot cracked two haulers, took the
third, and died with 8,788 unbanked — which is the shape the event should have.

**The road never empties.** Two things used to thin it out. Wrecked cars stayed in the
traffic budget as debris until you had driven past them, so a good pile-up starved the next
one — the supply dropped exactly when you were doing well. Only live cars count now. And
Ghost Town removed traffic *entirely*, which was a boon when the game was about dodging and
a loss condition once traffic became the thing you score on: zero cars is zero points, so
the contract was not hard, it was unwinnable. It now leaves a third of the traffic and pays
triple per wreck — the same flavour, inverted into a real wager.

**Districts** get longer, hungrier and hotter. Quota grows 1.30× per district (×1.45 on an
Elite) while the player's build grows through chips — the two curves are meant to stay
close, so a run ends when the build stops keeping up rather than at a fixed wall.

**One axis.** There is no handbrake and no nitro button. Steering is the whole control
surface, on keyboard and on glass alike. Three things follow. The slide is *automatic* —
lean hard on the wheel above 420 and the tail comes round on its own, so the car still
looks and sounds like the same car without asking you to operate it. Turn authority had to
be retuned to sit between the old gripped and drifting rates: set at the full drifting rate
the car became twitchy, and every correction overshot into a barrier.

And the car reverses itself. Square onto a rail and the nose has nowhere to go — throttle
only presses you harder into it and the run ends sitting still, which is a failure the
player cannot act on. There is no pedal to add, so the car backs out on its own after a
third of a second pinned, rotating toward the road as it goes, because reversing out still
pointing at the wall solves nothing. It triggers only when the nose is actually *aimed* at
the barrier, so crawling along the edge on purpose does not hand you a reverse you did not
ask for.

**The chain clock.** With no button to release, the wager moved onto a timer. Every wreck
resets a ~3.2s clock and adds a link; let it run out and the entire pending bank pays
automatically. The question stopped being *when do I let go* and became *can I reach one
more car before this hits zero* — the same bet, asked several times a minute instead of
once a district. The multiplier is the chain length, so the first car pays ×1 and every one
after it pays more than the last, and since one more wreck is also one more bite out of the
hull, greed and survival pull against each other continuously.

Getting hit burns *clock*, not links. Docking the chain itself would drop the multiplier by
an amount the player never sees coming; taking seconds off the timer says exactly what it
costs. Threading a gap does the reverse — it pays thin and puts a slice of the clock back,
which is how you carry a chain across a hole in the traffic when your hull cannot afford
another wreck.

**Hull is the resource you spend, not the health you protect.** It starts at 100, a wreck
costs about nine, and banking welds some back on — more for a big pile-up than a lone hit,
but never as much as it cost, so the trend is always down and the run always has a clock.
Threading a gap instead of driving through it pays thin and costs nothing, which is what
lets a player on a thin hull keep a chain alive rather than simply losing. Walls are
deliberately *not* the main sink: clipping a barrier while learning should not read as the
same class of event as choosing to hit something.

**Power-ups** lie on the road and fire the instant you touch them — nothing is held,
metered or aimed, which is the only shape that fits a one-axis game. Boost is raw speed;
Repair gives back a quarter of the hull; Ram Plate makes wrecks free for seven seconds;
Surge *stops the clock*, which is a licence to be greedy. They spawn in the same lanes as
the traffic, so going for one is a line you have to choose rather than a button you press.

**Heat** rises with every bank. Each tier adds a pursuit unit and multiplies every payout,
so the correct play is always slightly more dangerous than the comfortable one.

**Chips** are the permanent build, drafted *after* a district — the counterpart to
contracts, which are temporary and chosen before. Seventeen across four tags (Engine, Chain, Combo, Heat, Risk, Defence), stacking
up to three deep. Effects are declarative — every chip writes into one flat modifier table
the physics and scoring read each frame — so builds stack and interact without special
cases anywhere in the engine.

**Overclocked offers** pair a stronger chip with a permanent curse: narrower streets,
heavier traffic, a hotter start, brittle chains, a dry nitro tank, a tighter camera. At most
one per draft, never on district 1, and the cost is always stated on the card. A hidden cost
is not a choice.

**Bosses** every third district, damaged only by *banking* into them — the fight runs on the
game's own verb rather than bolting on a new one. Their integrity was raised with the
switch to wreck income; at the old numbers a boss died to two chains, and it now takes a
sustained fight where the hull bar and the integrity bar race each other down.

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

## Records, and why there is no global board

CrazyGames does have a leaderboard, but it is a **server-to-server** API: scores are POSTed
to `leaderboard.crazygames.com` from your own backend, authenticated with a secret key. This
game is a single HTML file with no backend, and shipping that key inside the bundle would
hand it to anyone who opens devtools — so there is no global board here, and faking one would
be worse than not having it.

What there is instead is a board of your own ten best runs: score, district reached, cars
wrecked, and how long ago. It carries the "beat that" job on its own — the game-over screen
states your rank rather than only showing a best-ever badge you may never earn, and the run
you just finished is highlighted in the table so you can find yourself without counting.
Because CrazyGames syncs `localStorage` to a signed-in account, the board follows the player
across devices without any code.

`submitScore()` in `src/game.js` is the single seam a backend would plug into. If the SDK's
user module is present the player's portal username titles the board; everywhere else it
stays anonymous and nothing breaks.

## Monetization

| Placement | Trigger | Notes |
|---|---|---|
| Rewarded — Revive | On any run-ending failure, once per run | A player deep in a run they have invested chips in is the highest-intent moment the format has — far better than reviving a score chase. |
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

**A revive has to undo the thing that killed you.** For a long time it did neither: the hull
was left on zero, so the next scrape ended the run again, and a missed quota put the player
back down *past* the checkpoint, which re-fired the same failure on the following frame — an
ad watched for nothing, which is the worst possible thing to sell. There are two kinds of
death and they need two different repairs. Hull is restored to 60%, and a district that ran
out of *road* rather than hull has its checkpoint pushed back by half its length, because
road is what you were short of. The extension can only ever lengthen the district, never
shorten it.

Banner ads are deliberately not wired. See [SUBMISSION.md](SUBMISSION.md).

## The garage

A roguelite that only resets is a roguelike. The garage is the other half of the contract:
it sits *between* runs rather than off to one side, so a run that ended badly still paid for
something you keep, and the next attempt starts further along. Every path into a run goes
through it — the menu's Start Run, the game-over screen's primary action, and Enter.

**One car.** Four selectable chassis were four stat rolls saying what the tuning tracks
already said — a choice between numbers rather than between ways to play, and it forced the
tuning tracks to stay weak so the chassis choice still mattered. Removing it cost nothing
that Engine and Impact do not now carry, and the silhouettes stay in the game as the traffic
and pursuit pool.

Two tiers of spend: **tuning** (six tracks, five levels each, stated in units rather than
pips — 371 km/h, 164 hp) and **hardware**, bought once, fitted forever, each changing a verb
rather than a number.

**It is a bay, not a form.** The left half is a rendered deck — poured plates, oil, work
lights, hazard chevrons, tyre marks leading out — with your actual car on it wearing every
part you have bought. The ram bar sits across the nose, the harpoon tubes run down the roof,
the welder bottle is strapped to the boot. Buying a part changes the picture, which is the
only reason to have a picture at all. Everything is drawn at runtime, like the rest of the
game; there is still not a single image file.

The right half is the work order, and the action bar is pinned above both. The first version
of this screen put **Roll out** at the bottom of a 1,300px scroll, behind everything you
might buy; now the way out and the balance you are spending never move. Anything out of
reach states the shortfall as a number rather than just dimming.

| Hardware | Cost | What it does |
|---|---|---|
| Ram Prow | 2,400 | Wrecks pay +25% and cost a fifth less hull. |
| Scrap Welder | 4,200 | Hull repairs itself whenever no chain is running. |
| Turbine Intake | 7,000 | Grabbing a Boost adds two links to a live chain. |
| Harpoon Rack | 12,000 | Auto-fires every 9s: detonates the nearest car ahead, free. |
| Shock Plating | 20,000 | Every fifth link in a chain detonates everything around you. |
| Black Box | 32,000 | Start every district with a Ram Plate already fitted. |

The Harpoon deliberately has no fire button. An active weapon would put back exactly the
kind of control the rest of this pass took out, and a top-down auto-cannon reads as
generous rather than passive — you still choose the line that puts a car in front of it.

**The first run is not empty.** A new player used to land in the garage with no coins,
nothing to buy and a bare car — the weakest possible first impression, given to everyone.
The Ram Prow is now free on the first Play. It costs the economy almost nothing and it means
the opening minute shows the game doing the thing the game is about.

**The daily drop** is the reason to open the tab tomorrow: 900 coins on day one, climbing to
6,300 on a seven-day streak and plateauing there, because an unbounded ramp only rewards the
player who was never going to quit. It pays on the calendar day rather than a rolling 24-hour
timer, so the claim never drifts later and later, and the streak survives a missed day —
punishing a single miss is how you lose the player who was going to come back on Wednesday.

Coins, tuning and hardware persist across runs; the chip build inside a run does not.
The roguelite layer resets, the garage layer does not.

## Audio

Fully synthesised, no files. A four-layer synthwave bed over an i–VI–III–VII vamp at 126 BPM,
whose *arrangement* is the intensity dial: the tune, the bass line and the arpeggio carry it,
and escalation opens the filter and brings in the pad.

**The kit sits well back.** A kick on every quarter with eighth-note hats over it is a drum
machine playing at you for the length of a run. The kick is on 1 and 3 only, hats do not
appear until Heat 2 and then only on quarters, and every drum voice is mixed roughly half
what it was. An earlier attempt replaced the whole bed with an ambient score, which was the
wrong lesson entirely — the tune was never the problem, the drumming was.

**The car is a distant electric drivetrain with its own switch.** Two detuned triangles
54 Hz idling to about 150 Hz flat out, a quiet inverter partial, a sine hum underneath and
slight vibrato, under a lowpass that never opens past ~530 Hz. At full speed the 2–5 kHz band
measures 72 dB below the low band. It is the one voice playing without pause for an entire
run, so it gets a dedicated toggle: engine off measures exactly zero with the music
unchanged.

**Impacts are weight, not brightness.** The wreck sound was band-passed noise from 1.8 kHz
plus a square wave through a 900 Hz high-pass — a square's odd harmonics with the body
stripped out, which is buzz and nothing else, on the most frequent event in the game. It is
now a lowpass sweeping 1.1 kHz down to 180, a sine thump falling to 32 Hz, and two detuned
triangles low in the midrange for sheet metal. Measured: 40 dB of rolloff from the body of
the hit to the 4–14 kHz band.

The remaining voices are tyre squeal (band-passed noise following slip), a two-tone siren
driven by an LFO, and one-shots for banking, threads, pickups, chip picks, curses and boss
stingers.

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

Three details make it survivable in practice.

The anchor trails the thumb, so the stick never saturates somewhere you cannot reach.

**Travel and response curve matter more than anything else.** The first version put full
lock at 13% of screen width — about 50px on a phone — with a linear response, so the gap
between a lane change and full opposite lock was a thumb twitch and holding a line was
guesswork. Full lock is now at 26% of width (about 100px), with a 7% deadzone and a squared
response: 32px of thumb gives 12% of steering, and full lock is still there at the end of
the travel. Driving the game entirely through the touch layer, a plain proportional
controller now holds the centre line to about 10% of the road width at top speed and never
leaves the road.

And the stick draws itself the moment you touch: a target-free control you cannot see is a
control you cannot learn. A ring marks the anchor, a dot follows the thumb, and a separate
tick shows what the car is actually being given — after the response curve those are not
the same place, and hiding that would make the curve feel like lag.

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

It comes down in proportion to how far off budget it is, not in a fixed step. Cost goes
with area, so the scale that would hit the target is about sqrt(target/actual) — a machine
at 12fps reaches a holdable scale in one correction rather than four, which matters because
those four corrections were about five seconds of visible chop and they were the first five
seconds the player ever saw. Overshooting downward is cheap: the climb back is gentle and
continuous, and only runs when there is measured headroom.

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
