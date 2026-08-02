/* Playgama Bridge adapter.
   ------------------------------------------------------------------
   One integration, ~22 platforms: Playgama, Yandex Games, Y8, Poki,
   GameDistribution, CrazyGames, Telegram/PlayDeck, VK, OK, Lagged, Facebook
   Instant, MSN, Discord, Huawei, JioGames, YouTube Playables, Reddit,
   Xiaomi, Microsoft Store, GameSnacks, Aha.

   Presents the platform seam's shape — see the contract on Ads.resolve() in
   game.js — over the Bridge API.

     script   https://bridge.playgama.com/v1/stable/playgama-bridge.js
     config   playgama-bridge-config.json, beside index.html
     init     await bridge.initialize()
     ads      bridge.advertisement.showRewarded(placement)
              bridge.advertisement.showInterstitial(placement)
              bridge.advertisement.setMinimumDelayBetweenInterstitial(n)
     events   bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, s => ...)
              bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, s => ...)
              bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, s => ...)

   Three things worth knowing.

   The reward is paid only when the rewarded state is exactly 'rewarded'.
   Every other state — closed, failed, whatever else the platform emits — is
   treated as no reward. That is deliberately the safe default: paying out on
   an unrecognised state would be paying for ads nobody watched, which is the
   fastest way off a network permanently.

   Their docs say not to call showInterstitial at game start, because
   platforms that want a preroll show one themselves and an explicit call
   double-serves. This game only ever requests a midgame at a run end, so
   that is satisfied — but do not move it.

   And AUDIO_STATE_CHANGED is the host asking for silence, which is the same
   contract CrazyGames' muteAudio setting has. It is wired to the same place,
   so the portal outranks the in-game sound toggle here too.

   Licensing: Bridge is LGPL-3.0. It is loaded from their CDN rather than
   bundled into the build, which keeps it a separately-replaceable library
   rather than a derived work. Do not inline it.
   ------------------------------------------------------------------ */
(() => {
  let ready = false, readyWaiters = [];
  let pendingRewarded = null, pendingInterstitial = null;
  let sawReward = false;

  const bridge = () => window.bridge;

  const settle = (slot, ok, err) => {
    const p = slot === 'r' ? pendingRewarded : pendingInterstitial;
    if (!p) return;
    if (slot === 'r') pendingRewarded = null; else pendingInterstitial = null;
    if (ok) p.adFinished && p.adFinished();
    else p.adError && p.adError(err || { code: 'unfilled', message: 'no ad available' });
  };

  function wire(){
    const b = bridge();
    if (!b || !b.advertisement || !b.EVENT_NAME) return;
    const E = b.EVENT_NAME;

    b.advertisement.on(E.REWARDED_STATE_CHANGED, state => {
      /* 'rewarded' is the only state that pays. Anything else — closed,
         failed, or a state this adapter has never heard of — does not. */
      if (state === 'rewarded') { sawReward = true; if (pendingRewarded) pendingRewarded.adStarted && pendingRewarded.adStarted(); }
      else if (state === 'opened') { if (pendingRewarded) pendingRewarded.adStarted && pendingRewarded.adStarted(); }
      else if (state === 'closed') { settle('r', sawReward); sawReward = false; }
      else if (state === 'failed') { settle('r', false); sawReward = false; }
    });

    b.advertisement.on(E.INTERSTITIAL_STATE_CHANGED, state => {
      if (state === 'opened') { if (pendingInterstitial) pendingInterstitial.adStarted && pendingInterstitial.adStarted(); }
      else if (state === 'closed') settle('i', true);
      else if (state === 'failed') settle('i', false);
    });

    /* the host asking for silence — same contract as CrazyGames' muteAudio */
    try {
      b.platform.on(E.AUDIO_STATE_CHANGED, state => {
        const off = state === 'muted' || state === 'paused' || state === false;
        try { window.NHAudio.setSiteMute(!!off); } catch (e) {}
      });
    } catch (e) {}
  }

  window.__NH_PROVIDER = {
    name: 'playgama',
    caps: { rewarded: true, midgame: true },

    init(){
      return new Promise(resolve => {
        if (ready) return resolve();
        readyWaiters.push(resolve);
        const start = () => {
          const b = bridge();
          if (!b || !b.initialize) return;
          b.initialize()
            .then(() => { ready = true; wire();
              try { b.advertisement.setMinimumDelayBetweenInterstitial(60); } catch (e) {}
              readyWaiters.splice(0).forEach(fn => fn()); })
            .catch(() => readyWaiters.splice(0).forEach(fn => fn()));
        };
        if (bridge()) start();
        else {
          const t = setInterval(() => { if (bridge()) { clearInterval(t); start(); } }, 120);
          setTimeout(() => clearInterval(t), 9000);
        }
        /* never hang the boot on a portal that fails to answer */
        setTimeout(resolve, 10000);
      });
    },

    ad: {
      requestAd(type, cb){
        const b = bridge();
        if (!ready || !b || !b.advertisement) {
          cb.adError && cb.adError({ code: 'other', message: 'bridge unavailable' });
          return;
        }
        if (type === 'rewarded') {
          pendingRewarded = cb; sawReward = false;
          try { b.advertisement.showRewarded(); }
          catch (e) { settle('r', false, { code: 'other', message: 'request threw' }); }
        } else {
          /* Their guidance: never at game start. This game only asks at a run
             end, which is a natural break and not a preroll. */
          pendingInterstitial = cb;
          try { b.advertisement.showInterstitial(); }
          catch (e) { settle('i', false, { code: 'other', message: 'request threw' }); }
        }
      },
      hasAdblock(){ return Promise.resolve(false); }
    },

    game: {
      settings: { muteAudio: false, disableChat: false }
    }
  };

  const js = document.createElement('script');
  js.src = 'https://bridge.playgama.com/v1/stable/playgama-bridge.js';
  document.head.appendChild(js);
})();
