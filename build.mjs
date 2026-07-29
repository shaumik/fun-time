/* Inlines style.css and game.js into index.html to produce two artefacts:
     dist/index.html     — self-contained single file, what you zip for CrazyGames
     dist/mockup.html    — body fragment for publishing as a shareable page
   index.html stays the source of truth; nothing is duplicated by hand. */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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
   no doctype/html/head/body of its own.

   The page around the game is a dispatch file rather than a card grid: the
   game's own vernacular down a left rail, prose to the right, hairline
   ruled. Committed single-theme for the same reason the game is — this is a
   cabinet screen, not a document, so it does not answer the light toggle.
   No webfont either: a page whose headline claim is "zero asset files"
   cannot itself pull one down. Weight and tracking do that work instead. */
fs.writeFileSync(path.join(ROOT, 'dist/mockup.html'), `<title>NEON HEAT — playable</title>
<style>
${css}

/* --- page chrome, shareable build only: not part of the game --- */
html{color-scheme:dark}
html,body{background:#02030A}
body{overflow:auto;display:block}

.file{
  --rail:13rem;
  /* the game's --dim is a HUD colour: correct behind a glow, too quiet for a
     paragraph of body copy on this ground */
  --read:#98A7C2;
  max-width:64rem;margin:0 auto;padding:0 5vmin 12vmin;
  color:var(--ice);font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
}

/* The one-axis control is the thesis, so it gets the first line, full width.
   Everything under it hangs off the same two verticals as the file rows —
   a ledger only reads as one if the columns actually line up. */
.thesis{
  display:grid;grid-template-columns:var(--rail) 1fr;gap:1.6rem 2.6rem;
  padding:3rem 0 2.6rem;border-bottom:1px solid var(--edge);
}
.thesis h1{
  grid-column:1 / -1;margin:0;max-width:22ch;
  font-size:clamp(1.8rem,5vw,3rem);font-weight:800;
  letter-spacing:-.034em;line-height:1.03;color:#fff;text-wrap:balance;
}
.thesis h1 em{font-style:normal;color:var(--cyan)}
.thesis > div{grid-column:2;max-width:62ch}
.thesis p{margin:0;font-size:1rem;line-height:1.7;color:var(--read)}
.keys{display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;margin-top:1rem}
.keys kbd{
  font:inherit;font-size:.72rem;font-weight:700;letter-spacing:.08em;
  color:var(--ice);background:rgba(110,170,255,.07);
  border:1px solid var(--edge2);border-radius:3px;padding:.25rem .55rem;
}
.keys span{
  font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--dim);font-weight:700;
}

/* measured numbers, not adjectives */
.spec{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));
  gap:1.6rem 2rem;padding:2.2rem 0;border-bottom:1px solid var(--edge);
}
.spec div{display:flex;flex-direction:column;gap:.4rem}
.spec b{
  font-size:1.9rem;font-weight:800;letter-spacing:-.02em;line-height:1;
  color:var(--amber);font-variant-numeric:tabular-nums;
}
.spec span{
  font-size:.66rem;letter-spacing:.24em;text-transform:uppercase;
  font-weight:700;color:var(--dim);
}

/* the file itself: vernacular key on the rail, prose to the right */
.row{
  display:grid;grid-template-columns:var(--rail) 1fr;gap:1rem 2.6rem;
  padding:2.5rem 0;border-bottom:1px solid var(--edge);
}
.row > h2{
  margin:0;font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;
  font-weight:800;color:var(--cyan);line-height:1.95;
}
.row > div{display:flex;flex-direction:column;gap:1rem;min-width:0}
.row p{margin:0;max-width:62ch;font-size:1rem;line-height:1.72;color:var(--read)}
.row p b{color:var(--ice);font-weight:700}
.row p i{font-style:normal;color:var(--magenta);font-weight:700}

.foot{
  margin:0;padding:2.4rem 0 0;max-width:52ch;
  font-size:.78rem;letter-spacing:.1em;color:var(--dim);line-height:1.9;
}

@media (max-width:720px){
  .row,.thesis{grid-template-columns:1fr;gap:.75rem;padding:2.1rem 0}
  .thesis > div,.thesis h1{grid-column:1}
  .thesis{gap:1.2rem;padding:2.4rem 0 2.1rem}
  .row > h2{line-height:1.4}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms !important;transition-duration:.01ms !important}
}
</style>

${body}

<div class="file">
  <div class="thesis">
    <h1>Steering is the <em>whole</em> control.</h1>
    <div>
      <p>No handbrake, no boost button, no brake pedal. You point the car and drive through
      the traffic in front of you — the slide comes on by itself above 420, and hitting a
      rail square reverses you out without a reverse control to press.</p>
      <div class="keys">
        <kbd>&#8592;</kbd><kbd>&#8594;</kbd><span>or A / D</span>
        <span>&mdash; on glass, drag anywhere</span>
      </div>
    </div>
  </div>

  <div class="spec">
    <div><b>86</b><span>KB, zipped</span></div>
    <div><b>0</b><span>image files</span></div>
    <div><b>0</b><span>audio files</span></div>
    <div><b>58</b><span>perks in the pool</span></div>
  </div>

  <div class="row">
    <h2>The verb</h2>
    <div>
      <p>Traffic is ammunition, not scenery. You do not dodge cars, you wreck them, and
      every wreck adds a link to a chain and resets a clock a little over three seconds
      long. Let the clock run out and the whole pile banks at once. <b>Get hit before then
      and it burns clock rather than links</b> — the pile is still yours, you just have
      less time left to keep feeding it.</p>
      <p>That one rule is what makes the safe line the losing line. There is always a car
      you could reach if you committed, and the clock is always the reason not to wait.</p>
    </div>
  </div>

  <div class="row">
    <h2>The climb</h2>
    <div>
      <p>Three acts, each a branching board you climb bottom to top: Run, Elite, Depot, and
      a named pursuit unit at the summit that you damage by banking into it, so the fight
      runs on the game's own verb. Every district sets a quota you have to bank before the
      checkpoint, and you choose the <b>event</b> you drive under first — a boon welded to
      a bane, both stated on the card. Downpour cuts your grip and pays half again a bank.
      Ghost Town leaves a third of the traffic and triples every wreck. <i>Risk is what
      buys levels</i>: half again the XP at risk 1, double at risk 2, so the quiet option
      costs you something real.</p>
      <p>Quotas read your actual strength — tuning bought, hardware fitted, level reached —
      rather than sitting on a fixed curve, so an upgrade always makes the road easier
      without ever making it free. A brand-new save meets the gentlest version of it.</p>
    </div>
  </div>

  <div class="row">
    <h2>The build</h2>
    <div>
      <p>Wrecks, banks and clears all pay XP into one track: fifteen levels, three perks
      offered at each, drawn from fifty-eight. <i>Nine of them are weapons</i>, and you own
      them outright rather than waiting on a pickup — Kickoff launches the car you just hit
      down the road as live ordnance that wrecks whatever it bowls into, Fuel Cell makes
      your wreckage cook off a beat after it lands, Tailgunner lays a burning wake that
      anything following you drives into. The rest hand you a wrecking ball on a chain, arc
      lightning that hops car to car, or two escort drones, permanently.</p>
      <p>Some offers arrive <b>Overclocked</b>: stronger, welded to a permanent curse —
      narrower streets, heavier traffic, a hotter start. The cost is always on the card. And
      hull carries between districts, so a run wears down rather than resetting at every
      line, which is what makes the depot's rebuild worth the district you skip for it.</p>
    </div>
  </div>

  <div class="row">
    <h2>The garage</h2>
    <div>
      <p>Coins from a run you lost still buy something you keep. The garage is a bay rather
      than a form: your car on the deck, wearing every part you have bolted to it. Six
      tuning tracks and six pieces of hardware that change a verb rather than a number — a
      harpoon that auto-fires into the nearest car, plating that detonates everything
      around you every fifth link, a welder that repairs the hull between chains.</p>
    </div>
  </div>

  <div class="row">
    <h2>The sound</h2>
    <div>
      <p>Every note is synthesised at run time. A synthwave bed that layers in as the run
      gets deeper and hotter, an engine that is a low EV hum rather than a chainsaw, and
      one-shots for banking, threading a gap, pickups, perk picks and curses. No audio
      files, for the same reason there are no image files.</p>
    </div>
  </div>

  <div class="row">
    <h2>The money</h2>
    <div>
      <p>A climb generates better ad moments than a score chase does. The rewarded revive
      lands on a player nine districts and eleven perks into a run they do not want to lose
      — the highest-intent moment the format has. Coins pay out on districts cleared as
      well as on raw score, so the rewarded double-up has a visible target, and an
      interstitial sits at every third run end. All of it routes through the CrazyGames
      SDK, with a simulated placement so the flow stays demonstrable off-platform.</p>
    </div>
  </div>

  <p class="foot">
    Everything above this line is running, not described. Zero asset files — every pixel
    and every note is generated at run time.
  </p>
</div>

<script>
${js}
</script>
`);

/* The submission artefact: a zip with index.html at its root, and nothing
   else in it. dist/mockup.html is deliberately excluded — it is the
   shareable pitch page, not the game build. */
const dist = path.join(ROOT, 'dist');
const zip = path.join(dist, 'neon-heat.zip');
fs.rmSync(zip, { force: true });
execSync('zip -q -X neon-heat.zip index.html', { cwd: dist });

const kb = n => (fs.statSync(n).size / 1024).toFixed(1) + ' KB';
console.log('dist/index.html    ' + kb(path.join(dist, 'index.html')) + '   (self-contained game)');
console.log('dist/mockup.html   ' + kb(path.join(dist, 'mockup.html')) + '   (shareable pitch page)');
console.log('dist/neon-heat.zip ' + kb(zip) + '   <- upload this to CrazyGames');

/* guard the two things that would fail their review silently */
const built = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const ext = [...built.matchAll(/(?:src|href)="(https?:)?\/\/([^"]+)"/g)].map(m => m[2]);
const stray = ext.filter(u => !u.startsWith('sdk.crazygames.com'));
if (stray.length) console.warn('WARNING external requests besides the SDK: ' + stray.join(', '));
if (!built.includes('sdk.crazygames.com')) console.warn('WARNING the SDK script tag is missing from the build');
