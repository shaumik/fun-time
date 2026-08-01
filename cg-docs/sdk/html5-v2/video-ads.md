<!-- https://docs.crazygames.com/sdk/html5-v2/video-ads/ -->

# Video ads

Requirements for Advertisements

Please be sure to read our advertisement requirements, since your game will be rejected without any feedback if it doesn't follow them.

The `ad` module contains functionality for displaying video ads and for detecting adblockers. It can be accessed like this:

```
window.CrazyGames.SDK.ad;
```

## Video ads

We support two different types of video ads: `midgame` and `rewarded`.

Midgame advertisements can happen when a user died, a level has been completed, etc.

Rewarded advertisements can be requested by the user in exchange for a reward (An additional life, a retry when the user died, a bonus starting item, extra starting health, etc.). Rewarded ads should be shown when users explicitly consent to watch an advertisement.

Midgame ad example:

Callback examplePromise example

```
const callbacks = {
    adFinished: () => console.log("End midgame ad (callback)"),
    adError: (error, errorData) => console.log("Error midgame ad (callback)", error, errorData),
    adStarted: () => console.log("Start midgame ad (callback)"),
};
window.CrazyGames.SDK.ad.requestAd("midgame", callbacks);
```

```
// Promises are not available for video ad request, please use callbacks.
```

Rewarded ad example:

Callback examplePromise example

```
const callbacks = {
    adFinished: () => console.log("End rewarded ad (callback)"),
    adError: (error, errorData) => console.log("Error rewarded ad (callback)", error, errorData),
    adStarted: () => console.log("Start rewarded ad (callback)"),
};
window.CrazyGames.SDK.ad.requestAd("rewarded", callbacks);
```

```
// Promises are not available for video ad request, please use callbacks.
```

The `adError` callback is also triggered if the ad is not filled.

The returned `errorData` object will look like this:

```
{
  "reason": "unfilled", // possible "reason" values: ["unfilled", "other"]
  "message": "No ad available"
}
```

Info

Don't forget to mute the audio and pause the game when the ad starts (`adStarted` callback), and to unmute the audio and continue the game when the ad finishes/fails to load (`adError` and `adFinished` callbacks)

## Adblock detection

You can use the code below to detect if the user has an adblocker.

Callback examplePromise example

```
const callback = (error, result) => {
    if (error) {
        console.log("Adblock usage error (callback)", error);
    } else {
        console.log("Adblock usage fetched (callback)", result);
    }
};
window.CrazyGames.SDK.ad.hasAdblock(callback);
```

```
try {
    const result = await window.CrazyGames.SDK.ad.hasAdblock();
    console.log("Adblock usage fetched", result);
} catch (e) {
    console.log("Adblock usage error", e);
}
```

Info

We require games to function even when the user has an adblock. The detection is not foolproof, and it would be very frustrating for a user not running any adblock to get a non-functional game. You can block extra content, such as custom skins, or some levels, to motivate the user to turn off their adblock. Also, keep in mind that turning off the adblock usually requires a page refresh. Make sure that the progress is saved, or the user may just decide to stop playing your game.
