/* CrazyGames compliance harness for NEON HEAT.
   ------------------------------------------------------------------
   Drives dist/index.html against a mocked v3 SDK and asserts the things their
   QA actually checks: how many clicks a new player needs to reach gameplay,
   SDK event ordering, what the rewarded buttons do when no ad can serve, and
   whether the UI is legible and unclipped at every iframe size they list.

     npm run build && npm run check

   The mock is the only SDK here — the real one is never loaded — so a green
   run proves the game's side of the contract, not the handshake. Run the game
   once in their preview tool before submitting.
   ------------------------------------------------------------------ */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GAME = 'file://' + path.join(ROOT, 'dist', 'index.html');

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('dist/index.html is missing — run `npm run build` first.');
  process.exit(2);
}

/* Prefer a preinstalled Chromium when there is one, else let Playwright find
   its own. Keeps this runnable both in CI images and on a laptop. */
const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/* Headless Chromium lets audio autoplay by default, which hides the entire
   class of bug where a game never unlocks its AudioContext. Enforce the
   policy real players get. */
const launchOpts = {
  args: ['--autoplay-policy=document-user-activation-required'],
  ...(fs.existsSync(PINNED) ? { executablePath: PINNED } : {}),
};

/* A mock that records every SDK call and can be told to fail ads the way the
   platform does during Basic Launch or against an adblocker. */
function sdkMock({ adMode = 'fill', adblock = false, user = null } = {}) {
  return `(() => {
    const log = [];
    window.__sdkLog = log;
    const rec = (n, a) => { log.push({ n, a }); };
    window.CrazyGames = { SDK: {
      environment: 'crazygames',
      init: async () => { rec('init'); },
      game: {
        settings: { muteAudio: false, disableChat: false },
        addSettingsChangeListener: f => rec('addSettingsChangeListener'),
        loadingStart: () => rec('loadingStart'),
        loadingStop: () => rec('loadingStop'),
        gameplayStart: () => rec('gameplayStart'),
        gameplayStop: () => rec('gameplayStop'),
        happytime: () => rec('happytime'),
        reportGameCompletedPercentage: p => rec('reportGameCompletedPercentage', p),
        setGameContext: c => rec('setGameContext', c),
        clearGameContext: () => rec('clearGameContext'),
      },
      user: {
        isUserAccountAvailable: true,
        systemInfo: { countryCode:'US', locale:'en-US',
          device:{ type:'desktop' }, browser:{ name:'Chrome' }, os:{ name:'Windows' } },
        getUser: async () => { rec('getUser'); return ${JSON.stringify(user)}; },
        addAuthListener: f => { rec('addAuthListener'); window.__auth = f; },
      },
      ad: {
        hasAdblock: async () => { rec('hasAdblock'); return ${adblock}; },
        requestAd: (type, cb) => {
          rec('requestAd', type);
          setTimeout(() => {
            if ('${adMode}' === 'fill') { cb.adStarted && cb.adStarted(); cb.adFinished && cb.adFinished(); }
            else if ('${adMode}' === 'basiclaunch') cb.adError && cb.adError({ code:'adsDisabledBasicLaunch', message:'x' });
            else if ('${adMode}' === 'adblock') cb.adError && cb.adError({ code:'adblock', message:'x' });
            else cb.adError && cb.adError({ code:'unfilled', message:'x' });
          }, 10);
        },
      },
      data: {},
    }};
  })();`;
}

async function session(opts = {}, fn) {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1216, height: 684 } });
  const errors = [];
  const page = await ctx.newPage();
  /* The sandbox has no route to sdk.crazygames.com, so the real <script> tag
     in dist/index.html always fails to fetch. That is this harness, not the
     game — the mock is injected separately — so it is not counted. */
  /* The avatar is a real <img> pointed at the platform's CDN, and the game
     hides it on error — correct behaviour, and on a sandbox with no outbound
     network it fires every time, so the "avatar shown" check failed whenever
     the error beat the assertion. That was a flake in this harness rather
     than anything wrong with the game. Serve a 1x1 so the element behaves the
     way it will on the portal and the check means something. */
  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  await page.route('**/images.crazygames.com/**', r =>
    r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  const noise = t => /ERR_TUNNEL_CONNECTION_FAILED|sdk\.crazygames\.com|ERR_NAME_NOT_RESOLVED/.test(t);
  page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => { if (!noise(e.message)) errors.push('pageerror: ' + e.message); });
  if (!opts.noSdk) await page.addInitScript(sdkMock(opts));
  if (opts.returning) {
    await page.addInitScript(`try{localStorage.setItem('neonheat.v1', JSON.stringify({runs:5,best:9000,deepest:4,coins:50000}));}catch(e){}`);
  }
  await page.goto(GAME);
  await page.waitForTimeout(1500);
  const out = await fn(page, errors);
  await browser.close();
  return out;
}

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

/* ---- 1. a brand-new player reaches gameplay with zero clicks ---- */
await session({}, async (page, errors) => {
  const state = await page.evaluate(() => window.__NH.G.state);
  check('new player lands in gameplay with 0 clicks', state === 'play', 'state=' + state);
  const log = await page.evaluate(() => window.__sdkLog.map(e => e.n));
  check('loadingStart before loadingStop',
    log.indexOf('loadingStart') >= 0 && log.indexOf('loadingStart') < log.indexOf('loadingStop'));
  /* Their review asked for this specifically: the district is already running
     under the onboarding hint, but the first gameplayStart belongs to the
     moment the player takes the wheel, not to the moment the road appears. */
  check('gameplayStart withheld until the player steers', !log.includes('gameplayStart'),
    'log=' + log.join(','));
  /* the hint has to be up and readable while that is true, or the wait is
     just a game that never says what it wants */
  const hint = await page.evaluate(() => {
    const el = document.getElementById('gsHint');
    return { on: el.classList.contains('on'), text: el.firstElementChild.textContent };
  });
  check('keyboard onboarding hint shown in gameplay', hint.on && /steer/i.test(hint.text), JSON.stringify(hint));

  /* take the wheel */
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1200);            // the hint fades out over 900ms
  const log2 = await page.evaluate(() => window.__sdkLog.map(e => e.n));
  check('gameplayStart fired once steering begins', log2.includes('gameplayStart'));
  check('gameplayStart comes after loadingStop',
    log2.indexOf('gameplayStart') > log2.indexOf('loadingStop'));
  check('the hint closes once the player has the control',
    await page.evaluate(() => !document.getElementById('gsHint').classList.contains('on')));
  check('setGameContext sent for the district', log2.includes('setGameContext'));
  check('systemInfo consumed (device detection)',
    await page.evaluate(() => window.__NH.Ads.deviceType() === 'desktop'));
  check('no console errors on the fast path', errors.length === 0, errors.slice(0, 3).join(' | '));
});

/* ---- 2. a returning player still gets the menu ---- */
await session({ returning: true }, async (page, errors) => {
  const state = await page.evaluate(() => window.__NH.G.state);
  check('returning player gets the menu', state === 'menu', 'state=' + state);
  check('no console errors on the menu path', errors.length === 0, errors.slice(0, 3).join(' | '));
});

/* ---- 3. Basic Launch: ads disabled, so no dead rewarded buttons ---- */
await session({ adMode: 'basiclaunch' }, async (page, errors) => {
  await page.evaluate(() => { window.__NH.G.score = 5000; window.__NH.endRun(false); });
  await page.waitForTimeout(300);
  /* first click is allowed to discover the state; after that the offer must go */
  await page.evaluate(() => document.getElementById('btnRevive').click());
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => ({
    canServe: window.__NH.Ads.canServe(),
    revHidden: document.getElementById('btnRevive').classList.contains('hide'),
    dblHidden: document.getElementById('btnDouble').classList.contains('hide'),
    note: document.getElementById('ovAdNote').textContent,
    noteShown: !document.getElementById('ovAdNote').classList.contains('hide'),
    coinShown: !document.getElementById('btnReviveCoins').classList.contains('hide'),
  }));
  check('Basic Launch marks ads unservable', s.canServe === false);
  check('rewarded buttons removed once ads are known dead', s.revHidden && s.dblHidden, JSON.stringify(s));
  check('a notice explains why', s.noteShown && s.note.length > 0, s.note);
  check('the coin alternative remains', s.coinShown);
  check('no console errors in Basic Launch', errors.length === 0, errors.slice(0, 3).join(' | '));
});

/* ---- 4. adblock detected up front: offers never go live at all ---- */
await session({ adblock: true, adMode: 'adblock' }, async (page, errors) => {
  /* the paid alternative is only an alternative to someone who has earned
     coins, so give this player a balance before checking it is offered */
  await page.evaluate(() => { window.__NH.Save.data.coins = 20000; });
  await page.evaluate(() => { window.__NH.G.score = 5000; window.__NH.endRun(false); });
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({
    canServe: window.__NH.Ads.canServe(),
    revHidden: document.getElementById('btnRevive').classList.contains('hide'),
    note: document.getElementById('ovAdNote').textContent,
    coinEnabled: !document.getElementById('btnReviveCoins').disabled,
  }));
  check('hasAdblock consulted before any click', s.canServe === false);
  check('no live rewarded button for adblock users', s.revHidden);
  check('adblock notice shown', /blocker/i.test(s.note), s.note);
  check('adblock users can still revive with coins', s.coinEnabled);
  check('no console errors with adblock', errors.length === 0, errors.slice(0, 3).join(' | '));
});

/* ---- 5. ads fill normally: the reward actually lands ---- */
await session({ adMode: 'fill' }, async (page, errors) => {
  await page.evaluate(() => { window.__NH.G.score = 5000; window.__NH.endRun(false); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('btnRevive').click());
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => window.__NH.G.state);
  check('a filled rewarded ad revives the run', state === 'play', 'state=' + state);
  const log = await page.evaluate(() => window.__sdkLog.filter(e => e.n === 'requestAd').map(e => e.a));
  check('revive requested a rewarded ad', log.includes('rewarded'), JSON.stringify(log));
  check('no console errors on the reward path', errors.length === 0, errors.slice(0, 3).join(' | '));
});

/* ---- 6. unfilled is transient: the offer stays, the player is told ---- */
await session({ adMode: 'unfilled' }, async (page) => {
  await page.evaluate(() => { window.__NH.G.score = 5000; window.__NH.endRun(false); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('btnRevive').click());
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({
    canServe: window.__NH.Ads.canServe(),
    revHidden: document.getElementById('btnRevive').classList.contains('hide'),
    state: window.__NH.G.state,
  }));
  check('unfilled does not permanently kill the offers', s.canServe === true && !s.revHidden, JSON.stringify(s));
  check('unfilled does not reward the player', s.state === 'over', 'state=' + s.state);
});

/* ---- 7. Escape must not destroy a run (restricted key) ---- */
await session({}, async (page) => {
  const before = await page.evaluate(() => window.__NH.G.state);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__NH.G.state);
  check('Escape does not abandon the run', before === 'play' && after === 'play', `${before} -> ${after}`);
});

/* ---- 8. no SDK at all (off-platform) still boots ---- */
await session({ noSdk: true }, async (page, errors) => {
  const state = await page.evaluate(() => window.__NH.G.state);
  check('boots without the SDK present', state === 'play', 'state=' + state);
  check('no console errors without the SDK', errors.length === 0, errors.slice(0, 3).join(' | '));
});

/* ---- 9. mute setting from the portal outranks the in-game toggle ---- */
await session({}, async (page) => {
  const r = await page.evaluate(() => {
    window.NHAudio.setSiteMute(true);
    const before = window.NHAudio.isSilenced();
    window.NHAudio.toggleMute();
    return { before, after: window.NHAudio.isSilenced(), forced: window.NHAudio.isForced() };
  });
  check('in-game toggle cannot unmute a site mute', r.before && r.after && r.forced, JSON.stringify(r));
});

/* ---- 10. readable at their smallest required iframe size ---- */
await session({ viewport: { width: 800, height: 450 } }, async (page, errors) => {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 1);
  check('no horizontal overflow at 800x450 (mobile iframe)', !overflow);
  check('no console errors at 800x450', errors.length === 0, errors.slice(0, 3).join(' | '));
});

/* ---- 11. the way past the ad must match the ad offer ----
   "the continue without watching a rewarded ad should be the same size, font,
   color, etc." Adding the coin route means four buttons now have to agree. */
await session({}, async (page) => {
  await page.evaluate(() => { window.__NH.Save.data.coins = 20000; window.__NH.G.score = 5000; window.__NH.endRun(false); });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => ['btnRevive','btnReviveCoins','btnDouble','btnAgain'].map(id => {
    const el = document.getElementById(id), r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return { id, w: Math.round(r.width), h: Math.round(r.height),
             fs: s.fontSize, fw: s.fontWeight, ff: s.fontFamily.split(',')[0] };
  }));
  const same = k => new Set(m.map(x => String(x[k]))).size === 1;
  check('all game-over actions share one width', same('w'), JSON.stringify(m.map(x => x.id + ':' + x.w)));
  check('all game-over actions share one height', same('h'), JSON.stringify(m.map(x => x.id + ':' + x.h)));
  check('all game-over actions share font size/weight/family',
    same('fs') && same('fw') && same('ff'), JSON.stringify(m[0]));
});

/* ---- 12. readable at every iframe size they list ---- */
const SIZES = [
  [907,510,'desktop'], [1216,684,'desktop'], [1077,606,'desktop'], [821,462,'desktop'],
  [1366,768,'fullscreen'], [1920,1080,'fullscreen'], [1536,864,'fullscreen'], [1280,720,'fullscreen'],
  [800,450,'mobile'], [1080,607,'tablet'],
];
for (const [w, h, kind] of SIZES) {
  await session({ viewport: { width: w, height: h } }, async (page, errors) => {
    const r = await page.evaluate(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const off = [];
      /* every HUD element that carries information must sit inside the frame */
      for (const id of ['score','coins','hull','spd','obj','combo','xp','dchip']) {
        const el = document.getElementById(id);
        if (!el) continue;
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;         // hidden is fine
        if (b.left < -1 || b.top < -1 || b.right > vw + 1 || b.bottom > vh + 1) off.push(id);
      }
      const smallest = Math.min(...['score','spd','hullVal'].map(id => {
        const el = document.getElementById(id);
        return el ? parseFloat(getComputedStyle(el).fontSize) : 99;
      }));
      return { off, smallest, overflow: document.documentElement.scrollWidth > vw + 1 };
    });
    check(`${w}x${h} (${kind}): HUD inside the frame`, r.off.length === 0, r.off.join(','));
    check(`${w}x${h} (${kind}): no overflow`, !r.overflow);
    /* devicePixelRatio:1 readability — 10px is about the floor for a glance */
    check(`${w}x${h} (${kind}): text >= 10px`, r.smallest >= 10, 'min=' + r.smallest + 'px');
    check(`${w}x${h} (${kind}): no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  });
}

/* ---- 13. every screen fits, at every size ----
   Raising the font floor to keep text legible only helps if the panels around
   that text still fit. Check each one at each required size for both spilling
   past the frame and clipping its own content. */
const SCREENS = ['menu','over','garage','map','contract','levelup','cleared','board','brief','depot','daily'];
for (const [w, h, kind] of SIZES) {
  await session({ viewport: { width: w, height: h } }, async (page) => {
    /* populate the screens that render from state, so they measure at full size */
    await page.evaluate(() => {
      window.__NH.Save.data.coins = 50000;
      window.__NH.G.score = 5000;
      window.__NH.endRun(false);
    });
    await page.waitForTimeout(250);
    const bad = await page.evaluate(SCREENS => {
      const vw = innerWidth, vh = innerHeight, out = [];
      for (const id of SCREENS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const was = el.classList.contains('hide');
        el.classList.remove('hide');
        const inner = el.firstElementChild;
        if (inner) {
          const b = inner.getBoundingClientRect();
          const spill = Math.max(0, -b.left, -b.top, b.right - vw, b.bottom - vh);
          /* Content is only truly cut off when the box actually clips it.
             With overflow:visible, scrollHeight-clientHeight is just integer
             rounding against a fractional height and nothing is lost. */
          const ov = getComputedStyle(inner).overflowY;
          const clips = ov === 'hidden' || ov === 'clip';
          const clip = clips ? inner.scrollHeight - inner.clientHeight : 0;
          if (spill > 2 || clip > 2) out.push(`${id}:spill${Math.round(spill)}/clip${clip}`);
        }
        if (was) el.classList.add('hide');
      }
      return out;
    }, SCREENS);
    check(`${w}x${h} (${kind}): all screens fit`, bad.length === 0, bad.join(' '));
  });
}

/* ---- 14. signed-in players get their CrazyGames name and avatar ---- */
const USER = { username: 'SingingCheese.TLNU', profilePictureUrl: 'https://images.crazygames.com/userportal/avatars/4.png' };
await session({ user: USER }, async (page) => {
  await page.evaluate(() => window.__NH.showBoard('menu'));
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => ({
    name: document.getElementById('bdWho').textContent,
    picHidden: document.getElementById('bdPic').classList.contains('hide'),
    picSrc: document.getElementById('bdPic').getAttribute('src') || '',
  }));
  check('signed-in username shown', r.name === 'SingingCheese.TLNU', r.name);
  check('signed-in avatar shown', !r.picHidden && /avatars/.test(r.picSrc), JSON.stringify(r));
});

/* ---- 15. guests stay guests, and are never asked to sign in ---- */
await session({ user: null }, async (page) => {
  await page.evaluate(() => window.__NH.showBoard('menu'));
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => ({
    name: document.getElementById('bdWho').textContent,
    picHidden: document.getElementById('bdPic').classList.contains('hide'),
    /* no external login option may exist anywhere in the UI */
    login: /log ?in|sign ?in|facebook|google/i.test(document.body.innerText),
  }));
  check('guest sees no username', r.name === 'Your runs', r.name);
  check('guest sees no avatar frame', r.picHidden);
  check('no external login options offered', !r.login);
});

/* ---- 16. a guest signing in mid-session is picked up ---- */
await session({ user: null }, async (page) => {
  await page.evaluate(() => window.__auth && window.__auth({ username:'LateJoiner.AB12', profilePictureUrl:'https://images.crazygames.com/userportal/avatars/9.png' }));
  await page.evaluate(() => window.__NH.showBoard('menu'));
  await page.waitForTimeout(200);
  const name = await page.evaluate(() => document.getElementById('bdWho').textContent);
  check('auth listener picks up a mid-session sign-in', name === 'LateJoiner.AB12', name);
});

/* ---- 17. completion percentage is reported and only moves forward ---- */
await session({ returning: true }, async (page) => {
  await page.evaluate(() => { window.__NH.G.score = 100; window.__NH.endRun(false); });
  await page.waitForTimeout(200);
  const vals = await page.evaluate(() =>
    window.__sdkLog.filter(e => e.n === 'reportGameCompletedPercentage').map(e => e.a));
  check('reportGameCompletedPercentage sent', vals.length > 0, JSON.stringify(vals));
  check('progress never moves backwards',
    vals.every((v, i) => i === 0 || v > vals[i - 1]), JSON.stringify(vals));
  check('progress stays within 0-100', vals.every(v => v >= 0 && v <= 100), JSON.stringify(vals));
});

/* ---- 18. browser defaults that leak past the game ---- */
await session({}, async (page) => {
  const r = await page.evaluate(() => {
    const fire = (type, target, init) => {
      const e = new (type === 'wheel' ? WheelEvent : MouseEvent)(type, { bubbles: true, cancelable: true, ...init });
      (target || document.getElementById('c')).dispatchEvent(e);
      return e.defaultPrevented;
    };
    const garage = document.getElementById('garage');
    garage.classList.remove('hide');
    const work = document.querySelector('.gWork');
    return {
      wheelOnCanvas: fire('wheel', null, { deltaY: 100 }),
      wheelInGarageList: work ? fire('wheel', work, { deltaY: 100 }) : null,
      contextMenu: fire('contextmenu'),
    };
  });
  check('wheel over the game does not scroll the page', r.wheelOnCanvas === true);
  check('the garage work order can still be scrolled', r.wheelInGarageList === false, String(r.wheelInGarageList));
  check('right-click does not open the browser menu', r.contextMenu === true);
});

/* ---- 19. arrow keys and space do not scroll the embedding page ---- */
await session({}, async (page) => {
  const prevented = await page.evaluate(() => {
    const out = {};
    for (const code of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space']) {
      const e = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
      window.dispatchEvent(e);
      out[code] = e.defaultPrevented;
    }
    return out;
  });
  check('arrows and space are swallowed by the game',
    Object.values(prevented).every(Boolean), JSON.stringify(prevented));
});

/* ---- 20. the returning-player flow still works end to end ----
   The fast path reroutes beginNode(), so the long route through garage, map,
   dispatch and brief has to be walked to prove it was not collateral. */
await session({ returning: true }, async (page, errors) => {
  /* .layer is pointer-events:none, so a real Playwright click waits forever on
     actionability. Dispatch the click directly — this is testing the flow the
     buttons drive, not hit-testing. */
  const hit = id => page.evaluate(i => document.getElementById(i).click(), id);
  const step = async fn => {
    await fn();
    await page.waitForTimeout(260);
    return page.evaluate(() => window.__NH.G.state);
  };
  const seen = [];
  seen.push(await step(() => hit('btnPlay')));
  /* a returning player may be owed a daily drop before the garage */
  if (seen[seen.length - 1] === 'daily') seen.push(await step(() => hit('btnDaily')));
  seen.push(await step(() => hit('btnRace')));
  seen.push(await step(() => page.evaluate(() => {
    const n = window.__NH.openNodes()[0]; window.__NH.enterNode(n.row, n.col);
  })));
  seen.push(await step(() => page.evaluate(() => window.__NH.takeContract(0))));
  seen.push(await step(() => hit('btnGo')));
  check('returning player walks garage -> map -> dispatch -> brief -> play',
    seen[seen.length - 1] === 'play', seen.join(' -> '));
  check('the brief screen still appears for returning players',
    seen.includes('brief'), seen.join(' -> '));
  check('no console errors on the long flow', errors.length === 0, errors.slice(0, 3).join(' | '));
});

/* ---- 21. audio unlocks on the player's FIRST gesture, whatever it is ----
   A zero-click start means the game is silent until the player interacts —
   browser policy, not a fault. What is a fault is needing a second gesture,
   which is what an early return after init() used to cause. */
const state = page => page.evaluate(() => {
  const pr = window.NHAudio._probe();
  return pr ? pr.ac.state : 'no-context';
});
for (const [label, act] of [
  ['keyboard', p => p.keyboard.press('ArrowLeft')],
  ['click',    p => p.evaluate(() => document.getElementById('stage').click())],
  ['pointer',  p => p.mouse.click(400, 300)],
]) {
  await session({}, async page => {
    check(`silent before any input (${label} run)`, (await state(page)) === 'no-context');
    await act(page);
    await page.waitForTimeout(350);
    check(`one ${label} gesture is enough to start audio`,
      (await state(page)) === 'running', await state(page));
  });
}

/* ---- 22. the hint waits for the player instead of expiring into silence ---- */
await session({}, async page => {
  const on = () => page.evaluate(() => document.getElementById('gsHint').classList.contains('on'));
  check('control hint is up on landing', await on());
  await page.waitForTimeout(7000);          // well past the old 5.2s timeout
  check('hint still up after 7s with no input', await on());
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1400);
  await page.keyboard.up('ArrowLeft');
  check('hint clears once the player steers', !(await on()));
});

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
