import { launch, GAME } from './browser.mjs';

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route('**/sdk.crazygames.com/**', r => r.abort());   // AdBlock-style
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_')) errs.push(m.text()); });

const st = () => page.evaluate(() => ({
  state: window.__NH.G.state,
  visible: [...document.querySelectorAll('.layer.screen')]
    .filter(e => !e.classList.contains('hide')).map(e => e.id),
}));

await page.goto(GAME, { waitUntil: 'load' });
await page.waitForTimeout(1200);
console.log('1 boot            ', JSON.stringify(await st()));

// finish the run
await page.evaluate(() => window.__NH.endRun(false));
await page.waitForTimeout(600);
console.log('2 run over        ', JSON.stringify(await st()));

// over -> garage
await page.evaluate(() => document.getElementById('btnAgain').click());
await page.waitForTimeout(600);
console.log('3 garage          ', JSON.stringify(await st()));

// garage -> second run: this one MUST show the route map (not skip it)
await page.evaluate(() => document.getElementById('btnRace').click());
await page.waitForTimeout(800);
console.log('4 second run map  ', JSON.stringify(await st()));

// pick the first open node -> contract
await page.evaluate(() => { const n = window.__NH.openNodes()[0]; window.__NH.enterNode(n.row, n.col); });
await page.waitForTimeout(600);
console.log('5 contract        ', JSON.stringify(await st()));

// take a contract -> brief
await page.evaluate(() => window.__NH.takeContract(0));
await page.waitForTimeout(600);
console.log('6 brief           ', JSON.stringify(await st()));

// brief -> play
await page.evaluate(() => document.getElementById('btnGo').click());
await page.waitForTimeout(600);
console.log('7 driving         ', JSON.stringify(await st()));

// back out to the menu and confirm it renders
await page.evaluate(() => window.__NH.toMenu());
await page.waitForTimeout(500);
console.log('8 menu            ', JSON.stringify(await st()),
  'best:', await page.evaluate(() => document.getElementById('menuBest').textContent));

// menu -> play again
await page.evaluate(() => document.getElementById('btnPlay').click());
await page.waitForTimeout(700);
console.log('9 from menu       ', JSON.stringify(await st()));

console.log('pageerrors:', errs.length ? errs : 'none');
await browser.close();
