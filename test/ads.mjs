/* The CrazyGames advertisement rules, exercised against a mocked SDK.

   These cover the failure modes their QA explicitly rejects for:
     - a rewarded button that is clickable but does nothing
     - audio dipping for an ad that never appears
     - a midgame ad paired with a "watch to keep playing" offer
     - rewarding the player on adError                                       */
import { launch, GAME } from './browser.mjs';

const browser = await launch();

/* Boots the game with a mocked SDK whose ad behaviour is chosen per test. */
async function boot({ adMode, startDelay = 30 }){
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/sdk.crazygames.com/**', r =>
    adMode === 'blocked'
      ? r.abort()
      : r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));

  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  if (adMode !== 'blocked') {
    await page.addInitScript(({ adMode, startDelay }) => {
      window.__calls = [];
      window.CrazyGames = { SDK: {
        init: async () => {},
        game: {
          loadingStart(){}, loadingStop(){}, gameplayStart(){}, gameplayStop(){},
          happytime(){}, settings: { muteAudio: false }, addSettingsChangeListener(){},
        },
        ad: { requestAd(type, cb){
          window.__calls.push(type);
          if (adMode === 'error') { setTimeout(() => cb.adError('no fill'), 20); return; }
          setTimeout(() => cb.adStarted && cb.adStarted(), startDelay);
          setTimeout(() => cb.adFinished && cb.adFinished(), startDelay + 120);
        } },
        user: { getUser: async () => null },
      }};
    }, { adMode, startDelay });
  }

  await page.goto(GAME, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}

const overState = page => page.evaluate(() => {
  const vis = id => { const e = document.getElementById(id);
    return e && !e.classList.contains('hide') ? (e.disabled ? 'disabled' : 'shown') : 'hidden'; };
  return { revive: vis('btnRevive'), double: vis('btnDouble'), coins: vis('btnRevCoin'),
           note: document.getElementById('ovAdNote')?.textContent || '' };
});

/* Puts a run into a state where the revive offer qualifies (score >= 400). */
const endScoringRun = page => page.evaluate(async () => {
  window.__NH.G.score = 5000;
  window.__NH.Save.data.coins = 9999;
  window.__NH.endRun(false);
  await new Promise(r => setTimeout(r, 700));
});

/* ---------- 1. ads blocked outright (adblock / SDK never loads) ---------- */
{
  const { ctx, page, errs } = await boot({ adMode: 'blocked' });
  await endScoringRun(page);
  console.log('BLOCKED  offers:', JSON.stringify(await overState(page)));
  console.log('BLOCKED  still playable:',
    await page.evaluate(() => !!window.__NH.G && document.getElementById('over') !== null),
    'pageerrors:', errs.length ? errs : 'none');
  await ctx.close();
}

/* ---------- 2. SDK present, every ad returns adError (Basic Launch) ---------- */
{
  const { ctx, page, errs } = await boot({ adMode: 'error' });
  await endScoringRun(page);
  console.log('ADERROR  before:', JSON.stringify(await overState(page)));

  await page.click('#btnRevive');
  await page.waitForTimeout(400);
  const afterOne = await overState(page);
  console.log('ADERROR  after 1 fail:', JSON.stringify(afterOne));
  console.log('ADERROR  not rewarded:',
    await page.evaluate(() => window.__NH.G.state === 'over' && !window.__NH.G.revived));

  if (afterOne.revive === 'shown') {
    await page.click('#btnRevive');
    await page.waitForTimeout(400);
  }
  console.log('ADERROR  after 2 fails:', JSON.stringify(await overState(page)));
  console.log('pageerrors:', errs.length ? errs : 'none');
  await ctx.close();
}

/* ---------- 3. audio must not dip until adStarted ---------- */
{
  const { ctx, page, errs } = await boot({ adMode: 'ok', startDelay: 400 });
  await endScoringRun(page);
  const timing = await page.evaluate(() => new Promise(resolve => {
    const seen = [];
    const iv = setInterval(() => seen.push([Math.round(performance.now()), window.__NH.adMuted]), 25);
    const t0 = performance.now();
    window.__NH.Ads.rewarded('t', () => {
      clearInterval(iv);
      const firstMute = seen.find(s => s[1]);
      resolve({ mutedAtRequest: seen.length ? seen[0][1] : null,
                mutedAfterMs: firstMute ? firstMute[0] - Math.round(t0) : null,
                mutedAtEnd: window.__NH.adMuted });
    });
  }));
  console.log('MUTE     timing:', JSON.stringify(timing), '(adStarted fires at ~400ms)');
  console.log('pageerrors:', errs.length ? errs : 'none');
  await ctx.close();
}

/* ---------- 4. no midgame ad on a transition that offers a rewarded continue ---------- */
{
  const { ctx, page, errs } = await boot({ adMode: 'ok' });
  const res = await page.evaluate(async () => {
    const out = [];
    for (const [label, score, runs] of [['revive offered', 5000, 2], ['no revive', 100, 5]]) {
      window.__calls.length = 0;
      window.__NH.G.revived = false;
      window.__NH.G.score = score;
      window.__NH.Save.data.runs = runs;          // endRun increments to a multiple of 3
      window.__NH.endRun(false);
      await new Promise(r => setTimeout(r, 900));
      out.push({ label, ads: window.__calls.slice() });
    }
    return out;
  });
  console.log('PAIRING ', JSON.stringify(res));
  console.log('pageerrors:', errs.length ? errs : 'none');
  await ctx.close();
}

/* ---------- 5. mouse steering ---------- */
{
  const { ctx, page, errs } = await boot({ adMode: 'ok' });
  await page.mouse.move(1100, 400);
  await page.waitForTimeout(120);
  const right = await page.evaluate(() => ({ on: window.__NH.MS.on, steer: +window.__NH.IN.steer.toFixed(2) }));
  await page.mouse.move(180, 400);
  await page.waitForTimeout(120);
  const left = await page.evaluate(() => ({ on: window.__NH.MS.on, steer: +window.__NH.IN.steer.toFixed(2) }));
  await page.mouse.move(640, 400);
  await page.waitForTimeout(120);
  const centre = await page.evaluate(() => +window.__NH.IN.steer.toFixed(2));
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(80);
  const afterKey = await page.evaluate(() => window.__NH.MS.on);
  console.log('MOUSE    right:', JSON.stringify(right), 'left:', JSON.stringify(left),
              'centre:', centre, 'disarmed by key:', !afterKey);
  console.log('pageerrors:', errs.length ? errs : 'none');
  await ctx.close();
}

await browser.close();
