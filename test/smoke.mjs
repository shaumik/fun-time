import { launch, GAME } from './browser.mjs';

const target = process.argv[2] || GAME;
const mobile = process.argv[3] === 'mobile';

const browser = await launch();
const ctx = await browser.newContext(
  mobile
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
    : { viewport: { width: 1280, height: 720 } }
);
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', r => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

const requests = [];
page.on('request', r => requests.push(r.url()));

await page.goto(target, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const state = await page.evaluate(() => ({
  state: window.__NH?.G?.state,
  hasRun: !!window.__NH?.G?.run,
  district: window.__NH?.G?.run?.district,
  hintOn: document.getElementById('gsHint')?.classList.contains('on'),
  menuVisible: !document.getElementById('menu')?.classList.contains('hide'),
  hudOff: document.getElementById('hud')?.classList.contains('off'),
}));
console.log('after load:', JSON.stringify(state));

// drive for a few seconds with steering input
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowLeft');
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(3000);

const after = await page.evaluate(() => ({
  state: window.__NH?.G?.state,
  score: window.__NH?.G?.score,
  speed: Math.round(window.__NH?.G?.car?.speed || 0),
  hintOn: document.getElementById('gsHint')?.classList.contains('on'),
  fps: Math.round(1000 / (window.__NH?.ftAvg || 16)),
}));
console.log('after driving:', JSON.stringify(after));

// Escape must not abandon the run
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
console.log('after Escape:', JSON.stringify(await page.evaluate(() => ({ state: window.__NH?.G?.state, hasRun: !!window.__NH?.G?.run }))));

const external = requests.filter(u => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:'));
console.log('external requests:', JSON.stringify(external));
console.log('console errors/warnings:', errors.length ? JSON.stringify(errors, null, 1) : 'none');

await page.screenshot({ path: process.argv[4] || '/tmp/claude-0/-home-user-fun-time/d792c7d7-b0dd-5e48-81e3-d7a12030172a/scratchpad/boot.png' });
await browser.close();
