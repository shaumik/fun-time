#!/usr/bin/env node
/**
 * Mirror the CrazyGames developer docs to local markdown.
 *
 * Public documentation, pulled so it can be read and diffed offline. Polite by
 * construction: one request at a time, a real delay between them, a User-Agent
 * that says who is calling. Do not raise CONCURRENCY.
 *
 * Requires Node 18+ (built-in fetch). No dependencies.
 *
 *   node scrape-crazygames-docs.mjs            # everything in the sitemap
 *   node scrape-crazygames-docs.mjs requirements sdk   # only these path prefixes
 *
 * Writes:
 *   cg-docs/<path>.md   one file per page
 *   cg-docs/ALL.md      everything concatenated — paste this to an assistant
 */

const ORIGIN = 'https://docs.crazygames.com';
const OUT = 'cg-docs';
const DELAY_MS = 400;
const UA = 'Mozilla/5.0 (compatible; docs-reader/1.0; personal offline copy)';

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const filters = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xml' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

/* Prefer the sitemap: it is the site telling us what exists, rather than us
   guessing by following links. Fall back to a shallow crawl if it is absent. */
async function discover() {
  try {
    const xml = await get(`${ORIGIN}/sitemap.xml`);
    const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
    if (urls.length) return [...new Set(urls)];
    throw new Error('sitemap held no <loc> entries');
  } catch (e) {
    console.warn(`sitemap unavailable (${e.message}); crawling from the root instead`);
    const seen = new Set([`${ORIGIN}/`]), queue = [`${ORIGIN}/`];
    while (queue.length && seen.size < 400) {
      const url = queue.shift();
      let html; try { html = await get(url); } catch { continue; }
      for (const m of html.matchAll(/href="([^"#?]+)"/g)) {
        let href = m[1];
        if (href.startsWith('/')) href = ORIGIN + href;
        if (!href.startsWith(ORIGIN)) continue;
        if (/\.(png|jpe?g|svg|css|js|ico|woff2?|zip|pdf)$/i.test(href)) continue;
        if (!seen.has(href)) { seen.add(href); queue.push(href); }
      }
      await sleep(DELAY_MS);
    }
    return [...seen];
  }
}

const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', '#39':"'", '#x27':"'", hellip:'…', mdash:'—', ndash:'–' };
const decode = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
  ENT[e] ?? (e[0] === '#'
    ? String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10))
    : m));

/* Docusaurus keeps the page body in <article>; everything else on the page is
   navigation and would drown the actual requirements in link soup. */
function toMarkdown(html) {
  let s = html;
  const article = s.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
              || s.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (article) s = article[1];

  s = s.replace(/<(script|style|nav|svg|button|footer)[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) =>
    '\n```\n' + decode(c.replace(/<[^>]+>/g, '')).trim() + '\n```\n');
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + c.replace(/<[^>]+>/g, '') + '`');
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, c) =>
    '\n\n' + '#'.repeat(+n) + ' ' + c.replace(/<[^>]+>/g, '').trim() + '\n');
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => '\n- ' + c.replace(/<[^>]+>/g, '').trim());
  s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim());
    return cells.length ? '\n| ' + cells.join(' | ') + ' |' : '';
  });
  s = s.replace(/<\/(p|div|section|table|ul|ol|blockquote)>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  return decode(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const slug = url => {
  const p = new URL(url).pathname.replace(/^\/|\/$/g, '');
  return (p || 'index') + '.md';
};

const all = await discover();
const pages = all
  .filter(u => u.startsWith(ORIGIN))
  .filter(u => !filters.length || filters.some(f => new URL(u).pathname.startsWith('/' + f)))
  .sort();

console.log(`${pages.length} page(s) to fetch\n`);
const combined = [];
let ok = 0, failed = 0;

for (const [i, url] of pages.entries()) {
  process.stdout.write(`[${i + 1}/${pages.length}] ${url} `);
  try {
    const md = toMarkdown(await get(url));
    if (md.length < 40) { console.log('— empty, skipped'); failed++; continue; }
    const file = join(OUT, slug(url));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `<!-- ${url} -->\n\n${md}\n`);
    combined.push(`\n\n${'='.repeat(72)}\n${url}\n${'='.repeat(72)}\n\n${md}`);
    console.log(`— ${md.length} chars`);
    ok++;
  } catch (e) {
    console.log(`— FAILED: ${e.message}`);
    failed++;
  }
  await sleep(DELAY_MS);
}

await writeFile(join(OUT, 'ALL.md'), combined.join('\n'));
console.log(`\n${ok} saved, ${failed} failed → ${OUT}/  (combined: ${OUT}/ALL.md)`);
