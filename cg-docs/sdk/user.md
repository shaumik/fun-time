<!-- https://docs.crazygames.com/sdk/user/ -->

# User

The user module provides various account functionality that you can use to authenticate a user in your game. This means that the CrazyGames players who are logged in on the platform will be able to play games that require a user account without having to register in the game. They will also be logged in automatically in the game on other devices where they use the same CrazyGames account.

The account integration page already familiarized you with the possible user integration scenarios. For the scenarios where authentication is available, please consult the appropriate link below.

## Getting started

After reading our SDK Introduction page for your engine, the `user` module can be accessed like this:

HTML5UnityGameMakerConstructGodotCocos

```
window.CrazyGames.SDK.user;
```

```
CrazySDK.User;
```

Consult the Demo

For a demo, please consult the `CrazySDK/Demo/UserModule` scene. You can run it directly in the Unity editor.

Make sure to read the introduction page on setting up your project.

```
window.ConstructCrazySDK.user;
```

Refer to HTML5

The Construct functionality is similar to the HTML5 SDK user module, so please refer to the corresponding HTML5 tab.

Godot 3.xGodot 4.x

```
CrazyGames.User
```

```
CrazyGames.User
```

```
CrazySDK.user
```

## Check availability

Basic Implementation
Full Implementation

The user account functionality is not available on other domains that embed your CrazyGames game. Before using any user account features, you should always ensure that the user account system is available.

HTML5UnityGameMakerConstructGodotCocos

```
const available = window.CrazyGames.SDK.user.isUserAccountAvailable;
console.log("User account system available", available);
```

```
var isAvailable = CrazySDK.User.IsUserAccountAvailable;
```

```
crazy_user_is_user_account_available()
```

🟥 Not supported

Godot 3.xGodot 4.x

```
var is_available = CrazyGames.User.is_user_account_available()
```

```
var is_available = CrazyGames.User.is_user_account_available()
```

```
const available = CrazySDK.user.isUserAccountAvailable;
```

## Get current user

Basic Implementation
Full Implementation

You can retrieve the user currently logged in CrazyGames with the following method:

HTML5UnityGameMakerConstructGodotCocos

```
const user = await window.CrazyGames.SDK.user.getUser();
console.log("Get user result", user);
```

```
CrazySDK.User.GetUser(user =>
{
    if (user != null)
    {
        Debug.Log("Get user result: " + user);
    }
    else
    {
        Debug.Log("User is not logged in");
    }
});
// or
var user = await CrazySDK.User.GetUserAsync();
```

```
crazy_user_get_user(
    function(user) { show_debug_message("User: " + json_stringify(user)); },
    function(err) { show_debug_message("Error: " + json_stringify(err)); }
);
```

🟥 Not supported

Godot 3.xGodot 4.x

```
var user = yield(CrazyGames.User.get_user_async(), "completed")
```

```
var user = await CrazyGames.User.get_user_async()
```

```
const user = await CrazySDK.user.getUser();
```

If the user is not logged in CrazyGames, the returned user will be `null`

User ID

The user ID `__dangerousUserId` should not be used for authentication. Anyone can easily inject malicious code in the browser, including user IDs, and gain access to other user accounts. For authentication, please use the user token.

The returned user object will look like this:

HTML5UnityGameMakerConstructGodotCocos

```
{
    "__dangerousUserId": "GAR5irLOPebfbol3QXww2WL1Ja61",
    "username": "SingingCheese.TLNU", // 6-20 chars (alfanumeric, period, underscores)
    "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/4.png"
}
```

```
public class PortalUser
{
    public string __dangerousUserId;
    public string username; // 6-20 chars (alfanumeric, period, underscores)
    public string profilePictureUrl;
}
```

```
{
    "__dangerousUserId": "GAR5irLOPebfbol3QXww2WL1Ja61",
    "username": "SingingCheese.TLNU", // 6-20 chars (alfanumeric, period, underscores)
    "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/4.png"
}
```

🟥 Not supported

Godot 3.xGodot 4.x

```
{
    "__dangerousUserId": "GAR5irLOPebfbol3QXww2WL1Ja61",
    "username": "SingingCheese.TLNU",
    "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/4.png"
}
```

```
{
    "__dangerousUserId": "GAR5irLOPebfbol3QXww2WL1Ja61",
    "username": "SingingCheese.TLNU",
    "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/4.png"
}
```

```
{
    "__dangerousUserId": "GAR5irLOPebfbol3QXww2WL1Ja61",
    "username": "SingingCheese.TLNU", // 6-20 chars (alfanumeric, period, underscores)
    "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/4.png"
}
```

CrazyGames usernames are 6-20 characters and can contain letters, numbers, period and underscore.

## System info

Basic Implementation
Full Implementation

System info can be retrieved like this:

HTML5UnityGameMakerConstructGodotCocos

```
const systemInfo = window.CrazyGames.SDK.user.systemInfo;
```

```
var systemInfo = CrazySDK.User.SystemInfo;
```

```
crazy_user_get_user_system_info()
```

🟥 Not supported

Godot 3.xGodot 4.x

```
var system_info = CrazyGamesBridge.get_system_info()
```

```
var system_info = CrazyGamesBridge.get_system_info()
```

```
const systemInfo = CrazySDK.user.systemInfo;
```

The response will look like this:

HTML5UnityGameMakerConstructGodotCocos

```
{
    "countryCode": "US",
    "locale": "en-US",
    "device": {
        // possible values: "desktop", "tablet", "mobile"
        "type": "desktop"
    },
    "os": {
        //Format cfr. [ua-parser-js](https://github.com/faisalman/ua-parser-js){target=\_blank}
        "name": "Windows",
        "version": "10"
    },
    "browser": {
        //Format cfr. [ua-parser-js](https://github.com/faisalman/ua-parser-js){target=\_blank}
        "name": "Chrome",
        "version": "107.0.0.0"
    },
    "applicationType": "web" // possible values: "google_play_store", "apple_store", "pwa", "web"
}
```

```
Debug.Log(systemInfo.countryCode);
Debug.Log(systemInfo.locale);
// For browser and os, format is the same as
// https://github.com/faisalman/ua-parser-js
Debug.Log(systemInfo.browser.name);
Debug.Log(systemInfo.browser.version);
Debug.Log(systemInfo.os.name);
Debug.Log(systemInfo.os.version);
// possible values: "desktop", "tablet", "mobile"
Debug.Log(systemInfo.device.type);
// possible values: "google_play_store", "apple_store", "pwa", "web"
Debug.Log(systemInfo.applicationType);
```

```
{
    "countryCode": "US",
    "locale": "en-US",
    "device": {
        // possible values: "desktop", "tablet", "mobile"
        "type": "desktop"
    },
    "os": {
        //Format cfr. [ua-parser-js](https://github.com/faisalman/ua-parser-js){target=\_blank}
        "name": "Windows",
        "version": "10"
    },
    "browser": {
        //Format cfr. [ua-parser-js](https://github.com/faisalman/ua-parser-js){target=\_blank}
        "name": "Chrome",
        "version": "107.0.0.0"
    },
    "applicationType": "web" // possible values: "google_play_store", "apple_store", "pwa", "web"
}
```

🟥 Not supported

Godot 3.xGodot 4.x

```
{
    "countryCode": "US",
    "locale": "en-US",
    "device": {
        "type": "desktop"
    },
    "os": {
        "name": "Windows",
        "version": "10"
    },
    "browser": {
        "name": "Chrome",
        "version": "107.0.0.0"
    },
    "applicationType": "web"
}
```

```
{
    "countryCode": "US",
    "locale": "en-US",
    "device": {
        "type": "desktop"
    },
    "os": {
        "name": "Windows",
        "version": "10"
    },
    "browser": {
        "name": "Chrome",
        "version": "107.0.0.0"
    },
    "applicationType": "web"
}
```

```
{
    "countryCode": "US",
    "locale": "en-US",
    "device": {
        // possible values: "desktop", "tablet", "mobile"
        "type": "desktop"
    },
    "os": {
        //Format cfr. [ua-parser-js](https://github.com/faisalman/ua-parser-js){target=\_blank}
        "name": "Windows",
        "version": "10"
    },
    "browser": {
        //Format cfr. [ua-parser-js](https://github.com/faisalman/ua-parser-js){target=\_blank}
        "name": "Chrome",
        "version": "107.0.0.0"
    },
    "applicationType": "web" // possible values: "google_play_store", "apple_store", "pwa", "web"
}
```

Warning

If you want to automatically set the language of the game based on user location, please use the locale field for this.

## Get friends

Basic Implementation
Full Implementation

You can retrieve current user's friends like this:

HTML5UnityGameMakerConstructGodotCocos

```
try {
    const friendsPage = await window.CrazyGames.SDK.user.listFriends({page: 1, size: 10}); // page starts at 1, max size is 50
    console.log("List friends result", friendsPage);
} catch (e) {
    console.log("Error:", e);
}
```

```
CrazySDK.User.ListFriends(
    1, // page, starts at 1
    10, // items per page, max 50
    (error, friendsPage) =>
    {
        if (error != null)
        {
            Debug.LogError("List friends error: " + error);
            return;
        }
        foreach (var friend in friendsPage.friends)
        {
            Debug.Log("Friend: " + friend);
        }
    }
);
// or
try
{
    var friendsPage = await CrazySDK.User.ListFriendsAsync(1 /* page starts at 1 */, 10 /* items per page, max 50 */);
    foreach (var friend in friendsPage.friends)
    {
        Debug.Log("Friend: " + friend);
    }
}
catch (SdkError e)
{
    Debug.LogError("List friends error (async): " + e);
}
```

🟥 Not supported

```
try {
    const friendsPage = await window.ConstructCrazySDK.user.listFriends({page: 1, size: 10}); // page starts at 1, max size is 50
    console.log("List friends result", friendsPage);
} catch (e) {
    console.log("Error:", e);
}
```

🟥 Not supported

```
try {
    const friendsPage = await CrazySDK.user.listFriends({page: 1, size: 10}); // page starts at 1, max size is 50
    console.log("List friends result", friendsPage);
} catch (e) {
    console.log("Error:", e);
}
```

The response will look like this:

HTML5UnityGameMakerConstructGodotCocos

```
{
    "friends": [
        {
            "id": "Uvqz2K6p7qOG9BMW0gW3Lso6lC02",
            "username": "SunMedusa.cWV0",
            "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/16.png",
        }
    ],
    "page": 1,
    "size": 10,
    "hasMore": false,
    "total": 1
}
```

Check the above code for displaying the response.

🟥 Not supported

🟥 Not supported

🟥 Not supported

🟥 Not supported

The following error codes can be returned:

- `userNotAuthenticated` - the user is not logged in CrazyGames

- `rateLimited` - method calls are limited every 250ms

- `requestInProgress` - only one active call is allowed

- `unexpectedError`

## Get user token

Basic Implementation
Full Implementation

The user token contains the `userId` of the player that is currently logged in CrazyGames, as well as other useful information (`username`, `profilePictureUrl`, etc). You should send it to your server when required, and verify/decode it there to extract the `userId`. This is useful for linking the user accounts for example, where you can have a column "crazyGamesId" in your user table that will be populated with the user id from the token.

You can retrieve the user token with the following method:

HTML5UnityGameMakerConstructGodotCocos

```
try {
    const token = await window.CrazyGames.SDK.user.getUserToken();
    console.log("Get token result", token);
} catch (e) {
    console.log("Error:", e);
}
```

```
CrazySDK.User.GetUserToken((error, token) =>
{
    if (error != null)
    {
        Debug.LogError("Get user token error: " + error);
        return;
    }

    Debug.Log("User token: " + token);
});
// or
var token = await CrazySDK.User.GetUserTokenAsync();
```

```
crazy_user_get_user_token(
    function(token) { show_debug_message("Token: " + token); },
    function(err) { show_debug_message("Error getting token: " + json_stringify(err)); }
);
```

🟥 Not supported

Godot 3.xGodot 4.x

```
var token = yield(CrazyGames.User.get_user_token_async(), "completed")
```

```
var token = await CrazyGames.User.get_user_token_async()
```

```
try {
    const token = await CrazySDK.user.getUserToken();
} catch (e) {
}
```

The token has a lifetime of 1 hour. The method will handle the token refresh. We recommend that you don't store the token, and always call this method when the token is required.

The following error codes can be returned:

- `userNotAuthenticated` - the user is not logged in CrazyGames

- `unexpectedError`

The returned token can be decoded for testing purposes on jwt.io.

The token payload will contain the following data:

```
{
    "userId": "UOuZBKgjwpY9k4TSBB2NPugbsHD3",
    "gameId": "20267",
    "username": "RustyCake.ZU9H", // 6-20 chars (alfanumeric, period, underscores)
    "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/16.png",
    "iat": 1670328680,
    "exp": 1670332280
}
```

Do not decrypt tokens on the client

Make sure not to decrypt the user token on client-side as this is insecure. The typical info you need on the front-end (username, avatar) can easily be obtained by using the `getUser` method.

When you need to authenticate the requests with your server, you should send the token together with the requests.

The token can be verified with the public key hosted at this URL. We recommend that you fetch the key every time you verify the token, since it may change. Alternatively, you can implement a caching mechanism, and re-fetch it when the token fails to decode due to a possible key change.

Below is a TypeScript example that will help you decode and verify the token:

```
import * as jwt from "jsonwebtoken";
import axios from "axios";

export interface CrazyTokenPayload {
    userId: string;
    gameId: string;
    username: string; // 6-20 chars (alfanumeric, period, underscores)
    profilePictureUrl: string;
}

export const DecodeCGToken = async (
    token: string,
): Promise => {
    let key = "";

    try {
        const resp = await axios.get(
            "https://sdk.crazygames.com/publicKey.json",
        );
        key = resp.data["publicKey"];
    } catch (e) {
        console.error("Failed to fetch CrazyGames public key", e);
    }

    if (!key) {
        throw new Error("Key is empty when decoding CrazyGames token");
    }

    const payload = jwt.verify(token, key, { algorithms: ["RS256"] });
    return payload as CrazyTokenPayload;
};
```

## Auth prompt

Basic Implementation
Full Implementation

By calling this method, the log in or register popup will be displayed on CrazyGames. The user can log in their existing account, or create a new account. The method returns the user object.

HTML5UnityGameMakerConstructGodotCocos

```
try {
    const user = await window.CrazyGames.SDK.user.showAuthPrompt();
    console.log("Auth prompt result", user);
} catch (e) {
    console.log("Error:", e);
}
```

```
CrazySDK.User.ShowAuthPrompt((error, user) =>
{
    if (error != null)
    {
        Debug.LogError("Show auth prompt error: " + error);
        return;
    }

    Debug.Log("Auth prompt user: " + user);
});
// or
var user = await CrazySDK.User.ShowAuthPromptAsync();
```

```
crazy_user_show_auth_prompt(
    function(user) { show_debug_message("Logged in as: " + json_stringify(user)); },
    function(err) { show_debug_message("Auth failed: " + json_stringify(err)); }
);
```

🟥 Not supported

Godot 3.xGodot 4.x

```
var user = yield(CrazyGames.User.show_auth_prompt_async(), "completed")
```

```
var user = await CrazyGames.User.show_auth_prompt_async()
```

```
try {
    const user = await CrazySDK.user.showAuthPrompt();
} catch (e) {
}
```

The following errors can be returned:

- `showAuthPromptInProgress` - an auth prompt is already opened on the website

- `userAlreadySignedIn` - the user is already logged in

- `userCancelled` - the user closed the auth prompt without logging in or registering

## Auth listener

Guideline

You can register user auth listeners that are triggered when the player logs in CrazyGames. A log out doesn't trigger the auth listeners, since the entire page is refreshed when the player logs out.

HTML5UnityGameMakerConstructGodotCocos

```
const listener = (user) => console.log("User changed", user);

// to add a listener
window.CrazyGames.SDK.user.addAuthListener(listener);

// to remove a listener
window.CrazyGames.SDK.user.removeAuthListener(listener);
```

```
Action lst = (user) => { Debug.Log("Auth listener, user: " + user); };

// to add a listener
CrazySDK.User.AddAuthListener(lst);

// to remove a listener
CrazySDK.User.RemoveAuthListener(lst);
```

```
crazy_user_add_auth_listener(function(user) {
    show_debug_message("Auth status changed: " + json_stringify(user));
});
```

This function removes the current authentication listener, if one exists.

```
crazy_user_remove_auth_listener()
```

🟥 Not supported

Godot 3.xGodot 4.x

```
CrazyGamesBridge.callbacks.connect("auth_listener_complete", self, "_on_auth")

func _on_auth(user: Dictionary):
    print(user.get("username", ""))
```

```
CrazyGamesBridge.callbacks.auth_listener_complete.connect(_on_auth)

func _on_auth(user: Dictionary) -> void:
    print(user.get("username", ""))
```

```
const listener = (user) => console.log("User changed", user);

// to add a listener
CrazySDK.user.addAuthListener(listener);

// to remove a listener
CrazySDK.user.removeAuthListener(listener);
```

After detecting a login using the Auth Listener, if you use the CrazyGames account as an identifier you should fetch the user's progress from your back-end.

If you rely on the data module or automatic progress save, our system automatically reloads the game in case of a login.

## Account link prompt

Guideline

If you'd like to support advanced account use cases, you'll need to handle account linking between the CrazyGames account and the other providers. Check User linking page to find out more about user account linking.

For requesting the user's permission to link their CrazyGames account to the in-game account, please use the provided account link modal and avoid implementing it yourself. This provides the players with a standard modal.

You can display the modal by calling the following method:

HTML5UnityGameMakerConstructGodotCocos

```
try {
    const response = await window.CrazyGames.SDK.user.showAccountLinkPrompt();
    console.log("Link account response", response);
} catch (e) {
    console.log("Error:", e);
}
```

The response object will be either `{ "response": "yes" }` or `{ "response": "no" }`

```
CrazySDK.User.ShowAccountLinkPrompt((error, answer) =>
{
    if (error != null)
    {
        Debug.LogError("Show account link prompt error: " + error);
        return;
    }

    Debug.Log("Account link answer: " + answer);
});
// or
var answer = await CrazySDK.User.ShowAccountLinkPromptAsync();
```

The answer will be `true` if the player agrees to link the accounts, and `false` otherwise.

```
crazy_user_show_account_link_prompt(
    function(resp) { show_debug_message("Account linked: " + json_stringify(resp)); },
    function(err) { show_debug_message("Link failed: " + json_stringify(err)); }
);
```

The response object will be either `{ "response": "yes" }` or `{ "response": "no" }`

🟥 Not supported

Godot 3.xGodot 4.x

```
var response = yield(CrazyGames.User.show_account_link_prompt_async(), "completed")
```

```
var response = await CrazyGames.User.show_account_link_prompt_async()
```

```
try {
    const response = await CrazySDK.user.showAccountLinkPrompt();
} catch (e) {
}
```

The response object will be either `{ "response": "yes" }` or `{ "response": "no" }`

The following error codes can be returned:

- `showAccountLinkPromptInProgress` - the link account modal is already displayed

- `userNotAuthenticated` - the user is not logged in CrazyGames

## Local Testing

Basic Implementation
Full Implementation

HTML5UnityGameMakerConstructGodotCocos

When the SDK is in the `local` environment (on `127.0.0.1` or `localhost`) it will return some hardcoded default values for the method calls in the user module.

You can customize the returned local values by appending these query parameters:

- `?user_account_available=false` will change the response from the `isUserAccountAvailable` property to `false` (it returns `true` by default).

- `?show_auth_prompt_response=` will change the response from the `showAuthPrompt` method. It accepts the following values: `user1`, `user2`, `user_cancelled`

- `?link_account_response=` will change the response from the `showAccountLinkPrompt` method. It accepts the following values: `yes`, `no`, `logged_out`

- `?user_response=` will change the response from the `getUser` method. It accepts the following values: `user1`, `user2`, `logged_out`

- `?token_response=` will change the response from the `getUserToken` method. It accepts the following values: `user1`, `user2`, `expired_token` (to return an expired token), `logged_out`

By default, `getUser` returns `user1`, `getUserToken` returns token for `user1`, `showAccountLinkPrompt` returns `yes`, `showAuthPrompt` returns `user1`, and `isUserAccountAvailable` returns `true`.

When you are running the game in the editor, the method calls will return some hard-coded values.

You can customize the returned values in the `CrazySDK/Resources/CrazyGamesSettings` object:

In the above image, you can also see the default values returned by the methods.

🟧 See HTML5 section

🟥 Not supported

Godot 3.xGodot 4.x

Run the exported Web build on a local HTTP server (`localhost` or `127.0.0.1`) so the SDK runs in local mode.

Run the exported Web build on a local HTTP server (`localhost` or `127.0.0.1`) so the SDK runs in local mode.

🟧 See HTML5 section
