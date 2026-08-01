<!-- https://docs.crazygames.com/requirements/account-integration/ -->

# Account integration requirements

The CrazyGames account system

The CrazyGames account system is a powerful tool that allows our users to save progress, play on multiple devices, customize their username and avatar and play with their friends. The most succesful games on our site integrate seamlessly with our account system.

Over 35 million players have a CrazyGames account, many of them playing actively every week.

We want to ensure this experience for our users:

- No standalone in-game username or avatar is needed

- No additional login flows in-game are needed

- Guests can also play the games

## Integration scenarios

We understand these requirements can have a substantial impact on your game. However it's not necessary to do customization before releasing your initial game version which we describe below. We distinguish these 4 scenarios:

Games without accountsUse CrazyGames profileIn-game account (basic)In-game account (full)

Basic Implementation

If your game doesn’t have the notion of users, you are not expected to integrate with our user module.

You can however use the Data module in our SDK to save user progress, or alternatively rely on our APS system.

Full Implementation

Improve the gamer's experience by showing their username and profile picture in your game.

- You can retrieve the user object from the User module to obtain user profile info

- In case the result is `null` the user is not logged in on CrazyGames and you should continue as guest.

- You can use the Data module in our SDK to save user progress, or alternatively rely on our APS system.

Basic Implementation

To publish a game that saves user profile info or progress on your own back-end without customization/integration, you should:

- Allow both guests and registered CrazyGames users to play your game as guests by default

- Disable any external login options (e.g. Facebook, Google, email)

Naturally, we will require you to integrate fully according to Full Implementation when the game has proven to be succesful.

You can consider using the Data module in our SDK to save user progress, or alternatively rely on our APS system.

Full Implementation

This scenario is meant for games that have in-game accounts with a custom back-end.
We want to ensure a smooth login experience for CrazyGames users, meaning:

- New logged in CrazyGames users are automatically registered & logged in within your game.

- Returning logged in CrazyGames users are automatically logged in within your game.

- CrazyGames guests can play your game as guests.

- Logging out in the game and allowing login with external login options (e.g. Facebook, Google, email) is not allowed.
If you want to offer importing existing accounts or exporting CrazyGames account, you are responsible for transferring progress correctly.

The section on In-game account integration below specifies the logic to implement in your game.

## Progress save

Full Implementation

Saving game progress

Players care A LOT about their progress in games, and expect their progress to synchronize across their devices. CrazyGames offers a number of methods to save progress in the cloud. Unless progress is not applicable for your game, we require you to implement one of these methods.

- Preferably you use the CrazyGames Data module which saves the user's progress on their CrazyGames account.
Progress for guest users is automatically saved locally

- When a guest logs in the progress is synced to their cloud (as long as no cloud progress was present).

- If your game has their own back-end to save data, you can use the User module to link back-end data to the user's CrazyGames account.
Take into account the flows described above in In-game account integration to handle specific scenarios like guests logging in.

- Make sure to consider that the same user might log in on multiple devices, and multiple accounts can share a single device.

- Alternatively you can use our Automatic Progress Save system, which automatically syncs local progress to the cloud. This is not allowed for games with in-game purchases as it relies on local data.

## In-game account integration

Full Implementation

This section explains how to integrate CrazyGames accounts with your in-game account system according to our requirements.

### Preparation

Your CrazyGames game version will need to allow using CrazyGames `userId` as identifiers within the game. This is a unique string tied to the CrazyGames account that can be accessed through the User module in our SDK.

### Logic to implement at game launch

Start by retrieving the current user by calling `getUserToken()` to get a JWT Token and verifying the token on your server. This will get you the player's `userId`.

Request the current user account every time the game starts, making sure to cover cases where different users share the same device or users change profile information (avatar/username/...).

#### Option 1: User is not logged in (`userNotAuthenticated` error)

You should always allow the user to start playing as Guest, as main scenario.

Creating in-game accounts for CrazyGames guests

We recommend NOT to create an in-game account in this scenario. If you do, you should be able to link it to a CrazyGames account when the guest logs in. Avoid relying solely on local data to identify Guests across sessions as multiple users might share the same device.

It is allowed to show a Login with CrazyGames button but not as a main CTA.

Don't trigger the Auth prompt automatically as this might confuse the user

#### Option 2: User is logged in on CrazyGames (`userId` is returned)

Check if the CrazyGames `userId` account already exists in your back-end.

- Case: CrazyGames account (`userId`) is already known in your back-end:
Users can update their CrazyGames username & avatar, so if you store this info on your back-end make sure to update it by calling an endpoint on your server with the actual username and profile picture.

- Fetch the data for this user from your back-end, and start playing!

- Case: The CrazyGames account (`userId`) is not yet known to your game:
Automatically create a game account using the player's CrazyGames account. Make sure to make the link based on the `userId` unique field, as other fields like `username` might change.

- (optional) If feasible and desired, you can save any local progress the user made as guest to the new account. Alternatively this user will have fresh data in your back-end.

### Logic to implement during the game

#### Players changing CrazyGames accounts while playing

- Guest users logging into their CrazyGames account while playing should be detected using an Auth Listener, in this case we will expect you to follow the "User is logged in on CrazyGames" flow above and if necessary refresh the game. This only applies to users playing as guest in the game.
When a user logs out during gameplay, the entire web page is refreshed, so there is nothing else to do in this case. The game flow will start from the beginning.

#### Login Button

You can show a login button to guests:

- Do not make this the main CTA blocking the user

- A good placement is in the top right corner

- If you do this, the button should trigger the Auth prompt method in our SDK.

- Don't allow Guests to use different login methods than 'Login with CrazyGames'

#### Logout & account linking

- Logging out in the game and allowing login with external login options (e.g. Facebook, Google, email) is not allowed.

- If you want to offer importing existing in-game accounts or exporting CrazyGames account, you are responsible for transferring/migrating progress correctly.
Our SDK contains an optional Account link prompt function

- This is strongly recommended if you create in-game accounts for CrazyGames guests

- If your game has In-Game Purchases, this is recommended if you create in-game accounts for CrazyGames guests
