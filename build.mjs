/* Inlines style.css and game.js into index.html to produce two artefacts:
     dist/index.html     — self-contained single file, what you zip for CrazyGames
     dist/mockup.html    — body fragment for publishing as a shareable page
   index.html stays the source of truth; nothing is duplicated by hand. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');
const css  = read('src/style.css');
/* load order matters: game.js reads NHAudio and NHChips at definition time */
const SCRIPTS = ['src/audio.js', 'src/chips.js', 'src/game.js'];
const js = SCRIPTS.map(read).join('\n');

const body = html
  .match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/\s*<script src="src\/[a-z]+\.js"><\/script>/g, '')
  .trim();

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

fs.writeFileSync(path.join(ROOT, 'dist/index.html'),
  html
    .replace('<link rel="stylesheet" href="src/style.css">', `<style>\n${css}\n</style>`)
    .replace(/<script src="src\/audio\.js"><\/script>\s*<script src="src\/chips\.js"><\/script>\s*<script src="src\/game\.js"><\/script>/,
             `<script>\n${js}\n</script>`)
);

/* The hosted page wraps fragments in its own document shell, so this emits
   no doctype/html/head/body of its own. */
fs.writeFileSync(path.join(ROOT, 'dist/mockup.html'), `<title>NEON HEAT — playable prototype</title>
<style>
${css}

/* --- wrapper chrome, prototype only: not part of the game build --- */
body{overflow:auto;display:block;background:#02030A}
.pitch{
  max-width:calc(100vh * 16 / 9);margin:0 auto;padding:0 4vmin 8vmin;
  color:var(--ice);font-family:var(--sans);
}
.pitch h2{
  margin:7vmin 0 1.2rem;font-size:clamp(20px,2.6vmin,30px);font-weight:800;
  text-transform:uppercase;letter-spacing:.14em;color:#fff;
}
.pitch p{margin:0 0 1rem;max-width:62ch;line-height:1.65;color:var(--dim);font-size:clamp(14px,1.7vmin,17px)}
.pitch b{color:var(--ice);font-weight:700}
.grid{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
  gap:1.2rem;margin-top:2.4rem;
}
.card{
  border:1px solid var(--edge);border-radius:10px;padding:1.3rem 1.4rem;
  background:rgba(255,255,255,.025);
}
.card h3{
  margin:0 0 .6rem;font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;
  font-weight:800;color:var(--cyan);
}
.card p{margin:0;font-size:.9rem;line-height:1.6}
.play-note{
  display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;
  margin:1.6rem 0 0;font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;
  font-weight:700;color:var(--dim);
}
.play-note kbd{
  font:inherit;color:var(--ice);border:1px solid var(--edge);
  border-radius:4px;padding:.2rem .5rem;
}
</style>

${body}

<div class="pitch">
  <p class="play-note">
    <kbd>&#8592;</kbd><kbd>&#8594;</kbd> steer
    <kbd>Space</kbd> drift
    <kbd>Shift</kbd> nitro
    <span>— click the canvas first</span>
  </p>

  <h2>A drift roguelite, not another top-down racer</h2>
  <p>A score-attack drift game has no reason to exist next to a hundred others. This one is
  built as a <b>climb</b>: each district sets a quota you must bank before the checkpoint,
  clearing it lets you fit one chip from three, and every third district is a named pursuit
  unit with its own mechanic. The quota is what makes it a game rather than a toy &mdash;
  without it, the safe line is the boring line, and nothing forces you to slide.</p>

  <div class="grid">
    <div class="card">
      <h3>The bet</h3>
      <p>Drift points accrue into a pending bank that only pays out when you release. Wreck
      while holding a fat bank and it is gone. Every extra second of slide is a wager, and the
      quota is what makes you keep taking it.</p>
    </div>
    <div class="card">
      <h3>The build</h3>
      <p>Seventeen chips across four tags, stacking up to three deep. Some offers arrive
      <b>Overclocked</b> &mdash; a stronger chip welded to a permanent curse: narrower streets,
      heavier traffic, a hotter start, no nitro regen. The cost is always stated up front.</p>
    </div>
    <div class="card">
      <h3>The bosses</h3>
      <p>WARDEN rams and salts the road with spike strips. SIREN pulses, wiping any bank you
      let grow too fat. REAPER is faster than you and brings escorts. You damage them by
      banking &mdash; so the fight runs on the game's own verb.</p>
    </div>
    <div class="card">
      <h3>The sound</h3>
      <p>Every note is synthesised at runtime: a four-layer synthwave bed whose arrangement
      layers in as the run gets deeper and hotter, plus engine, tyre, siren and impact voices.
      No audio files, for the same reason there are no image files.</p>
    </div>
  </div>

  <h2>How it makes money</h2>
  <p>A ladder generates far better ad moments than a score chase. Rewarded revive lands when a
  player is deep into a run they have invested chips in &mdash; the highest-intent moment the
  format has. Coins pay out on districts cleared as well as score, so the rewarded double-up
  has a visible target. An interstitial sits every third run end. Everything routes through
  the CrazyGames SDK, with a simulated placement so the flow is demonstrable standalone.</p>
</div>

<script>
${js}
</script>
`);

console.log('built dist/index.html and dist/mockup.html');
