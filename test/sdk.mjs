import { launch, GAME } from './browser.mjs';


const browser = await launch();

/* ---------- 1. AdBlock: SDK script never loads ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/sdk.crazygames.com/**', r => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(GAME, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => new Promise(resolve => {
    const adEl = document.getElementById('ad');
    let sawOverlay = false;
    const obs = new MutationObserver(() => { if (adEl.classList.contains('on')) sawOverlay = true; });
    obs.observe(adEl, { attributes: true, attributeFilter: ['class'] });
    const t0 = performance.now();
    window.__NH.Ads.rewarded('test', ok => {
      obs.disconnect();
      resolve({ ok, ms: Math.round(performance.now() - t0), sawOverlay,
                ready: window.__NH.Ads.ready, onPlatform: window.__NH.Ads.onPlatform(),
                state: window.__NH.G.state });
    });
    setTimeout(() => resolve({ timedOut: true }), 6000);
  }));
  console.log('ADBLOCK rewarded:', JSON.stringify(res), 'pageerrors:', errs.length ? errs : 'none');
  await ctx.close();
}

/* ---------- 2. Mocked SDK: the real integration path ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/sdk.crazygames.com/**', r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  await page.addInitScript(() => {
    window.__calls = [];
    const log = (n, a) => window.__calls.push(a === undefined ? n : n + ':' + a);
    let settingsCb = null;
    window.CrazyGames = { SDK: {
      init: async () => { log('init'); },
      game: {
        loadingStart: () => log('loadingStart'),
        loadingStop:  () => log('loadingStop'),
        gameplayStart:() => log('gameplayStart'),
        gameplayStop: () => log('gameplayStop'),
        happytime:    () => log('happytime'),
        settings: { muteAudio: false },
        addSettingsChangeListener: cb => { settingsCb = cb; log('addSettingsChangeListener'); },
      },
      ad: { requestAd: (type, cb) => { log('requestAd:' + type);
              setTimeout(() => { cb.adStarted && cb.adStarted(); }, 30);
              setTimeout(() => { cb.adFinished && cb.adFinished(); }, 120); },
            requestBanner: () => log('requestBanner') },
      user: { getUser: async () => ({ username: 'TestPlayer' }) },
    }};
    window.__setMute = v => { window.CrazyGames.SDK.game.settings.muteAudio = v;
                              settingsCb && settingsCb({ muteAudio: v }); };
  });

  await page.goto(GAME, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  console.log('SDK boot calls:', JSON.stringify(await page.evaluate(() => window.__calls)));
  console.log('player name read:', await page.evaluate(() => window.__NH.Ads.playerName));

  const ad = await page.evaluate(() => new Promise(resolve => {
    const t0 = performance.now();
    window.__NH.Ads.rewarded('test', ok =>
      resolve({ ok, ms: Math.round(performance.now() - t0),
                calls: window.__calls.slice(-4), paused: window.__NH.G.paused }));
    setTimeout(() => resolve({ timedOut: true }), 6000);
  }));
  console.log('SDK rewarded:', JSON.stringify(ad));

  // site mute must outrank the in-game toggle
  await page.evaluate(() => window.__setMute(true));
  await page.waitForTimeout(200);
  const muted = await page.evaluate(() => {
    const before = document.getElementById('btnMute')?.textContent;
    window.__NH.G && document.getElementById('btnMute')?.click();
    return { label: document.getElementById('btnMute')?.textContent, before };
  });
  console.log('site mute applied:', JSON.stringify(muted));
  console.log('pageerrors:', errs.length ? errs : 'none');
  await ctx.close();
}

await browser.close();
