<!-- https://docs.crazygames.com/sdk/html5-v2/partials/user-sdk-docs/ -->

# User sdk docs

The user module can be accessed like this:

```
window.CrazyGames.SDK.user;
```

## Check availability

Full Implementation

The user account functionality is not available on other domains that embed your CrazyGames game. Before using any user account features, you should always ensure that the user account system is available.

Callback examplePromise example

```
const callback = (error, isAvailable) => {
    if (error) {
        // shouldn't happen normally
        console.log("Error:", error);
    } else {
        console.log("User account available", isAvailable);
    }
};
window.CrazyGames.SDK.user.isUserAccountAvailable(callback);
```

```
const isAvailable = await window.CrazyGames.SDK.user.isUserAccountAvailable();
console.log("User account available", isAvailable);
```

## Get current user

Full Implementation

You can retrieve the user currently logged in CrazyGames with the following method:

Callback examplePromise example

```
const callback = (error, user) => {
    if (error) {
        // shouldn't happen normally
        console.log("Error:", error);
    } else {
        console.log("Get user result (callback)", user);
    }
};
window.CrazyGames.SDK.user.getUser(callback);
```

```
const user = await window.CrazyGames.SDK.user.getUser();
console.log("Get user result", user);
```

If the user is not logged in CrazyGames, the returned user will be `null`

The returned user object will look like this:

```
{
    "username": "SingingCheese.TLNU",
    "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/4.png"
}
```

## System info

Full Implementation

You can retrieve the system info with the following method:

Callback examplePromise example

```
const callback = (error, systemInfo) => {
    if (error) {
        // shouldn't happen normally
        console.log("Error:", error);
    } else {
        console.log("Get system info result (callback)", systemInfo);
    }
};
window.CrazyGames.SDK.user.getSystemInfo(callback);
```

```
const systemInfo = await window.CrazyGames.SDK.user.getSystemInfo();
console.log("Get system info result", systemInfo);
```

The response will look like this:

```
{
    "countryCode": "US",
    "device": {
        "type": "desktop" // possible values: "desktop", "tablet", "mobile"
    },
    "os": {
        "name": "Windows",
        "version": "10"
    },
    "browser": {
        "name": "Chrome",
        "version": "107.0.0.0"
    }
}
```

For `browser` and `os`, the format is the same as ua-parser-js.

## Auth prompt

Full Implementation

By calling this method, the log in or register popup will be displayed on CrazyGames. The user can log in their existing account, or create a new account. The method returns the user object.

Callback examplePromise example

```
const callback = (error, user) => {
    if (error) {
        console.log("Error:", error);
    } else {
        console.log("Auth prompt result (callback)", user);
    }
};
window.CrazyGames.SDK.user.showAuthPrompt(callback);
```

```
try {
    const user = await window.CrazyGames.SDK.user.showAuthPrompt();
    console.log("Auth prompt result", user);
} catch (e) {
    console.log("Error:", e);
}
```

The following error codes can be returned:

- `showAuthPromptInProgress` - an auth prompt is already opened on the website

- `userAlreadySignedIn` - the user is already logged in

- `userCancelled` - the user closed the auth prompt without logging in or registering

## Get user token

Full Implementation

The user token contains the `userId` of the player that is currently logged in CrazyGames, as well as other useful information (`username`, `profilePictureUrl`, etc). You should send it to your server when required, and verify/decode it there to extract the `userId`. This is useful for linking the user accounts for example, where you can have a column "crazyGamesId" in your user table that will be populated with the user id from the token.

You can retrieve the user token with the following method:

Callback examplePromise example

```
const callback = (error, token) => {
    if (error) {
        console.log("Error:", error);
    } else {
        console.log("Get token result (callback)", token);
    }
};
window.CrazyGames.SDK.user.getUserToken(callback);
```

```
try {
    const token = await window.CrazyGames.SDK.user.getUserToken();
    console.log("Get token result", token);
} catch (e) {
    console.log("Error:", e);
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
    "username": "RustyCake.ZU9H",
    "profilePictureUrl": "https://images.crazygames.com/userportal/avatars/16.png",
    "iat": 1670328680,
    "exp": 1670332280
}
```

When you need to authenticate the requests with your server, you should send the token together with the requests.

The token can be verified with the public key hosted at this URL https://sdk.crazygames.com/publicKey.json. We recommend that you fetch the key every time you verify the token, since it may change. Alternatively, you can implement a caching mechanism, and re-fetch it when the token fails to decode due to a possible key change.

Here is a TypeScript example that will help you decode and verify the token:

```
import * as jwt from "jsonwebtoken";
import axios from "axios";

export interface CrazyTokenPayload {
    userId: string;
    gameId: string;
    username: string;
    profilePictureUrl: string;
}

export const DecodeCGToken = async (
    token: string
): Promise => {
    let key = "";

    try {
        const resp = await axios.get(
            "https://sdk.crazygames.com/publicKey.json"
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

## Auth listener

Full Implementation

You can register user auth listeners that are triggered when the player logs in CrazyGames. A log out doesn't trigger the auth listeners, since the entire page is refreshed when the player logs out.

```
const listener = (user) => console.log("User changed", user);

// add listener
window.CrazyGames.SDK.user.addAuthListener(listener);

// remove listener
window.CrazyGames.SDK.user.removeAuthListener(listener);
```

After detecting a login using the Auth Listener, if you use the CrazyGames account
as an identifier you should fetch the user's progress from your back-end.

If you rely on the CrazyGames automatic progress save,
our system automatically reloads the game in case of a login.

## Account link prompt

Full Implementation

If you'd like to keep other sign in providers (Google or Facebook for example), you'll need to handle account linking between the CrazyGames account and the other providers. Check User linking page to find out more about user account linking.

For requesting the user's permission to link their CrazyGames account to the in-game account, please use the provided account link modal and avoid implementing it yourself. This provides the players with a standard modal, and also allows them to select the "Always link accounts" option (coming soon).

You can display the modal by calling the following method:

Callback examplePromise example

```
const callback = (error, response) => {
    if (error) {
        console.log("Error:", error);
    } else {
        console.log("Link account response (callback)", response);
    }
};
window.CrazyGames.SDK.user.showAccountLinkPrompt(callback);
```

```
try {
    const response = await window.CrazyGames.SDK.user.showAccountLinkPrompt();
    console.log("Link account response", response);
} catch (e) {
    console.log("Error:", e);
}
```

The response object will be either `{ "response": "yes" }` or `{ "response": "no" }`

The following error codes can be returned:

- `showAccountLinkPromptInProgress` - the link account modal is already displayed

- `userNotAuthenticated` - the user is not logged in CrazyGames

## Testing

Full Implementation

### Local

When the SDK is in the `local` environment (on `127.0.0.1` or `localhost`) it will return some hardcoded default values for the method calls in the user module.

You can customize the returned local values by appending these query parameters:

- `?user_account_available=false` will change the response from the `isUserAccountAvailable` method to `false` (it returns `true` by default).

- `?show_auth_prompt_response=` will change the response from the `showAuthPrompt` method. It accepts the following values: `user1`, `user2`, `user_cancelled`

- `?link_account_response=` will change the response from the `showAccountLinkPrompt` method. It accepts the following values: `yes`, `no`, `logged_out`

- `?user_response=` will change the response from the `getUser` method. It accepts the following values: `user1`, `user2`, `logged_out`

- `?token_response=` will change the response from the `getUserToken` method. It accepts the following values: `user1`, `user2`, `expired_token` (to return an expired token), `logged_out`

By default, `getUser` returns `user1`, `getUserToken` returns token for `user1`, `showAccountLinkPrompt` returns `yes`, `showAuthPrompt` returns `user1`, and `isUserAccountAvailable` returns `true`.
