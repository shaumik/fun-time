<!-- https://docs.crazygames.com/sdk/game/ -->

# Game

The `game` module contains various functionality related to the game. After reading our SDK Introduction page for your engine, access the `game` module like this:

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.game;
```

```
CrazySDK.Game;
```

Make sure to read the introduction page on setting up your project.

```
window.ConstructCrazySDK.game;
```

Godot 3.xGodot 4.x

```
CrazyGames.Game
```

```
CrazyGames.Game
```

```
CrazySDK.game;
```

## Game Settings

The game module contains a `settings` object, that can be accessed like this:

A Full Implementation requires `muteAudio` support for HTML5, Unity, Cocos, and Construct games.

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.game.settings;
```

The settings object contains:

- `disableChat` - if `true`, the game should disable chat (if applicable). Read more about chat on multiplayer requirements page. Locally you can use `?disableChat=true` to force this to true.

- `muteAudio` - please disable the game audio if this is true. Locally you can use `?muteAudio=true` to force this to true. This setting should take priority over your in-game audio settings. So, for example, if you also offer an "Audio On/Off" toggle in game, be sure this doesn't enable the audio back if it is disabled in the SDK settings.

You can also register a listener which will be called each time the game settings change:

```
function listener(newSettings){
    console.log("Settings updated", newSettings);
}

// to add a listener
window.CrazyGames.SDK.game.addSettingsChangeListener(listener);

// to remove a listener
window.CrazyGames.SDK.game.removeSettingsChangeListener(listener);
```

```
CrazySDK.Game.Settings;
```

The settings object contains:

- `disableChat` - if `true`, the game should disable chat (if applicable). Read more about chat on multiplayer requirements page. Locally you can use `?disableChat=true` to force this to true.

- `muteAudio` - please disable the game audio if this is true. Locally you can use `?muteAudio=true` to force this to true. This setting should take priority over your in-game audio settings. So, for example, if you also offer an "Audio On/Off" toggle in game, be sure this doesn't enable the audio back if it is disabled in the SDK settings.

Info

If your Unity game is submitted as Unity and not as HTML5, we handle audio muting automatically. In this case there is no need to work with `muteAudio` at all.

You can also register a listener which will be called each time the game settings change:

```
Action settingsListener = (newSettings) =>
{
    Debug.Log("New game settings: " + newSettings.ToString());
};

// to add a listener
CrazySDK.Game.AddSettingsChangeListener(settingsListener);

// to remove a listener
CrazySDK.Game.RemoveSettingsChangeListener(settingsListener);
```

```
crazy_game_settings()
```

The settings object contains:

- `disableChat` - if `true`, the game should disable chat (if applicable). Read more about chat on multiplayer requirements page.

```
window.ConstructCrazySDK.game.settings;
```

The settings object contains:

- `disableChat` - if `true`, the game should disable chat (if applicable). Read more about chat on multiplayer requirements page. Locally you can use `?disableChat=true` to force this to true.

- `muteAudio` - please disable the game audio if this is true. Locally you can use `?muteAudio=true` to force this to true. This setting should take priority over your in-game audio settings. So, for example, if you also offer an "Audio On/Off" toggle in game, be sure this doesn't enable the audio back if it is disabled in the SDK settings.

You can also register a listener which will be called each time the game settings change:

```
function listener(newSettings){
    console.log("Settings updated", newSettings);
}

// to add a listener
window.ConstructCrazySDK.game.addSettingsChangeListener(listener);

// to remove a listener
window.ConstructCrazySDK.game.removeSettingsChangeListener(listener);
```

Godot 3.xGodot 4.x

```
var game_settings = CrazyGames.Game.get_game_settings()
```

```
var game_settings = CrazyGames.Game.get_game_settings()
```

```
CrazySDK.game.settings;
```

The settings object contains:

- `disableChat` - if `true`, the game should disable chat (if applicable). Read more about chat on multiplayer requirements page. Locally you can use `?disableChat=true` to force this to true.

- `muteAudio` - please disable the game audio if this is true. Locally you can use `?muteAudio=true` to force this to true. This setting should take priority over your in-game audio settings. So, for example, if you also offer an "Audio On/Off" toggle in game, be sure this doesn't enable the audio back if it is disabled in the SDK settings.

You can also register a listener which will be called each time the game settings change:

```
function listener(newSettings){
    console.log("Settings updated", newSettings);
}

// to add a listener
CrazySDK.game.addSettingsChangeListener(listener);

// to remove a listener
CrazySDK.game.removeSettingsChangeListener(listener);
```

## Gameplay start/stop

We provide functions that enable us to track when and how users are playing your games. These can be used to ensure our site does not perform resource intensive actions while a user is playing.

The `gameplay start` function has to be called whenever the player starts playing or resumes playing after a break (game start, resume, revive, enter next level, ...). The first event is used to determine your game's initial loading size.

The `gameplay stop` function has to be called on every game break (entering a menu, ending level, pausing the game, ...) don't forget to call `gameplay start` when the gameplay resumes. Don't call this event when the user switches focus or leaves the game area (we handle this on our side).

You can call the methods like this:

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.game.gameplayStart();
window.CrazyGames.SDK.game.gameplayStop();
```

```
CrazySDK.Game.GameplayStart();
CrazySDK.Game.GameplayStop();
```

```
crazy_game_gameplay_start()
crazy_game_gameplay_stop()
```

```
window.ConstructCrazySDK.game.gameplayStart();
window.ConstructCrazySDK.game.gameplayStop();
```

Godot 3.xGodot 4.x

```
CrazyGames.Game.gameplay_start()
CrazyGames.Game.gameplay_stop()
```

```
CrazyGames.Game.gameplay_start()
CrazyGames.Game.gameplay_stop()
```

```
CrazySDK.game.gameplayStart();
CrazySDK.game.gameplayStop();
```

## Game loading start/stop

We provide functions that enable us to track when and how long the loading of your game takes.

The `loading start` function has to be called whenever you start loading your game.

The `loading stop` function has to be called when the loading is complete and eventually the gameplay starts.

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.game.loadingStart();
window.CrazyGames.SDK.game.loadingStop();
```

These calls are not supported for Unity, as loading is expected to be done through the Unity loader before the game starts.

```
crazy_game_loading_start()
crazy_game_loading_stop()
```

🟥 Not supported

These calls are not required for Godot, as loading is done via the Godot export.

```
CrazySDK.game.loadingStart();
CrazySDK.game.loadingStop();
```

## Happy time

The `happytime()` method can be called on various player achievements (beating a boss, reaching a highscore, etc.). It makes the website celebrate (for example by launching some confetti). There is no need to call this when a level is completed, or an item is obtained.

Info

Use this feature sparingly, the celebration should remain a special moment.

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.game.happytime();
```

```
CrazySDK.Game.HappyTime();
```

```
crazy_game_happytime()
```

```
window.ConstructCrazySDK.game.happytime();
```

Godot 3.xGodot 4.x

```
CrazyGames.Game.happy_time()
```

```
CrazyGames.Game.happy_time()
```

```
CrazySDK.game.happytime();
```

## Game completion percentage

The `reportGameCompletedPercentage` method is used to notify CrazyGames that a player has completed your game or reached a progression milestone.

Initially, this event will be used to improve the post-completion experience for players. For example, CrazyGames may use it to offer players the option to restart the game after reaching the end or notify players who had previously completed the game that the game had an update.

The method accepts a progression value between 0 and 100. While reporting only 100 is enough, we encourage developers to provide intermediate progression updates whenever possible to better understand how players progress through games; this may unlock additional platform features in the future. An example is indicating intermediate progress to players on the platform, so they can strive to reach 100% or awarding badges when they complete a game.

If your game has clear progression (e.g. levels, chapters, missions), report the player's progress as they advance. If your game does not have meaningful intermediate milestones, you can simply report 100 when the player completes the game.

For endless, sandbox, or highly replayable games, developers may define their own interpretation of what constitutes 100% completion, as long as it is applied consistently. For example, an endless game could consider reaching a specific milestone, score, or objective as completion.

Progression should generally move forward over time, and 100% should only be reported when the player reaches a meaningful completion point in the game.

If you update your game with new content (e.g. additional levels or chapters), report the correct percentage on game start to reflect the player's progress relative to the new content. For example, a player who previously reached 100% may now be at a lower percentage, so call `reportGameCompletedPercentage` with the updated value when the game loads.

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.game.reportGameCompletedPercentage(50); // player completed 50% of the game
```

🟥 Not supported

🟥 Not supported

🟥 Not supported

🟥 Not supported

🟥 Not supported

## Game context

Users can send feedback related to your game, which is sent to you via an email, and can be also viewed on our Developer Portal.

To make this feedback more actionable, you can use the `setGameContext` method to attach relevant in-game data. For example, you might include the user's current level, equipped weapon, gold amount, or active skins.

Providing this context makes it significantly easier to understand and reproduce issues. For instance, if a user reports being stuck but doesn't specify where, the attached data can immediately reveal the exact level and game state.

HTML5UnityGameMakerConstructGodotCocos

```
// this can be called at the start of the level
window.CrazyGames.SDK.game.setGameContext({
    "level": 12
});

// don't forget to clear the context when not relevant anymore, for example if the user exists the level
window.CrazyGames.SDK.game.clearGameContext();
```

```
// this can be called at the start of the level
var context = new Dictionary() { { "level", "12" } };
CrazySDK.Game.SetGameContext(context);

// don't forget to clear the context when not relevant anymore, for example if the user exists the level
CrazySDK.Game.ClearGameContext();
```

🟥 Not supported

```
// this can be called at the start of the level
window.ConstructCrazySDK.game.setGameContext({
    "level": 12
});

// don't forget to clear the context when not relevant anymore, for example if the user exists the level
window.ConstructCrazySDK.game.clearGameContext();
```

🟥 Not supported

```
// this can be called at the start of the level
CrazySDK.game.setGameContext({
    "level": 12
});

// don't forget to clear the context when not relevant anymore, for example if the user exists the level
CrazySDK.game.clearGameContext();
```

## Multiplayer features

This section describes the game specific SDK functionality supporting our Multiplayer Requirements. Refer to that page for additional context on mandatory/optional requirements.

Demo game

We also created a demo game that showcases various multiplayer features from our SDK. You can download the source code from here.

### Instant multiplayer

The game module contains the `isInstantMultiplayer` flag that indicates if you should direct the user into multiplayer mode, in a joinable location directly.

HTML5UnityGameMakerConstructGodotCocos

```
// this field was previously called isInstantJoin which is now deprecated,
// please use isInstantMultiplayer
window.CrazyGames.SDK.game.isInstantMultiplayer;
```

```
// this field was previously called IsInstantJoin which is now deprecated,
// please use IsInstantMultiplayer
CrazySDK.Game.IsInstantMultiplayer;
```

```
crazy_game_is_instant_multiplayer()
```

```
// returns a boolean
const instantMultiplayer = window.CrazyGames.SDK.game.isInstantMultiplayer;
```

The easiest way is to use it is when the SDK initializes:

```
const sdkElem = document.createElement("script");
sdkElem.type = "text/javascript";
sdkElem.src = "https://sdk.crazygames.com/Construct3CrazySDK-v3.js";
document.body.appendChild(sdkElem);
sdkElem.onload = function () {
    window.ConstructCrazySDK.init().then(() => {
        const instantMultiplayer =
            window.CrazyGames.SDK.game.isInstantMultiplayer;
        console.log("Instant multiplayer:", instantMultiplayer);

        if (instantMultiplayer) {
            // should instantly create a new room/lobby
        } else {
            runtime.goToLayout("NextLayout");
        }
    });
};
```

🟥 Not supported

```
CrazySDK.game.isInstantMultiplayer;
```

### Room data

We define the `room` as a unique location where the user is playing or waiting in your game. Having room information available on platform level allows us to improve the user experience through showing an invite button, platform notifications, status visualization, joining friends, listing other CrazyGames users in your room to make friends connections, and more. The room doesn't have to exist on the server, you could also consider a room a special case when some players are connected to each other directly, via WebRTC for example.

The `room` contains the following data:

- `roomId` - unique identifier for this room. If your game supports multiple regions, please ensure the roomId you report is unique across the regions, for example by joining the actual room id with the region id.

- `isJoinable` - allows the current player to invite other players or be joined by other players

- `inviteParams` - these will be passed to other players who accept an invitation, or join this player. Read more about the `inviteParams` in the room join listener section.

HTML5UnityGameMakerConstructGodotCocos

```
// the player joins a room
window.CrazyGames.SDK.game.updateRoom({ roomId: "123eu" });

// the room is now open, the current player can invite other players or be joined by other players
// the inviteParams are just an example, you may have other parameters required to join a specific room
window.CrazyGames.SDK.game.updateRoom({ isJoinable: true, inviteParams: { roomName: "123", region: "eu" }});

// the room is full and no more players can join
window.CrazyGames.SDK.game.updateRoom({ isJoinable: false});

// the player left the room
window.CrazyGames.SDK.game.leftRoom();

// you can always mix more parameters, for example if the player joins a room and the room is already joinable
window.CrazyGames.SDK.game.updateRoom({ roomId: "123eu", isJoinable: true, inviteParams: { roomName: "123", region: "eu" }});
```

```
// the player joins a room
CrazySDK.Game.UpdateRoom(new UpdateRoomInput() { RoomId = "123eu" });

// the room is now open, the current player can invite other players or be joined by other players
// the inviteParams are just an example, you may have other parameters required to join a specific room
CrazySDK.Game.UpdateRoom(
    new UpdateRoomInput()
    {
        IsJoinable = true,
        InviteParams = new() { { "roomName", "123" }, { "region", "eu" } },
    }
);

// the room is full and no more players can join
CrazySDK.Game.UpdateRoom(new UpdateRoomInput() { IsJoinable = false });

// the player left the room
CrazySDK.Game.LeftRoom();

// you can always mix more parameters, for example if the player joins a room and the room is already joinable
CrazySDK.Game.UpdateRoom(
    new UpdateRoomInput()
    {
        RoomId = "123eu",
        IsJoinable = true,
        InviteParams = new() { { "roomName", "1234" }, { "region", "eu" } },
    }
);
```

🟥 Not supported

```
// the player joins a room
window.ConstructCrazySDK.game.updateRoom({ roomId: "123eu" });

// the room is now open, the current player can invite other players or be joined by other players
// the inviteParams are just an example, you may have other parameters required to join a specific room
window.ConstructCrazySDK.game.updateRoom({ isJoinable: true, inviteParams: { roomName: "123", region: "eu" }});

// the room is full and no more players can join
window.ConstructCrazySDK.game.updateRoom({ isJoinable: false});

// the player left the room
window.ConstructCrazySDK.game.leftRoom();

// you can always mix more parameters, for example if the player joins a room and the room is already joinable
window.ConstructCrazySDK.game.updateRoom({ roomId: "123eu", isJoinable: true, inviteParams: { roomName: "123", region: "eu" }});
```

🟥 Not supported

```
// the player joins a room
CrazySDK.game.updateRoom({ roomId: "123eu" });

// the room is now open, the current player can invite other players or be joined by other players
// the inviteParams are just an example, you may have other parameters required to join a specific room
CrazySDK.game.updateRoom({ isJoinable: true, inviteParams: { roomName: "123", region: "eu" }});

// the room is full and no more players can join
CrazySDK.game.updateRoom({ isJoinable: false});

// the player left the room
CrazySDK.game.leftRoom();

// you can always mix more parameters, for example if the player joins a room and the room is already joinable
CrazySDK.game.updateRoom({ roomId: "123eu", isJoinable: true, inviteParams: { roomName: "123", region: "eu" }});
```

### Room join listener

When the user tries to join their friends via an invite notification, invite link or friends drawer, there are 2 possible scenarios:

- The user is already in game. In this case the room join listener will be triggered.

- The user is redirected to the game page, and the game has to load. Use the `inviteParams` in this case.

HTML5UnityGameMakerConstructGodotCocos

```
// don't forget to check window.CrazyGames.SDK.game.inviteParams on game start
// if it is not null, your game was already started from an invite link, and you should send the player to the correct room

function listener(inviteParams){
    // send the user to the multiplayer room
}

// to add a listener
window.CrazyGames.SDK.game.addJoinRoomListener(listener);

// to remove a listener
window.CrazyGames.SDK.game.removeJoinRoomListener(listener);
```

```
private void JoinRoomListener(Dictionary inviteParams)
{
    // send the user to the multiplayer room
}

private void Start()
{
    // don't forget to check CrazySDK.Game.InviteParams on game start
    // if it is not null, your game was already started from an invite link, and you should send the player to the correct room

    CrazySDK.Game.AddJoinRoomListener(JoinRoomListener);
}

private void OnDestroy()
{
    CrazySDK.Game.RemoveJoinRoomListener(JoinRoomListener);
}
```

🟥 Not supported

```
// don't forget to check window.ConstructCrazySDK.game.inviteParams on game start
// if it is not null, your game was already started from an invite link, and you should send the player to the correct room

function listener(inviteParams){
    // send the user to the multiplayer room
}

// to add a listener
window.ConstructCrazySDK.game.addJoinRoomListener(listener);

// to remove a listener
window.ConstructCrazySDK.game.removeJoinRoomListener(listener);
```

🟥 Not supported

```
// don't forget to check CrazySDK.game.inviteParams on game start
// if it is not null, your game was already started from an invite link, and you should send the player to the correct room

function listener(inviteParams){
    // send the user to the multiplayer room
}

// to add a listener
CrazySDK.game.addJoinRoomListener(listener);

// to remove a listener
CrazySDK.game.removeJoinRoomListener(listener);
```

### Invite link

This feature lets you share the CrazyGames version of your game to the players and invite them to join a multiplayer game. You can call `inviteLink` with a map of parameters that correspond to your game or game room. If your game only accepts players from the same region, you can add `region` as a parameter to the link. That way you can easily handle the scenario when users attempt to join from a different region.

HTML5UnityGameMakerConstructGodotCocos

```
const link = window.CrazyGames.SDK.game.inviteLink({
    roomName: 12345,
    param2: "value",
    param3: "value",
});
console.log("Invite link", link);
```

The invite link parameters can be retrieved with the help of the `getInviteParam` method, for example:

```
// returns either a string or null if the parameter is missing
window.CrazyGames.SDK.game.getInviteParam("roomName");
```

You can also access all invite parameters like this:

```
window.CrazyGames.SDK.game.inviteParams
```

inviteParams is `null` if the game wasn't started from an invite link.

```
var parameters = new Dictionary();
parameters.Add("roomName", "1234");
var inviteLink = CrazySDK.Game.InviteLink(parameters);
```

We provide a helper if you want to automatically copy the invite link to the clipboard.

```
CrazySDK.Game.CopyToClipboard(inviteLink);
```

You can retrieve parameters passed through the invite link with `GetInviteLinkParameter`.

```
var roomName = CrazySDK.Game.GetInviteLinkParameter("roomName");
```

```
var inviteParams = { roomId: 12345 };
var link = crazy_game_invite_link(json_stringify(inviteParams));
show_debug_message("Invite link: " + link);
```

You can retrieve parameters passed through the invite link with `crazy_game_get_invite_param`.

```
var roomCode = crazy_game_get_invite_param("roomId");
if (roomCode != undefined) {
    show_debug_message("Joined room: " + string(roomCode));
}
```

```
localVars.inviteLink = await window.ConstructCrazySDK.game.inviteLink({
    roomName: 12345,
    param2: "value",
    param3: "value",
});
```

When a player joins through an invite link, you can get the room ID like this:

```
// it returns either a string or null if the parameter is missing
const roomName = window.ConstructCrazySDK.game.getInviteParam("roomName");
```

The easiest way is to insert the invite link room code detection is when the SDK initializes:

```
const sdkElem = document.createElement("script");
sdkElem.type = "text/javascript";
sdkElem.src = "https://sdk.crazygames.com/Construct3CrazySDK-v3.js";
document.body.appendChild(sdkElem);
sdkElem.onload = function () {
    window.ConstructCrazySDK.init().then(() => {
        const roomName = window.ConstructCrazySDK.game.getInviteParam("roomName");
        console.log("Room id:", roomName);

        if (roomName) {
            runtime.globalVars.roomName = roomName;
            runtime.goToLayout("RoomLayout");
        } else {
            runtime.goToLayout("NextLayout");
        }
    });
};
```

You can also access all invite parameters like this:

```
window.ConstructCrazySDK.game.inviteParams
```

inviteParams is `null` if the game wasn't started from an invite link.

Godot 3.xGodot 4.x

```
var invite_url = CrazyGames.Game.request_invite_url({"roomId": "1234"})
```

You can copy the invite link to clipboard like this:

```
CrazyGamesBridge.copy_to_clipboard(invite_url)
```

Retrieve parameters passed through the invite link:

```
var room_id = CrazyGames.Game.get_invite_link_param("roomId")
```

```
var invite_url = CrazyGames.Game.request_invite_url({"roomId": "1234"})
```

You can copy the invite link to clipboard like this:

```
CrazyGamesBridge.copy_to_clipboard(invite_url)
```

Retrieve parameters passed through the invite link:

```
var room_id = CrazyGames.Game.get_invite_link_param("roomId")
```

```
const inviteLink = await CrazySDK.game.inviteLink({ roomName: '123' });
```

You can also access all invite parameters like this:

```
CrazySDK.game.inviteParams
```

inviteParams is `null` if the game wasn't started from an invite link.

### Invite button

Deprecated

This feature is replaced by the Room Data functionality and will be deprecated.

This feature indicates that the user is in a multiplayer room and can be joined.

HTML5UnityGameMakerConstructGodotCocos

```
const link = window.CrazyGames.SDK.game.showInviteButton({
    roomName: 12345,
    param2: "value",
    param3: "value",
});
// the returned link looks the same as the link
// returned by the inviteLink method
console.log("Invite button link", link);
```

Make sure to hide the invite button when the user can't be joined anymore (e.g. the room is full, the game has started or the lobby was canceled).

```
window.CrazyGames.SDK.game.hideInviteButton();
```

```
var parameters = new Dictionary();
parameters.Add("roomName", "1234");
// the returned link looks the same as the link
// returned by the InviteLink method
var inviteLink = CrazySDK.Game.ShowInviteButton(parameters);
```

Make sure to hide the invite button when the user can't be joined anymore (e.g. the room is full, the game has started or the lobby was canceled).

```
CrazySDK.Game.HideInviteButton();
```

```
// the returned link looks the same as the link
// returned by the crazy_game_invite_link method
var link_params = {
    roomId: 12345,
    param2: "value",
    param3: "value",
};
var link = crazy_game_show_invite_button(json_stringify(link_params));
```

Make sure to hide the invite button when the user can't be joined anymore (e.g. the room is full, the game has started or the lobby was canceled).

```
crazy_game_hide_invite_button()
```

🟥 Not supported

Godot 3.xGodot 4.x

```
var link = CrazyGames.Game.show_invite_button({"roomId": "1234"})
```

Hide it when the room is no longer joinable:

```
CrazyGames.Game.hide_invite_button()
```

```
var link = CrazyGames.Game.show_invite_button({"roomId": "1234"})
```

Hide it when the room is no longer joinable:

```
CrazyGames.Game.hide_invite_button()
```

```
const link = CrazySDK.game.showInviteButton({
    roomName: 12345,
    param2: "value",
    param3: "value",
});
// the returned link looks the same as the link
// returned by the inviteLink method
console.log("Invite button link", link);
```

Make sure to hide the invite button when the user can't be joined anymore (e.g. the room is full, the game has started or the lobby was canceled).

```
CrazySDK.game.hideInviteButton();
```
