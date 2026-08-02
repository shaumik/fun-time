/* GameMonetize adapter.
   ------------------------------------------------------------------
   Presents the platform seam's shape — see the contract on Ads.resolve()
   in game.js — over the GameMonetize HTML5 SDK.

   Verified against https://github.com/GameMonetize/GameMonetize.com-SDK:

     script   https://api.gamemonetize.com/sdk.js
     config   window.SDK_OPTIONS = { gameId, onEvent }
     events   SDK_READY, SDK_GAME_PAUSE, SDK_GAME_START
     ads      sdk.showBanner()          — despite the name, the interstitial

   The thing to know before choosing this network: **there are no rewarded
   ads.** Their SDK documents showBanner() and nothing else. This game's
   monetization leans on rewarded placements — revive, and double your coins
   — and neither can exist here.

   So this adapter declares `caps.rewarded = false`, and the game removes
   both offers rather than showing buttons that cannot pay out. That is the
   same rule CrazyGames enforce and it is worth honouring everywhere: a
   rewarded button that does nothing is worse than no button.

   What survives is the interstitial between runs, and the coin-priced
   revive, which never needed an ad in the first place.

   Self-hosting with GameMonetize additionally requires contacting them
   (info@gamemonetize.com) — the gameId alone is not enough.
   ------------------------------------------------------------------ */
(() => {
  const GAME_ID = window.__NH_GAME_ID || '[SET YOUR GAMEMONETIZE GAME ID]';

  let ready = false, readyWaiters = [];
  let pending = null;

  const settle = (ok, err) => {
    if (!pending) return;
    const p = pending; pending = null;
    if (ok) p.adFinished && p.adFinished();
    else p.adError && p.adError(err || { code: 'other', message: 'ad failed' });
  };

  window.SDK_OPTIONS = {
    gameId: GAME_ID,
    onEvent(a){
      const n = a && a.name;
      if (n === 'SDK_READY') {
        ready = true;
        readyWaiters.splice(0).forEach(fn => fn());
      } else if (n === 'SDK_GAME_PAUSE') {
        /* the ad is on screen */
        if (pending && pending.adStarted) pending.adStarted();
      } else if (n === 'SDK_GAME_START') {
        /* their only "ad is over" signal, and it fires whether the ad played
           or was skipped for lack of fill — so it resolves the request but
           must never be read as a reward, which is moot here since this
           network has no rewarded placements at all */
        settle(true);
      }
    }
  };

  window.__NH_PROVIDER = {
    name: 'gamemonetize',
    caps: { rewarded: false, midgame: true },

    init(){
      return new Promise(resolve => {
        if (ready) return resolve();
        readyWaiters.push(resolve);
        setTimeout(resolve, 8000);      // never hang the boot on the portal
      });
    },

    ad: {
      requestAd(type, cb){
        if (type === 'rewarded') {
          /* declared unavailable in caps, so the game should never ask —
             answered honestly rather than silently if it somehow does */
          cb.adError && cb.adError({ code: 'other', message: 'no rewarded ads on this network' });
          return;
        }
        const s = window.sdk;
        if (!s || typeof s.showBanner !== 'function') {
          cb.adError && cb.adError({ code: 'other', message: 'sdk unavailable' });
          return;
        }
        pending = cb;
        /* resolution arrives on SDK_GAME_START; guard in case it never does */
        setTimeout(() => settle(false, { code: 'unfilled', message: 'no ad available' }), 20000);
        try { s.showBanner(); } catch (e) { settle(false, { code: 'other', message: 'request threw' }); }
      },
      hasAdblock(){ return Promise.resolve(false); }
    },

    game: {
      settings: { muteAudio: false, disableChat: false }
    }
  };

  const js = document.createElement('script');
  js.src = 'https://api.gamemonetize.com/sdk.js';
  js.id = 'gamemonetize-sdk';
  document.head.appendChild(js);
})();
