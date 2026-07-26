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
const js   = read('src/game.js');

const body = html
  .match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/\s*<script src="src\/game\.js"><\/script>/, '')
  .trim();

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

fs.writeFileSync(path.join(ROOT, 'dist/index.html'),
  html
    .replace('<link rel="stylesheet" href="src/style.css">', `<style>\n${css}\n</style>`)
    .replace('<script src="src/game.js"></script>', `<script>\n${js}\n</script>`)
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

  <h2>Why this one</h2>
  <p>Hand-drawn sprites made without an illustrator are the single most common reason a
  self-published web game looks cheap. So there are no image files here at all. Every pixel
  is generated at runtime &mdash; the car, the city, the road, the light &mdash; and the polish comes
  from a real bloom chain, particle work and camera behaviour rather than from artwork.
  <b>Nothing can look amateur, because there is no art to be amateur.</b></p>

  <div class="grid">
    <div class="card">
      <h3>The bet</h3>
      <p>Drift points accrue into a pending bank that only pays out when you straighten up.
      Crash while holding a big bank and you lose all of it. Every extra second of slide is
      a wager you choose to keep making.</p>
    </div>
    <div class="card">
      <h3>The chase</h3>
      <p>Banking raises Heat, and each Heat tier puts another police unit behind you &mdash; but
      also multiplies every payout. The greedy line and the safe line are never the same line.</p>
    </div>
    <div class="card">
      <h3>The money</h3>
      <p>Runs last 45&ndash;90 seconds, which puts a rewarded revive and an interstitial close
      together without either feeling like a wall. Coins buy cars and four upgrade tracks &mdash;
      progression is what turns one session into a returning player.</p>
    </div>
    <div class="card">
      <h3>The platform fit</h3>
      <p>Driving is CrazyGames' strongest evergreen category after .io, and unlike .io it needs
      no servers and no concurrency floor to feel alive. One input, works on desktop and phone,
      no assets to download.</p>
    </div>
  </div>
</div>

<script>
${js}
</script>
`);

console.log('built dist/index.html and dist/mockup.html');
