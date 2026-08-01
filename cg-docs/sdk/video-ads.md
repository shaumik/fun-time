<!-- https://docs.crazygames.com/sdk/video-ads/ -->

# Video ads

The `ad` module contains functionality for displaying video ads and for detecting adblockers.

Requirements for Advertisements

Please be sure to read our advertisement requirements, since your game will be rejected without any feedback if it doesn't follow them.

## Getting started

After reading our SDK Introduction page for your engine, access the `ad` module like this:

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.ad;
```

```
CrazySDK.Ad;
```

Info

For a demo, please consult the `CrazySDK/Demo/AdModule` scene. You can run it directly in the Unity editor.

Make sure to read the introduction page on setting up your project.

```
window.ConstructCrazySDK.ad;
```

Godot 3.xGodot 4.x

```
CrazyGames.Ad
```

```
CrazyGames.Ad
```

```
CrazySDK.ad;
```

## Video ads

We support two different types of video ads: `midgame` and `rewarded`. Read more on our advertisement requirements.

- Midgame advertisements can happen when a user died, a level has been completed, etc.

- Rewarded advertisements can be requested by the user in exchange for a reward (An additional life, a retry when the user died, a bonus starting item, extra starting health, etc.).

To request a video ad:

HTML5UnityGameMakerConstructGodotCocos

```
const callbacks = {
  adFinished: () => console.log("End midgame ad"),
  adError: (error) => console.log("Error midgame ad", error),
  adStarted: () => console.log("Start midgame ad"),
};
window.CrazyGames.SDK.ad.requestAd("midgame", callbacks);
// or
window.CrazyGames.SDK.ad.requestAd("rewarded", callbacks);
```

Warning

Make sure to mute the audio and pause the game when the ad starts (`adStarted` callback), and to unmute the audio and continue the game when the ad finishes/fails to load (`adError` and `adFinished` callbacks)

```
CrazySDK.Ad.RequestAd(CrazyAdType.Midgame, () => // or CrazyAdType.Rewarded
{
    // ad started
}, (error) =>
{
    // ad error
}, () =>
{
    // ad finished, for rewarded ads give reward here
});
```

Info

Your game will automatically be paused when the ad is being requested, and be continued when the ad finishes playing.

Passing callbacks is optional, so this is also a valid call:

```
CrazySDK.Ad.RequestAd(CrazyAdType.Midgame, null, null, null);
```

```
crazy_ad_request_ad(
    "rewarded",
    function() { show_debug_message("Ad started!"); },
    function(err) { show_debug_message("Ad error: " + string(err)); },
    function() { show_debug_message("Ad finished!"); }
);
// or
crazy_ad_request_ad(
    "midgame",
    function() { show_debug_message("Ad started!"); },
    function(err) { show_debug_message("Ad error: " + string(err)); },
    function() { show_debug_message("Ad finished!"); }
);
```

```
await window.ConstructCrazySDK.ad.requestAd("midgame");
await window.ConstructCrazySDK.ad.requestAd("rewarded");
```

Warning

You’ll have to make sure to pause your game before playing the ad by setting the time scale to 0 (System action). Be sure there isn't any audio playing also while the ad is displayed. Then use the `Wait for previous action` system event and resume the game when the ad finishes by setting the time scale back to 1. Your event sheet should look like this:

Godot 3.xGodot 4.x

```
var result = yield(CrazyGames.Ad.request_ad_async("midgame"), "completed") # or "rewarded"
```

The result contains either the `"finished"` state or an error payload. You can also listen for ad lifecycle signals:

```
CrazyGamesBridge.callbacks.connect("ad_started", self, "_on_ad_started")
CrazyGamesBridge.callbacks.connect("ad_finished", self, "_on_ad_finished")
CrazyGamesBridge.callbacks.connect("ad_error", self, "_on_ad_error")
```

```
var result = await CrazyGames.Ad.request_ad_async("midgame") # or "rewarded"
```

The result contains either the `"finished"` state or an error payload. You can also listen for ad lifecycle signals:

```
CrazyGamesBridge.callbacks.ad_started.connect(_on_ad_started)
CrazyGamesBridge.callbacks.ad_finished.connect(_on_ad_finished)
CrazyGamesBridge.callbacks.ad_error.connect(_on_ad_error)
```

```
CrazySDK.ad.requestAd('midgame' /** or 'rewarded' */, {
  adError: (error) => {
    log('Ad error', error);
  },
  adStarted: () => {
    log('Ad started');
  },
  adFinished: () => {
    log('Ad finished');
  },
});
```

## Callbacks

The `adError` callback is also triggered if the ad is not filled or if something else goes wrong. Your game should be able to handle this.
CrazyGames provides fallback banners and house-ads to limit unfilled ads.

The returned `errorData` object will look like this:

```
{
    "code": "unfilled",
    "message": "No ad available"
}
```

Possible error codes:

- `adsDisabledBasicLaunch` - during Basic Launch ads are disabled

- `unfilled` - no ad available

- `adblock` - an adblocker prevents showing ads

- `adCooldown` - the ad was requested too soon, the usual midgame ad request interval is 3 minutes, taking rewarded and preroll ads into consideration.

- `other`

## Adblock detection

Info

We require games to function even when the user has an adblock. The detection is not foolproof, and it would be very frustrating for a user not running any adblock to get a non-functional game. You can block extra content, such as custom skins, or some levels, to motivate the user to turn off their adblock. Also, keep in mind that turning off the adblock usually requires a page refresh. Make sure that the progress is saved, or the user may just decide to stop playing your game.

HTML5UnityGameMakerConstructGodotCocos

You can use the code below to detect if the user has an adblocker.

```
const result = await window.CrazyGames.SDK.ad.hasAdblock();
console.log("Adblock usage fetched", result);
```

There are 2 ways of checking if the user has an active adblocker:

Via property

```
CrazySDK.Ad.AdblockStatus
```

Initially, the status will be `AdblockStatus.Detecting`. It will switch soon to `AdblockStatus.Present` (if there is an active adblocker) or `AdblockStatus.Missing`.

Via callback

You can also subscribe a callback to be called when the adblock is detected. You can also call `HasAdblock` even after the adblock is detected, and the provided callback will be called instantly.

There may be issues however if the scene changes in the meantime and the adblock detection is executed later, as now callbacks subscribed by the previous scenes may fail.

It is safer to use this method on singleton objects, or objects marked with DontDestroyOnLoad.

```
CrazySDK.Ad.HasAdblock((adblockPresent) => { print("Adblock present:" + adblockPresent); });
// or
bool adblockPresent = await CrazySDK.Ad.HasAdblockAsync();
```

You can use the code below to detect if the user has an adblocker.

```
crazy_ad_has_ad_block(
    function(result) {
        if (result) {
            show_debug_message("Ad blocker detected!");
        } else {
            show_debug_message("No ad blocker detected.");
        }
    },
    function(error) {
        show_debug_message("Error checking ad blocker: " + json_stringify(error));
    }
);
```

We detect whether the user has installed an adblock tool. We pass this information to the developer through the `hasAdBlock()` function. That function returns a boolean that you can assign to a global variable (make sure that your variable type is also boolean):

```
runtime.globalVars.HasAdblock = await window.ConstructCrazySDK.ad.hasAdblock();
```

Godot 3.xGodot 4.x

To detect if the user has an adblocker you can use:

```
var has_adblock = CrazyGames.has_adblock
```

To detect if the user has an adblocker you can use:

```
var has_adblock = CrazyGames.has_adblock
```

```
const adblockUsage = await CrazySDK.ad.hasAdblock();
```
