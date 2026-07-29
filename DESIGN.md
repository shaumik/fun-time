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
menu → ROUTE MAP ─┬─ Run   ─→ event (boon + bane) → drive → clear → level → back to map
                  ├─ Elite ─→ harder event, double XP, a bigger quota
                  ├─ Depot ─→ a free level, a full rebuild, or strip a curse. No driving.
                  └─ Boss  ─→ pursuit unit at the top of the act
        3 acts, each a fresh board. Wreck or miss a quota and the run ends.
```

**The route is the strategic layer.** A branching board per act, climbed bottom to top, with
two or three onward nodes at every step. An Elite costs more and pays more XP; a Depot
costs you a district of scoring but hands you a level or rebuilds the hull.

Node kinds are gated by depth, because a choice can be dead as easily as it can be
duplicated. A Depot on the opening row offers little — there are no curses to strip and a
free level is not worth skipping your first scoring district for — so the first two rows are
always Run against Elite, a straight safe-or-greedy opening, and Depots only appear once
there is a build to repair. The row before the boss drops Run entirely, making it the
familiar rest-or-push decision. A Depot also reads its own label at draw time: with nothing
fitted it promises a level and not a repair. If the board is not visible, none of
those are decisions — which is exactly what the first version got wrong: it was a straight
line with a card screen bolted on the end, and calling that a roguelite was generous.

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

**Events are chosen before you drive, not after.** Each pairs a boon with a bane, both
stated on the card, and each changes how the district *plays* rather than only what the
numbers say — Downpour cuts grip but pays +50% a bank, Blackout kills the city lights but
accelerates the multiplier, Ghost Town empties the streets and raises the quota 45%.
Risk is the currency, and what it buys is levels: a risk-1 event pays half again the XP, a
risk-2 event double. The safe opening pays none of that bonus, so playing it safe is a real
cost rather than a free option.

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

**Districts** get longer, hungrier and hotter. Quota grows 1.32× per district (×1.45 on an
Elite) *and* scales with a power index read from the save — total tuning levels, hardware
owned, run level. That second term matters: a fixed curve is tuned for exactly one loadout,
and measured against a maxed garage the quota was being met in the first fifteen to thirty
per cent of the road, so the checkpoint — the only fail state that is not a wreck — could
never fire and the back three-quarters of every district was scenery. The scaling is
deliberately sub-linear: power grows faster across a full save than the index does, so every
upgrade still makes the road easier without ever making it free. All of the growth lives in
the index rather than in the base curve, which means a brand-new save meets exactly the
numbers that shipped — only a player who has actually banked upgrades meets a harder road,
and the first run, the one that decides whether there is a second, is untouched.

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
metered or aimed, which is the only shape that fits a one-axis game. They spawn in the same
lanes as the traffic, so going for one is a line you have to choose rather than a button you
press.

| Pickup | Lasts | Does |
|---|---|---|
| Boost | 2.4s | Raw speed, and cracks convoy armour. |
| Repair | instant | A quarter of the hull back. |
| Ram Plate | 7s | Wrecks cost no hull. |
| Surge | 5s | **Stops the chain clock.** A licence to be greedy. |
| Magnet | 8s | Traffic on the road ahead steers onto your line. |
| Adrenaline | 5s | The world drops to 42% speed. You do not. |
| Wrecking Ball | 11s | A flail on a chain orbits your car, clearing both adjacent lanes. Costs no hull. |
| Arc Welder | 9s | Every wreck throws current to the nearest car, up to three hops. |
| Singularity | 5s | Plant a gravity well up the road and drive on while it harvests. |
| Escort Drones | 11s | Two drones hold station off your shoulders and burn cars down with tracking beams. |
| Escort Drones | 11s | Two drones hold station off your shoulders and burn cars down with tracking beams. |
| Bazooka | 4 shots | Auto-fires at the nearest car ahead every 0.9s. Free wrecks. |
| Frenzy | 8s | Every wreck pays double. |
| Phase Shift | 4s | Traffic passes through you; every pass-through pays as a thread. |
| Overdraft | 6s | Pending gains ×3, but any hit that is not a wreck halves the pending. |
| **Reinforced** | **the district** | +30 max hull, filled. |
| **Overclock** | **the district** | +1.2s on every chain clock. |
| **Payday** | **the district** | Wrecks pay the garage as well as the score. |
| **Scavenger** | **the district** | A courier drone fetches pickups and brings them to you. |

The last two run to the end of the district rather than on a timer, and they are rare on
purpose: a permanent upgrade found on the road is a much larger event than a few seconds of
speed, and finding two in one district should feel lucky rather than routine. The HUD reads
"level" rather than a countdown for those, and a shot count for the Bazooka.

Three of these are new mechanics rather than new numbers, and all three needed measurement
to get right.

The **Wrecking Ball** began as an honest pendulum: gravity toward the car, damping, a length
constraint. That is a spring, not a chain — it collapsed onto the roof and the measured
length fell from 190 to about ten. Fixed to pull-only it trailed correctly and hit *nothing*,
because behind you is exactly where every car is already wrecked. It orbits now, sweeping
both adjacent lanes, and the last problem was that it covers better than twenty units a
frame: a point test recorded a closest approach of 58 against a radius of 52 and landed no
hits at all in nine seconds. Sweeping the segment it travelled fixed it — seven of ten
wrecks now come from the ball while driving straight and aiming at nothing.

The **Singularity** was originally dropped where you stand, which harvested almost nothing:
you are doing 700 a second and everything behind you is already scrap, so the well spent its
life on empty asphalt. Planted fourteen nodes up the road it catches oncoming traffic, and
went from one kill to five.

The **Escort Drones** are a beam, not a turret, and the distinction is the whole design. The
Harpoon rack and the Bazooka are one-shot detonations on a cooldown; a beam has to *dwell*,
so it tracks its target across the road while you drive and you can watch it working, with
the burn mark growing as it bites. Two drones acquire independently — and a side bias alone
was not enough to keep them apart: measured, they shared a target on every frame both were
firing, so a car already being cut is now only chosen when there is genuinely nothing else in
range, which took overlap from 40% of frames to 11%.

The **Scavenger** is the only pickup that changes your *route* rather than your firepower.
With it aboard you stop swerving three lanes for a Boost, because the drone fetches it and
carries it back.

**Adrenaline** slows the world and not the player — traffic, pursuit and convoy all step on
a separate clock — because slowing the car too would take the thrill out of the thing the
power-up exists to celebrate.

The Magnet took two goes. A pure force on nearby traffic measured only 20% more convergence
than no magnet at all, because the traffic autopilot steers toward its own lane every frame
and simply corrected the shove away. Moving the lane they are steering *to* — and gating on
position along the road rather than a straight-line radius, which had been reaching only the
two nearest cars — gets them driving onto your line themselves, which both works and looks
like driving.

**Heat** rises with every bank. Each tier adds a pursuit unit and multiplies every payout,
so the correct play is always slightly more dangerous than the comfortable one.

**Perks** are the build, and there is exactly one track. Wrecks, banks and district clears
all pay XP; fifteen levels deep, three cards offered at each, drawn from a pool of
fifty-eight. Effects are declarative — every perk writes into one flat modifier table the
physics and scoring read each frame — so builds stack and interact without special cases
anywhere in the engine.

**Nine of them are weapons**, and that distinction is the point. The pool was forty-nine
cards and every one was a coefficient: the table multiplied harder, the clock ran longer,
the hull held more. Even the cards that named a toy only *extended* a toy you still had to
find on the road, so "singularities pull half again as hard" was a dead card on a run that
never saw a singularity. A weapon card grants the verb outright, from the moment you take
it. Kickoff launches the car you hit down the road as live ordnance that wrecks whatever it
bowls into — the game taking its own "traffic is ammunition" line literally, and the first
card that makes *where the lane goes* matter as much as which car you reach. Fuel Cell
makes your wreckage cook off a beat after it lands, so what you leave behind is a hazard
and the shape of the pile-up starts to matter. Tailgunner lays a burning wake, and is the
only card in the pool that points backwards — everything else rewards what is ahead, and
pursuit sits behind. The rest hand you the ball, the arc, the drones or a self-loading
rocket permanently, which is also what makes the eight amplifier cards worth drawing.

Measured against the same bot on the same track, a weapon roughly doubles the kill rate in
an eight-second window. So the first one is guaranteed rather than left to chance: until
you own a weapon, one of the three slots is reserved for one. Nine cards in fifty-eight
means an unlucky run could go six levels without seeing one, and that run would be right to
conclude the pool is all passive buffs — because for that player it was.

This used to be two systems. Chips were drafted after a district, perks on level-up, and
both were the same object: run-long modifiers picked from three cards, writing into the same
table. Seventeen of the twenty-two chips were literally a perk on the same axis, and the two
counters drifted — a run could finish holding twenty-one modifiers at level twelve, which
made the level cap meaningless and the XP bar a lie. They are one pool now, and the reward
for a clear is a lump of XP rather than a second card screen.

**Overclocked offers** pair a stronger perk with a permanent curse: narrower streets,
heavier traffic, a hotter start, brittle chains, a dry nitro tank, a tighter camera. At most
one per offer, never below level 4 and never on a common, and the cost is always stated on
the card. A hidden cost is not a choice.

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
| Rewarded — Revive | On any run-ending failure, once per run | A player deep in a run they have invested perks in is the highest-intent moment the format has — far better than reviving a score chase. |
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

## Levels

The addictive part of a roguelite is not the perk, it is the *cadence* of being handed a
choice. So there is a levelling track inside every run: **fifteen levels, three offers each,
drawn from a pool of fifty-eight.** No run sees the same board twice and two runs diverge
inside the first district.

XP comes off the things you were already doing — one per wreck (through *every* kill path,
weapons included), five per hauler, a lump per district cleared, and a slice of every bank —
so a level-up always reads as the reward for the last thirty seconds rather than for a menu
you walked through. The first level costs 26 XP so the first perk card lands ~20 seconds
into a first run; the curve totals ~1,180, which is roughly a full three-act run: capping is
an achievement, not a formality. Elites genuinely pay double XP, and **overtime** (below)
pays half again.

Perks are weighted deliberately toward the *toys* rather than the base numbers. "+9% top
speed" is a stat line; "your wrecking ball lasts two and a half times as long", "arc
lightning jumps two extra cars", "every district starts with escort drones" change what the
run *is*. Rarity odds shift with level, so late choices feel like the reward for having got
there — commons dominate before level 6 and rares are 38% of the table past level 11.

They stack live: taking a perk rebuilds the modifier table mid-district and relinks it to the
car, so a hull perk pays out the instant you take it rather than at the next brief.

| Layer | Lives for | Chosen |
|---|---|---|
| Perk | the run | On level-up, three at a time, fifty-eight in the pool |
| Contract | one district | Before you drive it |
| Hardware | forever | Bought in the garage |
| Crew rank | forever | Trained in the garage, fifteen ranks over three doctrines |

## Overtime

Meeting the quota used to clear the district on the spot — measured with a steering bot, a
skilled district was over at 32–40% of the road, so the better you played the less game you
got. The district is now *won* at the quota and *runs to the checkpoint* in overtime:
banking keeps paying, XP runs ×1.5, and a wreck in overtime is a limp to the checkpoint at
35% hull rather than a lost run. The back half of the road, which the best players never
used to see, is now exactly where the level-ups come from.

Dying mid-chain also salvages 40% of the pending bank. Chains run twenty seconds or more,
so at the moment of death an entire district's earnings used to be pending — measured,
nine of twenty deaths banked exactly zero, which starved the garage of the coins that make
the next run feel worth starting.

## Takedowns, and a road worth reading

Pursuit used to be the one thing on the road that was pure downside — invulnerable, in a
game whose thesis is that everything on the road is ammunition. Units now carry three
armour pips: ram them while boosted or plated, or catch them with the ball, a shockwave, a
blast or a slick. A takedown pays a chain link, 120 garage coins on the spot, and vents
0.6 heat — hunting the hunters trades income (the heat payout multiplier) for breathing
room, which is a real decision rather than a free lunch.

Traffic itself now has three special archetypes worth *choosing*: **tankers** whose payload
cooks off a beat after you crack them — free positional AoE; **armored cars** that bounce a
cruising bump exactly like a hauler and burst with coins when cracked properly; and at Heat
2+, **kamikaze bikes** that hunt the player and pay double if wrecked first.

## The Loop

Every act-3-or-later boss clear offers a choice: cash out a finished city, or arm **THE
LOOP** and keep driving. Acts keep climbing — a fourth storm-front theme (The Causeway)
enters the rotation, quotas keep compounding, bosses keep cycling with fatter integrity —
until the hull gives out. The ceiling is the player, and the board records how deep the
loop went.

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
| Harpoon Rack | 9,000 | Auto-fires every 9s: detonates the nearest car ahead, free. |
| Shock Plating | 14,000 | Every fifth link in a chain detonates everything around you. |
| Black Box | 22,000 | Start every district with a Ram Plate already fitted. |

Prices were re-laddered against a *capped* coin economy. Coins used to track raw score,
which is superlinear in skill: a god run paid 156,000 while a casual one paid 1,300, so any
price tuned for one starved the other. The score term is now capped and the floor comes
from wrecks and districts cleared — a casual run pays much what it always did, a god run
pays an eighth, and the worst-case grind for any single item is four to six runs with the
daily drop closing the gap.

**The Crew** is the garage's third tier and its long sink: fifteen permanent ranks across
three doctrines — Offense (wreck pay, First Blood, Opening Salvo, wider blasts, boss
damage), Defense (hull, cheaper walls, faster heat decay under pressure, one survived
crash per run) and Greed (coins, XP, the daily drop, heat payout, starting at level 2).
~150,000 coins to finish. Every rank is felt in-run, and the quota index counts crew ranks
so training never makes the road free. **The Paint shop** sells six liveries; body, glow
and light-ribbon all read their colour from the fitted livery.

**Meta-progression must never be a tax.** Measured head-to-head with an identical bot, the
old quota index made a fully-tuned save *fail* districts a fresh save cleared — the index
grew 2.35× against income growth of ~1.9×. The per-level and per-gear coefficients were
halved; the index now tops out ~1.7× and an upgrade is always a net gain.

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

Coins, tuning and hardware persist across runs; the perk build inside a run does not.
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
driven by an LFO, and one-shots for banking, threads, pickups, perk picks, curses and boss
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
overclocked — used identically on perk cards and the in-run build rail.

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

All UI is DOM rather than canvas, so menus, the HUD and the perk cards stay pixel-sharp
regardless of render scale. Only the game world softens.

## Scope of this prototype

Built: full drift model with self-aligning torque, procedural districts, quota and boss
objectives, three boss archetypes with distinct mechanics, 58 perks and 6 curses with a
level-weighted offer, traffic and pursuit AI, spike-strip hazards, off-screen threat indicators,
particles and decals, bloom pipeline with adaptive quality, synthesised music and SFX,
garage with four cars and four upgrade tracks, localStorage persistence, and a
responsive layout with keyboard and touch input.

Not built: leaderboards, daily rewards, a tutorial, and banner ads. The SDK integration is
verified against a mock covering every call and callback, but has not run against the real
SDK — that needs one pass on their platform.
