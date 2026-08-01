<!-- https://docs.crazygames.com/sdk/html5-v2/intro/ -->

# HTML5 v2 SDK

Info

We recommend that you migrate to the new HTML5 v3 SDK, which contains more features.

## Requirements

When integrating the CrazyGames SDK, make sure to follow our requirements.
They will help you use the SDK in the best way possible and guide you in terms of technical, gameplay, ads and account integration requirements.

## Installation

You can install the SDK by including the following script in the head of your game's `index.html`:

```

```

The SDK doesn't need to be initialized before being used. The initialization is done internally.

## Development

Your game runs on different domains during development/release, which the SDK considers to be different environments.

- The `localhost` and `127.0.0.1` domains are considered `local` environments. Advertisements are not available. Instead, an overlay text will be displayed. For other events such as happy time, gameplay start, etc. the console output can be consulted. If you are using a different domain/ip for local development, you can always enforce the `local` environment by appending the `?useLocalSdk=true` query parameter to the URL in your browser.

- On `CrazyGames` domains the SDK has the `crazygames` environment, where it functions properly.

- On any other domains (including your domain on which you may host your game) the SDK has the `disabled` environment. All the calls to the SDK methods will throw an error (or call the error callback). To prevent this, we recommend checking on which environment the SDK is running, and avoid making use of it outside `local` or `crazygames` environments.

You can check the environment like this:

Callback examplePromise example

```
const callback = (_error, environment) => {
    console.log(environment); // 'local', 'crazygames' or 'disabled'
};
window.CrazyGames.SDK.getEnvironment(callback);
```

```
const environment = await window.CrazyGames.SDK.getEnvironment();
console.log(environment); // 'local', 'crazygames' or 'disabled'
```

## Modules

The SDK has the following modules:

- `ad` - display video ads, detect adblockers

- `banner` - display banners

- `game` - various game events

- `user` - for interacting with the currently signed in user

Each one of these modules can be accessed as follows:

`window.CrazyGames.SDK.[moduleName]`, for example `window.CrazyGames.SDK.ad`.

## Other

### Disable unwanted page scroll

By default, browsers scroll the page when a user presses spacebar or the arrow keys. Your game should prevent this behavior. You might not notice it in development because your game is taking on the full height of the window. But when your game is embedded on CrazyGames, you’ll need to prevent scroll.
You can do so by adding the following code to your game:

```
window.addEventListener("wheel", (event) => event.preventDefault(), {
    passive: false,
});

window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", " "].includes(event.key)) {
        event.preventDefault();
    }
});
```

### Sitelock

We currently do not have a sitelock for plain Javascript games but do recommend building in some protections to avoid your game files getting stolen.

### Init

You don't need to call `init()` anymore. The new SDK does the initialization on its own.

### Global event listeners

The global events (`'adStarted'`, `'adFinished'`, etc.) are gone. Now the methods accept a callback object with various callbacks. Although callbacks can be passed to almost every SDK method in the SDK V2, they are most useful for ads, where you need to know when an ad starts or completes.

v1 SDKv2 SDK

```
const crazysdk = window.CrazyGames.CrazySDK.getInstance();
// init and wait until it gets initialized...
crazysdk.removeEventListener("adFinished", () => console.log("End rewarded ad (callback)"));
crazysdk.removeEventListener("adError", (error) => console.log("Error rewarded ad (callback)", error));
crazysdk.removeEventListener("adStarted", () => console.log("Start rewarded ad (callback)"));
crazysdk.requestAd("rewarded");
```

```
const callbacks = {
    adFinished: () => console.log("End rewarded ad (callback)"),
    adError: (error, errorData) => console.log("Error rewarded ad (callback)", error, errorData),
    adStarted: () => console.log("Start rewarded ad (callback)"),
};
window.CrazyGames.SDK.ad.requestAd("rewarded", callbacks);
```

### Single banner request

The new `requestBanner` method can request a single banner at a time. The limit of maximum 2 banners of the same size is still present.

v1 SDKv2 SDK

```
crazysdk.requestBanner([
    {
        containerId: "banner-container",
        size: "300x250",
    },
]);
```

```
window.CrazyGames.SDK.banner.requestBanner({
    id: "banner-container",
    width: 300,
    height: 250,
});
```
