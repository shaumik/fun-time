<!-- https://docs.crazygames.com/sdk/html5-v2/banners/ -->

# Banners

Requirements for Advertisements

Please be sure to read our advertisement requirements, since your game will be rejected without any feedback if it doesn't follow them.

The `banner` module contains functionality for displaying banners in game. It can be accessed like this:

```
window.CrazyGames.SDK.banner;
```

## Request banner

To begin, you need to have an HTML container of the banner size present on the screen.

```

```

Available sizes are:

- 728x90

- 300x250

- 320x50

- 468x60

- 320x100

Minimal exampleCallback examplePromise example

```
window.CrazyGames.SDK.banner.requestBanner({
    id: "banner-container",
    width: 300,
    height: 250,
});
```

```
const callback = (error, result) => {
    if (error) {
        console.log("Error on request banner (callback)", error);
    } else {
        console.log("End request banner (callback)", result); // result is always undefined when requesting banners
    }
};
window.CrazyGames.SDK.banner.requestBanner(
    {
        id: "banner-container",
        width: 300,
        height: 250,
    },
    callback
);
```

```
try {
    const result = await window.CrazyGames.SDK.banner.requestBanner(
        {
            id: "banner-container",
            width: 300,
            height: 250,
        }
    );
    console.log("End request banner", result); // result is always undefined when requesting banners
} catch (e) {
    console.log("Error on request banner", e);
}
```

Info

You can have no more than 2 banners of the same size in your game.

## Request responsive banner

The responsive banners feature will requests ads that fit into your container, without the need to specify or select a size beforehand. The resulting banners will have one of the following sizes: 970x90, 320x50, 160x600, 336x280, 728x90, 300x600, 468x60, 970x250, 300x250, 250x250 and 120x600. Only banners that fit into your container will be displayed, if your container cannot fit any of these sizes no ad will be rendered. The rendered banner is automatically vertically and horizontally centered into your container.

Info

Your container size must be set to a non-null value:

```

```

Minimal exampleCallback examplePromise example

```
window.CrazyGames.SDK.banner.requestResponsiveBanner(
    "responsive-banner-container"
);
```

```
const callback = (error, result) => {
    if (error) {
        console.log("Error on request responsive banner (callback)", error);
    } else {
        console.log("End request responsive banner (callback)", result); // result is always undefined when requesting banners
    }
};
window.CrazyGames.SDK.banner.requestResponsiveBanner("responsive-banner-container", callback);
```

```
try {
    const result = await window.CrazyGames.SDK.banner.requestResponsiveBanner("responsive-banner-container");
    console.log("End request responsive banner", result); // result is always undefined when requesting banners
} catch (e) {
    console.log("Error on request responsive banner", e);
}
```

## Refreshing banners and limitations

To refresh the banners, simply call again the `requestBanner` or `requestResponsiveBanner` methods.

The banners have the following limitations:

- There is a minimum delay of 60 seconds between banner refreshes. If you call the request banner methods more often, you will receive the following error: `A banner has already been requested for container banner-container less than 57 seconds ago, please wait.`

- During a gaming session the banners can be refreshed up to 60 times (this applies to each banner size separately).

## Clearing the banners

The SDK provides 2 methods for clearing the banners:

```
window.CrazyGames.SDK.banner.clearBanner("banner-container");
// or
window.CrazyGames.SDK.banner.clearAllBanners();
```

We recommend that you clear the banners after hiding them. Otherwise, when you request new banners again, the old banners may still appear for a fraction of a second, which negatively impacts the user experience.
