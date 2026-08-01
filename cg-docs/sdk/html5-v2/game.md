<!-- https://docs.crazygames.com/sdk/html5-v2/game/ -->

# Game

The `game` module contains various functionality related to the game. It can be accessed like this:

```
window.CrazyGames.SDK.game;
```

## Happy time

The `happytime()` method can be called on various player achievements (beating a boss, reaching a highscore, etc.). It makes the website celebrate (for example by launching some confetti). There is no need to call this when a level is completed, or an item is obtained.

Info

Use this feature sparingly, the celebration should remain a special moment.

Minimal exampleCallback examplePromise example

```
window.CrazyGames.SDK.game.happytime();
```

```
const callback = (error, result) => {
    if (error) {
        console.log("Happytime error (callback)", error);
    } else {
        console.log("Happytime triggered (callback)", result); // result is always undefined for happytime
    }
};
window.CrazyGames.SDK.game.happytime(callback);
```

```
try {
    const result = await window.CrazyGames.SDK.game.happytime(); // result is always undefined for happytime
    console.log("Happytime triggered", result);
} catch (e) {
    console.log("Happytime error", e);
}
```

## Gameplay start/stop

We provide functions that enable us to track when and how users are playing your games. These can be used to ensure our site does not perform resource intensive actions while a user is playing.

The `gameplayStart()` function has to be called whenever the player starts playing or resumes playing after a break (menu/loading/achievement screen, game paused, etc.).

The `gameplayStop()` function has to be called on every game break (entering a menu, switching level, pausing the game, ...) don't forget to call `gameplayStart()` when the gameplay resumes.

Minimal exampleCallback examplePromise example

```
// player pauses the game
window.CrazyGames.SDK.game.gameplayStop();
// player resumes the game
window.CrazyGames.SDK.game.gameplayStart();
```

```
const callback = (error, result) => {
    if (error) {
        console.log("Gameplay start error (callback)", error);
    } else {
        console.log("Gameplay start triggered (callback)", result); // result is always undefined for gameplayStart/Stop
    }
};
window.CrazyGames.SDK.game.gameplayStart(callback); // gameplayStop accepts a similar callback
```

```
try {
    const result = await window.CrazyGames.SDK.game.gameplayStart(); // result is always undefined for gameplayStart/Stop
    console.log("Gameplay start triggered", result);
} catch (e) {
    console.log("Gameplay start error", e);
}
```

## Game loading start/stop

We provide functions that enable us to track when and how long the loading of your game takes.

The `sdkGameLoadingStart()` function has to be called whenever you start loading your game.

The `sdkGameLoadingStop()` function has to be called when the loading is complete and eventually the gameplay starts.

Minimal exampleCallback examplePromise example

```
// Your game starts loading
window.CrazyGames.SDK.game.sdkGameLoadingStart();
// Loading...
window.CrazyGames.SDK.game.sdkGameLoadingStop();
// Next level's assets are loading now
window.CrazyGames.SDK.game.sdkGameLoadingStart();
// Assets are loaded
window.CrazyGames.SDK.game.sdkGameLoadingStop();
```

```
const callback = (error, result) => {
    if (error) {
        console.log("Game loading start error (callback)", error);
    } else {
        console.log("Game loading start triggered (callback)", result); // result is always undefined for sdkGameLoadingStart/Stop
    }
};
window.CrazyGames.SDK.game.sdkGameLoadingStart(callback); // sdkGameLoadingStop accepts a similar callback
```

```
try {
    const result = await window.CrazyGames.SDK.game.sdkGameLoadingStart(); // result is always undefined for sdkGameLoadingStart/Stop
    console.log("Game loading start triggered", result);
} catch (e) {
    console.log("Game loading start error", e);
}
```

## Invite link

This feature lets you share the Crazygames version of your game to the players and invite them to join a multiplayer game. You can call `inviteLink` with a map of parameters that correspond to your game or game room.

Callback examplePromise example

```
const callback = (error, link) => {
    if (error) {
        console.log("Invite link error (callback)", error);
    } else {
        console.log("Invite link (callback)", link);
    }
};
window.CrazyGames.SDK.game.inviteLink(
    { roomId: 12345, param2: "value", param3: "value" },
    callback
);
```

```
const link = await window.CrazyGames.SDK.game.inviteLink(
    { roomId: 12345, param2: "value", param3: "value" }
);
console.log("Invite link", link);
```

## Invite button

This feature allows you to display a button in the game footer, that opens a popup containing the invite link. The returned link is similar to the link returned from Invite link.

The invite button should only be used to invite players to a multiplayer gaming session. Please avoid using it for other use cases, such as a "Share" button for example, as this may lead to delayed submission check or even game rejection.

You can show the invite button like this:

Callback examplePromise example

```
const callback = (error, link) => {
    if (error) {
        console.log("Invite button link error (callback)", error);
    } else {
        // the returned link looks the same as the link returned by the inviteLink method
        console.log("Invite button link (callback)", link);
    }
};
window.CrazyGames.SDK.game.showInviteButton(
    { roomId: 12345, param2: "value", param3: "value" },
    callback
);
```

```
const link = await window.CrazyGames.SDK.game.showInviteButton(
    { roomId: 12345, param2: "value", param3: "value" }
);
// the returned link looks the same as the link returned by the inviteLink method
console.log("Invite button link", link);
```

Don't forget to hide the invite button when it is no longer necessary:

```
window.CrazyGames.SDK.game.hideInviteButton();
```

## Retrieving invite link parameters

The invite link parameters can be retrieved with the help of the `getInviteParam` method, for example:

Callback examplePromise example

```
const callback = (_error, link) => {
    // there isn't normally an error in this callback
    console.log("Invite param (callback)", link);
};
window.CrazyGames.SDK.game.getInviteParam("roomId", callback);
```

```
const link = await window.CrazyGames.SDK.game.getInviteParam("roomId");
console.log("Invite param", link);
```
