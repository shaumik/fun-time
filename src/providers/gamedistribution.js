/* GameDistribution (Azerion) adapter.
   ------------------------------------------------------------------
   Presents the platform seam's shape — see the contract documented on
   Ads.resolve() in game.js — over the GD HTML5 SDK, so the game itself
   needs no knowledge that it is running here.

   Verified against https://github.com/GameDistribution/GD-HTML5/wiki
   (SDK Implementation, Rewarded Ads):

     script   https://html5.api.gamedistribution.com/main.min.js
     config   window.GD_OPTIONS = { gameId, prefix, advertisementSettings, onEvent }
     events   SDK_READY, SDK_ERROR, SDK_GAME_START, SDK_GAME_PAUSE,
              SDK_REWARDED_WATCH_COMPLETE, AD_ERROR
     ads      gdsdk.showAd()            interstitial
              gdsdk.showAd('rewarded')  rewarded, returns a promise
              gdsdk.preloadAd('rewarded')

   Two caveats worth knowing before shipping this build.

   Their docs say showAd should be triggered behind a touchUp/mouseUp. The
   rewarded placements here are click handlers, so they satisfy that. The
   midgame fires from endRun after a wreck, which is not a gesture — if GD
   refuse it, it surfaces as an adError, the game continues, and the only
   loss is that interstitial. It fails safe rather than wrong.

   And the reward is given on SDK_REWARDED_WATCH_COMPLETE, not on the
   promise resolving. Their guide is explicit that a caught error must not
   pay out, and the event is the only signal that the ad was watched to the
   end rather than dismissed.
   ------------------------------------------------------------------ */
(() => {
  const GAME_ID = window.__NH_GAME_ID || '[SET YOUR GAMEDISTRIBUTION GAME ID]';

  let ready = false, readyWaiters = [], failed = false;
  /* set while a rewarded ad is in flight, so the completion event knows
     which request to pay out */
  let pending = null;

  const settle = (ok, err) => {
    if (!pending) return;
    const p = pending; pending = null;
    if (ok) p.adFinished && p.adFinished();
    else p.adError && p.adError(err || { code: 'other', message: 'ad failed' });
  };

  window.GD_OPTIONS = {
    gameId: GAME_ID,
    prefix: 'neonheat__',
    advertisementSettings: { debug: false, autoplay: false, locale: 'en' },
    onEvent(event) {
      const n = event && event.name;
      if (n === 'SDK_READY') {
        ready = true;
        readyWaiters.splice(0).forEach(fn => fn());
      } else if (n === 'SDK_ERROR') {
        failed = true;
        readyWaiters.splice(0).forEach(fn => fn());
      } else if (n === 'SDK_GAME_PAUSE') {
        /* the ad is actually on screen now */
        if (pending && pending.adStarted) pending.adStarted();
      } else if (n === 'SDK_REWARDED_WATCH_COMPLETE') {
        settle(true);
      } else if (n === 'AD_ERROR') {
        settle(false, { code: 'unfilled', message: 'no ad available' });
      }
    }
  };

  const sdk = () => window.gdsdk;

  window.__NH_PROVIDER = {
    name: 'gamedistribution',
    /* GD has no rewarded/midgame distinction to advertise beyond this, but
       both exist, so the offers stay live */
    caps: { rewarded: true, midgame: true },

    init(){
      return new Promise(resolve => {
        if (ready || failed) return resolve();
        readyWaiters.push(resolve);
        /* never hang the boot on a portal that fails to answer */
        setTimeout(resolve, 8000);
      }).then(() => {
        try { sdk() && sdk().preloadAd('rewarded'); } catch (e) {}
      });
    },

    ad: {
      requestAd(type, cb){
        const s = sdk();
        if (!s || failed) { cb.adError && cb.adError({ code: 'other', message: 'sdk unavailable' }); return; }
        if (type === 'rewarded') {
          pending = cb;
          /* Payout rides on SDK_REWARDED_WATCH_COMPLETE. The promise is used
             only to catch failure — their guide is explicit that a rejected
             rewarded ad must not pay out. */
          try {
            s.showAd('rewarded').catch(() => settle(false, { code: 'unfilled', message: 'no ad available' }));
          } catch (e) { settle(false, { code: 'other', message: 'request threw' }); }
          /* and preload the next one while this is playing */
          try { s.preloadAd('rewarded'); } catch (e) {}
        } else {
          pending = cb;
          try {
            s.showAd().then(() => settle(true))
                      .catch(() => settle(false, { code: 'unfilled', message: 'no ad available' }));
          } catch (e) { settle(false, { code: 'other', message: 'request threw' }); }
        }
      },
      /* GD exposes no adblock probe; the game treats unknown as "assume it
         works" and learns from the first error instead */
      hasAdblock(){ return Promise.resolve(false); }
    },

    /* GD has no gameplay/loading telemetry, no portal mute, and no account
       system. Every one of these is optional at the call site, so they are
       simply absent rather than faked. */
    game: {
      settings: { muteAudio: false, disableChat: false }
    }
  };

  const js = document.createElement('script');
  js.src = 'https://html5.api.gamedistribution.com/main.min.js';
  document.head.appendChild(js);
})();
