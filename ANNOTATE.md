# Screen one — the annotation overlay

Draft spec. No code written yet. This is the first of the two screens sketched in
the harness discussion, and the only one worth building until it proves itself.

Claude Code stays the agent. This does not replace it, wrap it, or talk to a model.
It is a capture device that drops files where Claude Code can read them.

---

## 1. The problem this solves

From 50 commits of building Neon Heat by vibe coding:

| Finding | Evidence |
|---|---|
| The agent cannot see its own output | 15 image refs in 9,685 lines — art is drawn in code, and the only reviewer was the human's eyes. `previewPursuit()` exists solely to render a contact sheet "for design review." |
| Feedback is prose about pixels | "The chase feels unescapable" cost two commits (`Make the chase escapable, and reprice a garage built for the old economy`) — the first read was wrong. |
| Nothing remembers what was approved | `Undo three tuning passes that between them removed the game's pressure`. Three commits shipped before a human noticed. |
| The bot harness watches but never speaks | `test/bots.mjs` logs ten fields at 60Hz, asserts nothing, is not in `npm test`. |

Root cause: **the channel from the human's eye to the agent's context is prose, and
prose is a bad encoding for something spatial that happened at a specific moment.**

---

## 2. The flow

You are playing. Something looks wrong. It has already scrolled past.

```
hit `      pauses, opens the overlay on the canvas
scrub        last 20 seconds, find the moment
drag         a box around the thing
type         one line — "this pursuit car never falls off"
enter        writes to .notes/, resumes the game
```

Next Claude Code turn, the note is in context: the frame with your box drawn on
it, the game state at that instant, and your line.

You never left the game. There is no second window.

---

## 3. Three pieces

### a. The recorder

`MediaRecorder` on `canvas.captureStream(30)`, in timeslice mode, keeping a ring
buffer of the last 20 seconds. Hardware-accelerated, cost is near zero — this is
why it is a video recorder and not a loop that copies canvases.

In parallel, a state snapshot at 8Hz into a plain array, timestamped off the same
clock as the recording start. Scrubbing seeks the video; the picked time maps to
the nearest snapshot.

This is the cheap version of "go back frame by frame." No seeded RNG, no fixed
timestep, no re-simulation. You are scrubbing a recording, not a simulation. You
give up "change a value and replay from here" — which is the expensive half and,
on the evidence above, not the half that was ever needed.

### b. The overlay

A `<div>` over the canvas. Video scrubber, drag-to-box, one text field. Roughly
200 lines. It is not a timeline editor and it does not get one.

Only active when `?dev=1`. Ships as dead weight or not at all.

### c. The sink

The browser cannot write to the repo, so a ~40-line local server accepts a POST
and writes files. Replaces `npx serve` in the dev loop.

---

## 4. The game contract

The only thing the next game must provide. Keep this small — it is the part that
has to be reimplemented for every game, so every method here is a tax.

```js
window.__HARNESS = {
  canvas,                  // what to record
  pause(),  resume(),
  snapshot(),              // → small JSON. The game decides what matters.
};
```

`snapshot()` is the one that needs judgement. For Neon Heat it would have been
roughly what `bots.mjs` already logs — district, stage, score, wall gap, hull,
level, pass, wrecks, road%. Small enough to paste, rich enough to explain a death.

Design the next game so this exists from hour one rather than being retrofitted
into a 9,685-line file.

---

## 5. Output

```
.notes/
  2026-08-07T14-22-03/
    frame.png       the frame, with your box drawn on it
    note.md         your line + the state snapshot as a table
    raw.json        box coords, timestamp, full snapshot
```

The box is burned into the PNG on purpose. One image costs ~1.5k tokens and
carries the region, the note's referent, and the visual evidence together — a
separate coordinate list would cost more and read worse.

`raw.json` is there so a script can use it later. Nothing reads it yet.

---

## 6. How Claude Code picks it up

**v1 — a file and a command.** `.notes/` sits in the repo. A `/notes` skill reads
everything unread, shows it, marks it read. You type `/notes` when you want me to
look. Dumb, obvious, works today, no new protocol.

**v2 — MCP, if v1 chafes.** A server exposing `list_notes` / `read_note` so I pull
them myself instead of waiting to be asked. Only worth it if you find yourself
typing `/notes` constantly.

Do not start at v2. The whole point of v1 is finding out whether the notes are
worth reading before building infrastructure to deliver them.

---

## 7. The other half — the approved record

Capture alone does not fix the three-tuning-pass regression. That was a memory
failure, not a bandwidth failure. Notes are input; something has to hold the
output.

```
APPROVED.md      screenshots you accepted, values you accepted and why,
                 invariants ("reader bot beats hunt by 2x")
```

Written by me, from your notes, at the end of a session. Read at the start of the
next one. This file is arguably the real product and the overlay is just how it
gets filled — but it is worthless without notes to fill it, so it comes second.

---

## 8. What this does not do

| Not doing | Why |
|---|---|
| Frame-stepping a live sim | Needs seeded RNG + fixed timestep + state/render split. Buy it in the next game's architecture, not in this tool. |
| Editing code | Claude Code and your editor already exist. |
| Asset review | That is screen two. Do not build it yet. |
| Non-canvas games | Recorder is canvas-only. Scope it and move on. |
| Anything with a file tree | This is the IDE tarpit. If this thing grows tabs, stop. |

---

## 9. Risks

**Self-critique plateaus.** Ask a model whether its own art looks good and it says
yes. Notes work because *you* are the judge. Any future step where I review my own
output needs a fixed reference to compare against, not an open question.

**Notes rot like comments.** A note from three weeks ago about code that changed
is worse than no note. `.notes/` should be read, folded into `APPROVED.md`, and
cleared — not accumulated.

**The recorder costs frame time.** `captureStream` is cheap but not free, and this
game already has an adaptive quality tuner that reacts to frame time. Measure it,
and keep it behind `?dev=1` so it never runs in a real session.

**It might just be faster to type.** The honest failure mode. Test it before
building the polished version.

---

## 10. Build order

1. Recorder + scrubber. No annotation, no writing. **Answers: is the moment I want
   still in the buffer when I reach for it?** If it never is, widen the buffer or
   abandon.
2. Box + note + POST + `.notes/`. Now it captures.
3. `/notes` skill. Now I read it.
4. Use it for a week on the real next game. Count how often you use it versus just
   typing. If typing wins, this doc was wrong and that is a cheap thing to learn.
5. Only then: `APPROVED.md`, then screen two.

Stop after any step that does not earn the next one.
