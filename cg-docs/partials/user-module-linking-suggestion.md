<!-- https://docs.crazygames.com/partials/user-module-linking-suggestion/ -->

# User module linking suggestion

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
