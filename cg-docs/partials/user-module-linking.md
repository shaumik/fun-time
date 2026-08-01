<!-- https://docs.crazygames.com/partials/user-module-linking/ -->

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
