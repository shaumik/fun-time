<!-- https://docs.crazygames.com/requirements/technical/ -->

# Technical requirements

You must follow these technical requirements to get your game published on CrazyGames. We selected these to ensure a fluid user experience when using the platform based on our experience with succesful web games.

## File Size & Count Limits

A key factor of a web game's success is the time it takes for a user to start playing. This is why we enforce strict file size limits.

- Basic Implementation A maximum total file size of 250MB is allowed. There's a file count limit on 1500 files as high file counts will make loading slower.

- Basic Implementation The game must have an initial download size &le; 50MB. In order to be eligible for the mobile homepage, the initial download size needs to be &le; 20MB.
When the SDK is integrated (optional for basic implementation, mandatory for full implementation), the initial download size is measured between the start of loading and the occurence of the first `Gameplay start` event triggered through the `Game module`. This event should be triggered when the user enters in a playable state, so excludes menus and additional loading steps.

- In case the SDK is not integrated, total file size is used and thus should be &le; 50MB (20MB to be eligible for the mobile home page).

- For externally hosted/loaded files our QA team will evaluate based on the time it takes to reach gameplay (&le; 20 seconds).

- Use only relative paths when referring to other files in the game bundle. Never use absolute paths, as they will fail to load (see here for additional information).

Refer to our Resources section and specifically to our Unity custom build feature for optimization guidelines.

## Device & browser compatibility

Basic Implementation

- We expect games to work on Chrome and Edge. Games that don't work well on Safari will be disabled on that browser.

- A significant segment of the CrazyGames audience uses Chromebook. Games will be disabled on Chromium OS if they do not work smoothly on a 4GB RAM device.

- Game supports mouse, keyboard, and touch if mobile is supported.

- Game should be playable in landscape mode on desktop. We allow vertical/portrait games to be published, especially if they are mobile friendly, either with displaying black bars or background images around on the sides.

- CrazyGames has advanced device detection capabilities to distinguish desktop/mobile/tablet, OS browser and application type. We strongly recommend to rely on our system info to implement a device-specific experience.

### Mobile game requirements

- In order to be eligible for the mobile homepage, the initial download size can not exceed 20MB.

- You can configure supported orientation in your submission. The website will make sure your game can be played only in those orientations, by asking the users to rotate their devices. Thus, you don't need to implement any orientation lock logic.

- When playing on some devices like tablets for example, double tapping, or pressing and holding can show the magnification tool, or it can select the entire game and show a contextual menu. To prevent frustration, this CSS should be added to the `body` of your game:

```
-webkit-user-select: none;
-moz-user-select: none;
-ms-user-select: none;
user-select: none;
```

- Unity games will be disabled on iOS by default due to frequent crashes (caused by memory shortage). Once your game reaches sufficient plays our team will evaluate the game on iOS and consider enabling it.

- Mobile games should work well inside the CrazyGames App, where games open in fullscreen and can be affected by device safe areas. See the Safe are padding page for more details and examples.

- We manage Unity graphics quality (Device Pixel Ratio) to ensure good game performance for users:
For iOS devices and low memory Android devices, we choose DPR value of 1 because these devices crash with higher natively supported DPR

- For other devices the native DPR supported by the device is used (`window.devicePixelRatio`)

- We can overwrite this configuration manually if we think an exception is needed

#### Resuming audio after iOS interrupts it

##### Problem

Android keeps the AudioContext in a running state when a user moves to a different app (while still silencing the audio).

On iOS, the AudioContext enters an interrupted state when the app is backgrounded or interrupted by system events like phone calls. iOS therefore requires a proactive approach to restore sound once the user returns.

Some game engines / audio libraries handle this automatically for the developer like Unity. We did notice issues in games using Howler and PlayCanvas.

##### Solution

The context often transitions to suspended when the app is foregrounded. To revive the audio, developers must call the resume() method within a valid user-initiated gesture, such as a touchend or click event. Simply listening for a visibility change is insufficient, as WebKit restricts audio playback until a direct interaction occurs.

```
document.addEventListener("touchend", () => {
    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
    }
});
```

The AudioContext is created by the developer’s game (or library). For example when using Howler it will be at Howler.ctx, in PlayCanvas it’s at pc.app.soundManager.context.

## SDK Integration

The CrazyGames SDK

For the best user experience and to be able to tap into all value of the CrazyGames platform, integrating the SDK is important. Refer to the appropriate game engine in the side menu.

### Basic SDK Integration

Basic Implementation

If you decide to integrate the SDK for a Basic Launch, we require the following:

- A `Gameplay start` event is triggered from the `Game` module when the player reaches game state. This is used to measure initial download size.

- Take into account that Ads are not allowed in Basic Launch, and will be disabled even if you would integrate them.

### Full SDK Integration

Full Implementation

A full integration of the SDK, involves the basic integration requirements and these additional ones:

- `Gameplay start/stop` events: allow us to measure and report on gameplay experience

- (if applicable) `Data` module for saving user game progression - see Progress Save

- (if applicable) `User` module for account integration and using username/avatar - see Account Integration

- (optional) `Load start/stop` events: allow us to measure and report on in-game loading times and fail rates

## Sitelock & Whitelisting

Basic Implementation

To avoid that your game files are stolen, you might implement a sitelock in your game. Read more about in the SDK docs of your game engine. If you implement a sitelock, you need to take into account that CrazyGames operates on multiple domains. If applicable, make sure to whitelist each of our domains to allow all our users to play.

Read more on our page about Sitelock.

## User Consent

In case your game collects additional personal data beyond the events in our SDK, the game should add a Terms & Conditions and/or Privacy Policy notice to new players.

- We recommend to make this a simple notice rather than a pop-up blocking the user.

- Bloxd.io shows a good example of in-game privacy policy

- Racing Limits opens the privacy policy in a new tab
