<!-- https://docs.crazygames.com/sdk/user-linking/user-linking-unity/ -->

# User account linking

If you decide to keep alternative sign in providers (Google or Facebook for example) for users playing on CrazyGames, you will need to implement account linking between them and the CrazyGames user account.

Warning

This is an advanced integration scenario. Improper integration may delay the release of your game or can lead to it being rejected. We support the user flows described below. If you want to support additional functionality e.g. merging or migrating user accounts, we can not provide technical support.

These are the user flows we expect you to support in order to ensure a consistent experience for CrazyGames users.

### Preparation

Rather than using a CrazyGames account as an identifier, you will need to create and maintain a mapping in your back-end between CrazyGames accounts and in-game account identifiers. If you are using Firebase, please refer to this section.

### At game launch

Start by retrieving the current user. The game should request the current user account every time the game starts.

User is not logged in (getUser() returns `null`)
You should always allow the user to start playing as Guest.

Optionally, you can give the user the choice:

- 'Login with CrazyGames' button (triggering our Auth prompt method), or other login methods (Google, Facebook, etc.)

- Continue as Guest

Please note:

- Don't trigger the Auth prompt automatically as this might confuse the user

User is logged in on CrazyGames (getUser() returns a user)
Check if the CrazyGames account (via `getUserToken()`) is already linked to an in-game account in your back-end.

- Case: There is a game account linked to this CrazyGames account
Fetch the data for this user from your back-end, and start playing!

- A Logged-in CrazyGames account should always take the highest priority over in-game accounts.

- Case: There is not yet a game account linked to this CrazyGames account
Automatically create a game account that is linked to the player's CrazyGames account, based on the user token. This user will have fresh data in your back-end.

- Case: The user is logged in in-game but not yet linked with CrazyGames account
Display a button "Link CrazyGames account" that will prompt the user to link the account or create a new account. See account link prompt

- We advise to link with "fresh" accounts only and avoid merging, or as an alternative, making users choose which data to keep.

- The result of this flow should always be that the CrazyGames account is linked to a (new or existing) in-game account.

The above cases are also illustrated in the diagram below. Please be sure you consult both the diagram and the cases, to have a complete implementation.

```
graph TB
GAME[Game starts] --> CHECKUSER{Get CG\nUser};
CHECKUSER -->|Logged out| SHOWAUTHPROMPT{Show CG auth\nprompt};
CHECKUSER -->|Logged in| USERLOGGEDIN{User is logged\nin CrazyGames};
USERLOGGEDIN --> |User logged in game,\n game acc linked to CG| STARTPLAYING[Start playing]
USERLOGGEDIN --> |User logged in game,\n not linked to CG| PROMPTLINK[Ask user to\nlink account]
PROMPTLINK --> STARTPLAYING
USERLOGGEDIN --> |User not logged in game,\n but has game acc linked to CG| LOADGAMEACC[Log into game account]
LOADGAMEACC --> STARTPLAYING
USERLOGGEDIN --> |User not registered in game| CREATEGAMEACC[Create game acc\n or redirect to log in page]
CREATEGAMEACC --> STARTPLAYING
SHOWAUTHPROMPT --> |User canceled| PLAYASGUEST[Play as guest\nif game allows];
SHOWAUTHPROMPT --> |User logs in| USERLOGGEDIN;
```

### Game login page

If you allow the user to log out during the game, or start the game as guest

- You should add a CrazyGames Login button in your login screen, which triggers the same flow as described above in "At game launch".

- If a user logs in with a different login type (e.g. Google or username/password), you should trigger an Account link prompt after login.

The user module can be accessed like this:

```
CrazySDK.User;
```

Consult the Demo

For a demo, please consult the `CrazySDK/Demo/UserModule` scene. You can run it directly in the Unity editor.

## Check availability

Basic Implementation
Full Implementation

The user account functionality is available only when your game is running on CrazyGames domains. It will not work on our partner domains that embed it, or on your whitelisted domains. Before using any user account features, you should always ensure that the user account system is available.

```
var isAvailable = CrazySDK.User.IsUserAccountAvailable;
```

## Get current user

Basic Implementation
Full Implementation

You can retrieve the user currently logged in CrazyGames with the following method:

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
```

If the user is not logged in CrazyGames, the returned user will be `null`.

The returned user object contains the following fields:

```
public class PortalUser
{
    public string username;
    public string profilePictureUrl;
}
```

## System info

Basic Implementation
Full Implementation

You can retrieve the system info like this:

```
var systemInfo = CrazySDK.User.SystemInfo;
Debug.Log(systemInfo.countryCode);
// For browser and os, format is the same as https://github.com/faisalman/ua-parser-js
Debug.Log(systemInfo.browser.name);
Debug.Log(systemInfo.browser.version);
Debug.Log(systemInfo.os.name);
Debug.Log(systemInfo.os.version);
Debug.Log(systemInfo.device.type); // possible values: "desktop", "tablet", "mobile"
Debug.Log(systemInfo.applicationType); // possible values: "google_play_store", "apple_store", "pwa", "web"
```

## Auth prompt

Basic Implementation
Full Implementation

By calling this method, the log in or register popup will be displayed on CrazyGames. The user can log in their existing account, or create a new account. The method returns the user object.

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
```

The following error codes can be returned:

- `showAuthPromptInProgress` - an auth prompt is already opened on the website

- `userAlreadySignedIn` - the user is already logged in

- `userCancelled` - the user closed the auth prompt without logging in or registering

## Get user token

Basic Implementation
Full Implementation

The user token contains the `userId` of the player that is currently logged in CrazyGames, as well as other useful information (`username`, `profilePictureUrl`, etc). You should send it to your server when required, and verify/decode it there to extract the `userId`. This is useful for linking the user accounts for example, where you can have a column "crazyGamesId" in your user table that will be populated with the user id from the token.

You can retrieve the user token with the following method:

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

Do not decrypt tokens on the client

Make sure not to decrypt the user token on client-side as this is insecure. The typical info you need on the front-end (username, avatar) can easily be obtained by using the `getUser` method.

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

Guideline

You can register user auth listeners that are triggered when the player logs in CrazyGames. A log out doesn't trigger the auth listeners, since the entire page is refreshed when the player logs out.

```
Action lst = (user) => { Debug.Log("Auth listener, user: " + user); };
CrazySDK.User.AddAuthListener(lst); // add
CrazySDK.User.RemoveAuthListener(lst); // remove (for example on scene change)
```

After detecting a login using the Auth Listener, if you use the CrazyGames account
as an identifier you should fetch the user's progress from your back-end.

If you rely on the CrazyGames automatic progress save,
our system automatically reloads the game in case of a login.

## Saving user data

Basic Implementation
Full Implementation

By default, our APS system automatically backs up PlayerPrefs. The automatic backup isn't always the best solution, since we cannot reliably detect if any IndexedDB changes occur. That's why we also provide the `SyncUnityGameData` that you can manually call to ensure the player data is saved at the opportune moments.

```
CrazySDK.User.SyncUnityGameData();
```

For more details, please check the APS page.

## Account link prompt

Guideline

If you'd like to keep other sign in providers (Google or Facebook for example), you'll need to handle account linking between the CrazyGames account and the other providers. Check User linking page to find out more about user account linking.

For requesting the user's permission to link their CrazyGames account to the in-game account, please use the provided account link modal and avoid implementing it yourself. This provides the players with a standard modal, and also allows them to select the "Always link accounts" option (coming soon).

You can display the modal by calling the following method:

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
```

The answer will be `true` if the player agrees to link the accounts, and `false` otherwise.

The following error codes can be returned:

- `showAccountLinkPromptInProgress` - the link account modal is already displayed

- `userNotAuthenticated` - the user is not logged in CrazyGames

## Testing

Basic Implementation
Full Implementation

### Local

When you are running the game in the editor, the method calls will return some hard-coded values.

You can customize the returned values in the `CrazySDK/Resources/CrazyGamesSettings` object:

In the above image, you can also see the default values returned by the methods.

## Implementation suggestion

Full Implementation

### Custom database

This suggestion applies if you store the user data on your backend, either in an SQL or document database.

In your database, you will most likely have a table or a document storing this user data:

- userId

- username

- ...

You will want to store one more user column:

- crazyGamesId

Implementation logic

When the user starts playing your game, if they are signed in CrazyGames, obtain the user token from the SDK and send it to your server. There you extract the user ID from the token and create a new user entry in your database, where `crazyGamesId` will be populated with the ID from the token.

If the user already has an account in your game, you can consider populating the `crazyGamesId` field of the existing user to automatically link the accounts.

Every time you need to authenticate the user on your backend, for example at the beginning of the game, you should send the CrazyGames user token to your backend, so you retrieve the correct user from your database by the `crazyGamesId`.

Additional suggestions:

- Sign out the user from your game if you notice that the user signed out of CrazyGames (getUser returns null).

- When a new user arrives to your game, send the CrazyGames user token to your backend to check if they already have an account, and if so, sign them in automatically.

### Firebase

If you are using Firebase, account linking shouldn't be done client side. This is a security risk since anyone can inject any user id in the SDK. To implement account linking correctly with Firebase, you should use Cloud Functions with Firestore or Real Time Database.
Integration suggestion:

- send the token obtained from the CrazyGames SDK to a cloud function

- the cloud function should parse and verify the token, and then create a new document in the database linking the CrazyGames user id obtained from the token to your user id

- the cloud function creates a custom Firebase token and returns it back, and you use it to authenticate in Firebase

- for future requests, the cloud function will check if there is any document linking the CrazyGames user id to your user id, and return the custom firebase token
