<!-- https://docs.crazygames.com/sdk/html5-v2/in-game-purchases/ -->

# In-game purchases

## Get Xsolla token

If you would like to use Xsolla via our own custom-generated token, you can retrieve the Xsolla token like this:

Callback examplePromise example

```
const callback = (error, token) => {
    if (error) {
        console.log("Error:", error);
    } else {
        console.log("Get Xsolla token result (callback)", token);
    }
};
window.CrazyGames.SDK.user.getXsollaUserToken(callback);
```

```
try {
    const token = await window.CrazyGames.SDK.user.getXsollaUserToken();
    console.log("Get Xsolla token result", token);
} catch (e) {
    console.log("Error:", e);
}
```

We recommend that you retrieve the token every time before using it, since the tokens are usually short-lived, for example only 1 hour. Our SDK handles the token refresh.

### Example

After retrieving the token, you can use it like this:

```
// obtain player's inventory example
// xsollaProjectId will be provided by us
const resp = await fetch(
    `https://store.xsolla.com/api/v2/project/${xsollaProjectId}/user/inventory/items`,
    {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }
);
```

Check Xsolla API for more functionality.

You don't need to handle any Xsolla login functionality, since Xsolla will automatically handle the user account creation with the user ID included in the token, which is the ID of the CrazyGames user. Thus, all the purchases made using the token will be also linked to the CrazyGames user account.

### Testing

The `getXsollaUserToken()` method will work only on CrazyGames.com. You can test the Xsolla token generation using the QA preview in our Developer Portal.

For the initial testing, we recommend testing with sandbox orders, which allow purchasing items with fake money. When you submit the game, please ensure the sandbox orders are disabled.
