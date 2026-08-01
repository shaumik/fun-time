<!-- https://docs.crazygames.com/sdk/banners/ -->

# Banners

The `banner` module contains functionality for displaying banners within your game.

Requirements for Advertisements

Please be sure to read our advertisement requirements, since your game will be rejected without any feedback if it doesn't follow them.

## Getting started

After reading our SDK Introduction page for your engine, access the `banner` module like this:

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.banner
```

```
CrazySDK.Banner;
```

Info

For a demo, please consult the `CrazySDK/Demo/BannerModule` scene. You can run it directly in the Unity editor.

When testing banners locally in your browser, please ensure you are using a WebGL template that stretches the game to cover the entire screen (for example the built-in PWA template). Otherwise, the position of the browser banners won't match your positioning in editor.

Make sure to read the introduction page on setting up your project.

```
window.ConstructCrazySDK.banner;
```

Godot 3.xGodot 4.x

```
CrazyGames.Ad
```

```
CrazyGames.Ad
```

🟥 Not supported

## Request static banner

This paragraph explains how to request static banners. There are 5 banner sizes available:

- Leaderboard (728x90)

- Medium (300x250)

- Mobile (320x50)

- Main (468x60)

- Large Mobile (320x100)

HTML5UnityGameMakerConstructGodotCocos

To begin, you need to have an HTML container of the banner size present on the screen:

```

```

And fill that using javascript:

```
try {
  // await is not mandatory when requesting banners,
  // but it will allow you to catch errors
  await window.CrazyGames.SDK.banner.requestBanner({
    id: "banner-container",
    width: 300,
    height: 250,
  });
} catch (e) {
  console.log("Banner request error", e);
}
```

We provide a banner prefab, which you can find in `CrazySDK/Resources`. Drag the banner prefab into your scene.

To change the banner size, modify the Banner size property of the newly created object.

To change the banner position, select the `Banner` child of the newly created object and change its position.

Showing and hiding the banners is done similar to other Unity GameObjects, by calling the `SetActive(false)` or `SetActive(true)` method.

You can request one or more banners using the `crazy_banner_request_banner()` function, with these arguments:

- `banner_id` - integer

- `width` - integer

- `height` - integer

- `position` - string

```
crazy_banner_request_banner(
    0,
    300, 250,
    CRAZY_BANNER_POSITION.CENTER_MIDDLE,
    function() { show_debug_message("Static banner loaded!"); },
    function(err) { show_debug_message("Banner failed: " + json_stringify(err)); }
);
```

Request banners like this:

```
await window.ConstructCrazySDK.banner.requestBanners([
{
    id: "main-menu-banner-1",
    width: 300,
    height: 250,
    x: 0,
    y: 0,
},
{
    id: "main-menu-banner-2",
    width: 300,
    height: 250,
    // display banner in right corner
    // 922 is layout width, 300 banner width
    x: 922 - 300,
    y: 0,
},
]);
```

The method takes a single argument which is an array of banners, so you can request also 1 banner for example. When calling the method, all the previous banners will be removed. If you need to refresh the banners, call the method again with the same banner list.

You have to specify all 5 parameters for each banner:

- `id:` a unique id to identify the banner

- `x:` the horizontal position for the banner, from the bottom left screen corner

- `y:` vertical position of the banner, from the bottom left screen corner

- `width:` the banner width

- `height:` the banner height

Godot 3.xGodot 4.x

Use the built-in `CrazyBanner` control from the addon (`res://addons/crazygames/Utils/crazy_banner.tscn`) and place it in your UI scene.

The control maps to these supported sizes:
- `LEADERBOARD_728x90`
- `MEDIUM_300x250`
- `MOBILE_320x50`
- `MAIN_BANNER_468x60`
- `LARGE_MOBILE_320x100`

After showing/hiding banners, refresh the visible overlays:

```
CrazyGames.Ad.refresh_banners()
```

Use the built-in `CrazyBanner` control from the addon (`res://addons/crazygames/Utils/crazy_banner.tscn`) and place it in your UI scene.

The control maps to these supported sizes:
- `LEADERBOARD_728x90`
- `MEDIUM_300x250`
- `MOBILE_320x50`
- `MAIN_BANNER_468x60`
- `LARGE_MOBILE_320x100`

After showing/hiding banners, refresh the visible overlays:

```
CrazyGames.Ad.refresh_banners()
```

🟥 Not supported

## Request responsive banner

The responsive banners feature will request ads that fit into your container, without the need to specify or select a size beforehand. The resulting banners will have one of the following sizes:

- 970x90

- 320x50

- 160x600

- 336x280

- 728x90

- 300x600

- 468x60

- 970x250

- 300x250

- 250x250

- 120x600

Only banners that fit into your container will be displayed, if your container cannot fit any of these sizes no ad will be rendered. The rendered banner is automatically vertically and horizontally centered into your container.

HTML5UnityGameMakerConstructGodotCocos

Set your container size to a non-null value:

```

```

Request the responsive banner:

```
try {
  // await is not mandatory when requesting banners, but it will allow you to catch errors
  await window.CrazyGames.SDK.banner.requestResponsiveBanner("responsive-banner-container");
} catch (e) {
  console.log("Error on request responsive banner", e);
}
```

Not available for Unity

Similar to static banners, you can request responsive banners like this:

```
crazy_banner_request_responsive_banner(
    0,
    160, 600,
    CRAZY_BANNER_POSITION.CENTER_MIDDLE,
    function() { show_debug_message("Responsive banner loaded!"); },
    function(err) { show_debug_message("Responsive banner failed: " + json_stringify(err)); }
);
```

Not available

🟥 Not supported by the Godot SDK wrapper.

🟥 Not supported

## Errors

Requesting a banner can also throw an error, for example:

```
{
    "code": "bannerCooldown",
    "message": "A banner has already been requested for container banner-container-crazygames-inner less than 30 seconds ago, please wait.",
    "containerId": "banner-container-crazygames-inner"
}
```

Possible error codes:

- `bannersDisabledBasicLaunch` - during Basic Launch banners are disabled

- `unfilled` - no banner available

- `missingId` - the banner id wasn't provided

- `notVisible` - the banner container is not fully visible on page, please ensure it doesn't go out of the page and it is not hidden

- `noAvailableSizes` - the requested responsive banner size doesn't fit any of our available sizes

- `notCreated` - the banner container is not present on the page

- `videoAdPlaying` - banners cannot be rendered/refreshed while a video ad is playing

- `invalidSize` - banner size is not valid, please use only the available sizes

- `bannerCooldown` - banners cannot be refreshed too quickly, please allow for some time, normally 30 seconds, before refreshing the same container banner

- `maxRefreshReached` - you reached the banner refresh limit per gaming session

- `bannersDisabledMobileApp` - banners cannot be rendered when your game is embedded in the mobile app

- `other`

## Refreshing & clearing banners

HTML5UnityGameMakerConstructGodotCocos

To refresh the banners, simply call the `requestBanner` or `requestResponsiveBanner` methods again with the same container id.

The banners have the following limitations:

- There is a minimum delay of 30 seconds between banner refreshes. If you call the request banner methods more often, you will receive the following error: `A banner has already been requested for container banner-container less than 30 seconds ago, please wait.`

- During a gaming session the banners can be refreshed up to 120 times (this applies to each banner size separately).

Clearing the banners

The SDK provides 2 methods for clearing the banners:

```
window.CrazyGames.SDK.banner.clearBanner("banner-container");
// or
window.CrazyGames.SDK.banner.clearAllBanners();
```

We recommend that you clear the banners after hiding them. Otherwise, when you request new banners again, the old banners may still appear for a fraction of a second, which negatively impacts the user experience.

Adding and positioning the banners in your scene is only part of what takes to display banners. Since the banners are rendered with JavaScript above your game, you also need to manually request a banner refresh.

This is done by calling the following method:

```
CrazySDK.Banner.RefreshBanners()
```

The method needs to be called:

- when you want to refresh the banners

- when you load a scene that has some visible banners from the start

- after showing/hiding banners, for example when transitioning between different menus

- after navigating to another scene, so the banners displayed in the previous scene are cleared. For a better user experience, before leaving a scene that contains banners, disable them by calling `SetActive(false)`, and call the `CrazySDK.Banner.RefreshBanners()` method.

This will clear all banners:

```
crazy_banner_clear_all_banners()
```

To clear a single banner, use these functions, passing the `banner_id`:

```
crazy_banner_clear_banner(0)
crazy_banner_clear_responsive_banner(0)
```

If you need to hide all the displayed banners, call this method:

```
await window.ConstructCrazySDK.banner.hideAllBanners();
```

Godot 3.xGodot 4.x

To refresh banners, call:

```
CrazyGames.Ad.refresh_banners()
```

To clear all currently rendered overlay banners:

```
CrazyGames.Ad.request_banners([])
```

To refresh banners, call:

```
CrazyGames.Ad.refresh_banners()
```

To clear all currently rendered overlay banners:

```
CrazyGames.Ad.request_banners([])
```

🟥 Not supported

## Limitations

Banners won't display if they do not follow any of these rules:

- The same banner can be re-displayed only 30 seconds after the last display.

- The banner has to be fully inside the game window.
