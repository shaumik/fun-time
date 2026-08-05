/* Inlines style.css and game.js into index.html to produce two artefacts:
     dist/index.html            — self-contained single file, zipped for CrazyGames
     dist/standalone/index.html — the same game with no portal SDK, for self-hosting
   index.html stays the source of truth; nothing is duplicated by hand.

   There were five more targets here — a pitch page, a bare playable page for
   testing on a phone, and adapters for GameDistribution, GameMonetize and
   Playgama. CrazyGames is the submission and self-hosting is the fallback;
   the rest were carrying maintenance for channels nothing was shipping to,
   and every one of them was another build whose ad rules had to be re-checked
   on any change to the ad code. Git has them if a channel is ever wanted
   back — the seam they plugged into is still in src/game.js, documented. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');
const css  = read('src/style.css');
/* load order matters: game.js reads NHAudio and NHChips at definition time */
const SCRIPTS = ['src/audio.js', 'src/chips.js', 'src/game.js'];
const js = SCRIPTS.map(read).join('\n');

/* ---- a build stamp ----
   Two rounds were spent on a bug that did not exist in the build being
   discussed, because neither of us could tell which build was on the screen:
   the artifact URL never changes and a phone webview caches aggressively. The
   game now says which build it is, in the menu options row and on
   window.__NH.build.

   It is a hash of the sources, not the commit. The commit hash was the obvious
   choice and it cannot work here, because dist/ is committed: stamping HEAD
   into dist/ changes dist/, committing that changes HEAD, and the next build
   stamps something new again. There is no fixed point. A hash over the inputs
   has one by construction — same sources, same stamp, no matter when or from
   what commit it is built — so a rebuilt tree is clean whenever the game in it
   is unchanged, and any drift between src/ and dist/ shows up as a real diff.
   To map a stamp back to a commit: `git log -S'__NH_BUILD="<stamp>"' -- dist`. */
const BUILD = crypto.createHash('sha256')
  .update(html).update(css).update(js).update(read('build.mjs'))
  .digest('hex').slice(0, 7);

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

fs.writeFileSync(path.join(ROOT, 'dist/index.html'),
  html
    .replace('</head>', `<script>window.__NH_BUILD=${JSON.stringify(BUILD)}</script>\n</head>`)
    .replace('<link rel="stylesheet" href="src/style.css">', `<style>\n${css}\n</style>`)
    .replace(/<script src="src\/audio\.js"><\/script>\s*<script src="src\/chips\.js"><\/script>\s*<script src="src\/game\.js"><\/script>/,
             `<script>\n${js}\n</script>`)
);

/* ---------------- standalone target ----------------
   The same game with no portal SDK: for self-hosting, for itch.io, and as
   the base an adapter for another ad network drops into.

   It is a separate artefact rather than a switch inside one build, and that
   is not tidiness. CrazyGames allow ads from their SDK alone, so a build
   carrying a second network is a rejection — the only safe shape is one
   provider per build, checked at the bottom of this file.

   Nothing in the game needs changing for this: Ads.resolve() finds no
   provider, every placement falls back to the local simulated overlay, and
   saves fall back to localStorage. To wire a real network, implement the
   adapter contract documented at the platform seam in src/game.js and add
   its script tag here — nowhere else. */
const standalone = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8')
  .replace(/\s*<!--[^>]*?CrazyGames SDK[\s\S]*?-->\s*/, '\n')
  .replace(/\s*<script src="https:\/\/sdk\.crazygames\.com\/[^"]*"><\/script>/, '')
  /* A build with no provider has to say so. "No provider" is otherwise
     indistinguishable from running off a local file, where simulating a
     placement is the point — and a shipped standalone build that mimes a
     three-second ad and then hands over the reward is both a lie and a free
     grant. Declared, the game retires the ad routes and the coin route
     carries the over-screen. */
  .replace('</head>', '<script>window.__NH_NO_ADS = true;</script>\n</head>');

fs.mkdirSync(path.join(ROOT, 'dist/standalone'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/standalone/index.html'), standalone);

/* The submission artefact: a zip with index.html at its root and nothing else
   in it, plus the same for the standalone build.

   The entry inside the archive is stamped to a fixed mtime. `zip -X` drops the
   extra fields but still records each entry's modification time, so without
   this an unchanged build produced a byte-different archive on every run and
   left dirty zips in the working tree after any rebuild. Deterministic
   archives mean the diff shows a zip only when the game inside it changed.

   The stamping happens on a copy in a temp directory, and that matters. It
   used to run `touch -t` over dist/ itself, which pinned every tracked file in
   there to the same fixed mtime on every build. git decides a file is
   unmodified from cached stat data — same size, same mtime, skip the hash —
   so a dist/index.html whose contents had changed but whose length happened to
   match went on reporting as clean, was never staged, and the repo kept
   shipping an older build than the source it was built from. Two rounds of
   "which build is this?" came out of exactly that. Real mtimes on dist/, fixed
   mtimes only inside the archive. */
const dist = path.join(ROOT, 'dist');
const STAMP = '202601010000.00';

const zipUp = (dir, name) => {
  const out = path.join(dir, name);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-zip-'));
  fs.copyFileSync(path.join(dir, 'index.html'), path.join(tmp, 'index.html'));
  execSync('touch -t ' + STAMP + ' index.html', { cwd: tmp });
  execSync('zip -q -X ' + name + ' index.html', { cwd: tmp });
  fs.rmSync(out, { force: true });
  fs.copyFileSync(path.join(tmp, name), out);
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
};

const zip    = zipUp(dist, 'neon-heat.zip');
const zipAlt = zipUp(path.join(dist, 'standalone'), 'neon-heat-standalone.zip');

const kb = n => (fs.statSync(n).size / 1024).toFixed(1) + ' KB';
console.log('dist/index.html                             ' + kb(path.join(dist, 'index.html')) + '   (self-contained game)');
console.log('dist/neon-heat.zip                          ' + kb(zip) + '   <- upload this to CrazyGames');
console.log('dist/standalone/neon-heat-standalone.zip    ' + kb(zipAlt) + '   (self-host / itch.io, no ads)');

/* Guard both builds against the thing that would fail them silently: the
   CrazyGames build must reach their SDK and nothing else, and the standalone
   build must reach nothing at all — a stray CrazyGames tag in a self-hosted
   build would sitelock it to their domains. */
const hosts = s => [...s.matchAll(/(?:src|href)="(https?:)?\/\/([^"]+)"/g)].map(m => m[2]);

const built = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const stray = hosts(built).filter(u => !u.startsWith('sdk.crazygames.com'));
if (stray.length) console.warn('WARNING external requests besides the SDK: ' + stray.join(', '));
if (!built.includes('sdk.crazygames.com')) console.warn('WARNING the SDK script tag is missing from the build');

/* `includes`, not a tag scan: an adapter dropped in here later would inject
   its script through createElement, so the host would be a JS string that an
   attribute scan never sees. */
if (standalone.includes('sdk.crazygames.com'))
  console.warn('WARNING the standalone build still carries the CrazyGames SDK');
if (hosts(standalone).length)
  console.warn('WARNING the standalone build has external tags: ' + hosts(standalone).join(', '));
if (!standalone.includes('__NH_NO_ADS'))
  console.warn('WARNING the standalone build did not declare itself ad-free');
