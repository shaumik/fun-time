<!-- https://docs.crazygames.com/sdk/in-game-purchases/ -->

# In-game purchases

Full Implementation

We have partnered with Xsolla to offer you the possibility to integrate in-game purchases more conveniently.

Warning

In-game purchases are an invite only feature. If you are interested in using them, please get in touch with us.

In-game purchases should be available only for the users that are signed in. Guest users should not be able to purchase items.

You'll need to integrate the User module if your game has a back-end or the Data module to save user progress securely.

If your game uses Xsolla or another external payment flow, disable it in the CrazyGames App when `applicationType` is `google_play_store` or `apple_store`.

## Getting started

When using the Xsolla SDK, and once you are invited to the CrazyGames Xsolla project dashboard, you will need one of the following ways of authentication:

- Standard linked to CrazyGames user accounts:
Create your game on the developer portal and contact us so we can generate credentials for the token.

- The token received from the `GetXsollaUserToken()` method from the SDK. This method generates a custom Xsolla token that you use with the Xsolla SDK. The purchases are linked to the CrazyGames user account automatically (see Account integration requirements).

- Custom linked to your in-game accounts:
You can generate the necessary Xsolla credentials yourself within our Xsolla project dashboard, and use the Xsolla SDK with the generated credentials.

- We require orders to reference the CrazyGames `userId` (see User module to get this). You can either use the CrazyGames userId as user identifier when registering an order, or pass `crazyGamesUserId` with the value of the CrazyGames user ID in the `custom_parameters`.

## Get Xsolla token

Set up required

This method requires some set up from our side, otherwise it will not work. If you are interested in using it, please get in touch with us.

HTML5UnityGameMakerConstructGodotCocos

To use Xsolla via our own custom-generated token, you can retrieve the Xsolla token like this:

```
try {
    const token = await window.CrazyGames.SDK.user.getXsollaUserToken();
    console.log("Get Xsolla token result", token);
} catch (e) {
    console.log("Error:", e);
}
```

To use Xsolla via our own custom-generated token, the only Xsolla SDK setup required is adding the Project ID, which will be provided by us.

Install the Xsolla Unity SDK can here.

You don't need any additional Xsolla setup, or to handle Xsolla login, since Xsolla will automatically handle the user account creation with the user ID included in token, which is the ID of the CrazyGames user. Thus, all the purchases made using the token will be also linked to the CrazyGames user account.

You can retrieve the Xsolla token like this:

```
CrazySDK.User.GetXsollaUserToken((error, token) =>
{
    if (error != null)
    {
        Debug.LogError("Get Xsolla user token error: " + error);
        return;
    }
    Debug.Log("Xsolla user token: " + token);
});
// or
var token = await CrazySDK.User.GetXsollaUserTokenAsync();
```

To use Xsolla via our own custom-generated token, you can retrieve the Xsolla token like this:

```
crazy_user_get_xsolla_user_token(
    function(token) {
        show_debug_message("Xsolla Token: " + token);
    },
    function(err) {
        show_debug_message("Failed to get Xsolla token: " + json_stringify(err));
    }
);
```

🟧 Identical to HTML5

Godot 3.xGodot 4.x

To use Xsolla via our own custom-generated token, you can retrieve the Xsolla token like this:

```
var xsolla_token = yield(CrazyGames.User.get_xsolla_user_token_async(), "completed")
```

To use Xsolla via our own custom-generated token, you can retrieve the Xsolla token like this:

```
var xsolla_token = await CrazyGames.User.get_xsolla_user_token_async()
```

To use Xsolla via our own custom-generated token, you can retrieve the Xsolla token like this:

```
try {
    const token = await CrazySDK.user.getXsollaUserToken();
    console.log("Get Xsolla token result", token);
} catch (e) {
    console.log("Error:", e);
}
```

We recommend that you retrieve the token every time before using it, since the tokens are usually short-lived, for example only 1 hour. Our SDK handles the token refresh.

After retrieving the token, you can use it like this:

HTML5UnityGameMakerConstructGodotCocos

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

```
XsollaToken.Create(token);
```

You can now call the methods from the Xsolla SDK, for example `XsollaCatalog.Purchase(...)`.

crazy_xsolla_open_paystation and crazy_xsolla_close_paystation methods can be used to interact with Xsolla.

Info

You need to code all interaction with Xsolla yourself using calls to http_request that communicate with their REST API.

Example:

```
// 1) Get user token (e.g., crazy_user_get_xsolla_user_token) then:
// 2) Use http_request() calls to:
//   * List owned items: GET https://store.xsolla.com/api/v2/project/{project_id}/user/inventory/items
//       - Requires Bearer user token (in the header DS map set _header[? "Authentication"] = "Bearer ").
//       - Shows items the current user owns.
//       - Supports filtering (by SKU, group, type) and pagination (see Xsolla docs).
//   * List available items: GET https://store.xsolla.com/api/v2/project/{project_id}/items/virtual_items
//       - Returns a paged list of all virtual items in your store.
//       - Pass Bearer user token if you want personalized results (promotions, restricted items).
//       - Supports optional query params (see Xsolla docs).
//   * Request a payment token: POST https://store.xsolla.com/api/v2/project/{project_id}/payment/item/{item_sku}
//       - Requires Bearer user token.
//       - Use body to pass extra params: { "quantity": 5, "sandbox": true }.
//       - The HTTP Async Event will return the payment token.
// 3) After you have a payment token open the paystation using the helper method:
var cb = function(evt) {
    switch (evt.type) {
        case CRAZY_XSOLLA_EVENT_INIT:   show_debug_message("IAP init"); break;
        case CRAZY_XSOLLA_EVENT_OPEN:   show_debug_message("IAP open"); break;
        case CRAZY_XSOLLA_EVENT_LOAD:   show_debug_message("IAP load"); break;
        case CRAZY_XSOLLA_EVENT_STATUS: show_debug_message("IAP status: " + json_stringify(evt.payload)); break;
        case CRAZY_XSOLLA_EVENT_STATUS_INVOICE: show_debug_message("IAP invoice: " + json_stringify(evt.payload)); break;
        case CRAZY_XSOLLA_EVENT_STATUS_DELIVERING: show_debug_message("IAP delivering: " + json_stringify(evt.payload)); break;
        case CRAZY_XSOLLA_EVENT_STATUS_DONE:
            show_debug_message("IAP done: " + json_stringify(evt.payload));
            // Optionally track the order with CrazyGames analytics:
            // var orderData = { order_id: evt.payload?.order_id, status: "done" };
            // crazy_analytics_track_order(json_stringify(orderData));
            break;
        case CRAZY_XSOLLA_EVENT_CLOSE:  show_debug_message("IAP close"); break;
        case CRAZY_XSOLLA_EVENT_ERROR:  show_debug_message("IAP error: " + json_stringify(evt.payload)); break;
    }
};

var options = { sandbox: true };
crazy_xsolla_open_paystation(global.xsolla_token, cb, json_stringify(options));
```

🟧 Identical to HTML5

You can use the token in your custom Godot/Xsolla integration flow (client-side JavaScript calls or backend requests), equivalent to the HTML5 flow.

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

You don't need to handle any Xsolla login functionality, since Xsolla will automatically handle the user account creation with the user ID included in the token, which is the ID of the CrazyGames user. Thus, all the purchases made using the token will be also linked to the CrazyGames user account.

## Registering orders

For the typical use case, you will use the Shop Builder API Xsolla offers. Have a look at these links, and check our Requirements below.

- Get started selling virtual goods

- Shop-builder API documentation

Warning

If you are integrating Xsolla without using `GetXsollaUserToken()`, make sure to pass the CrazyGames `userId` in your orders, either as main user identifier or in the `custom_parameters`. Read more in Getting started.

## Testing

The `GetXsollaUserToken()` method will work only on CrazyGames.com. You can preview your game through the Developer Portal.

For the initial testing, we recommend testing with sandbox orders, which allow purchasing items with fake money. When you submit the game, please ensure the sandbox orders are disabled.

## Order tracking

Order tracking through our SDK is optional.

When using Xsolla, you will mostly deal with 3 order statuses:

- `new`

- `done`

- `canceled`

Every time an order has been successfully completed (`done`), call our analytics module:

HTML5UnityGameMakerConstructGodotCocos

```
// order must be a JSON object
window.CrazyGames.SDK.analytics.trackOrder("xsolla", order);
```

```
XsollaCatalog.Purchase(skuField.text, orderStatus =>
    {
        CrazySDK.Analytics.TrackOrder(PaymentProvider.Xsolla, orderStatus);
    },
    error => { Debug.LogError($"Failed to buy, Error: {error.errorMessage}"); }
);
```

```
// comes from the xsolla purchase
var orderData = {};
crazy_analytics_track_order(json_stringify(orderData));
show_debug_message("Purchase order tracked in CrazyGames analytics.");
```

🟧 Identical to HTML5

Godot 3.xGodot 4.x

```
var order = {
    "orderId": "example-order-id",
    "status": "done"
}
CrazyGamesBridge.analytics_track_order("xsolla", order)
```

```
var order := {
    "orderId": "example-order-id",
    "status": "done"
}
CrazyGamesBridge.analytics_track_order("xsolla", order)
```

🟥 Not supported

You can obtain the order for example from the Xsolla Order endpoint

We also encourage you to track the new and canceled orders, as these may be useful in the future.

## Requirements & Guidelines

### Requirements

- Make sure to use the CrazyGames account ID to register purchases

- Ensure that there is a working 'close' button to be able to close the PayStation widget and players can resume their session properly

- If your PayStation opens in a new tab (desktop and/or mobile), ensure to notify players (via text only) on the in-game shop page that they should allow browser popups

- Ensure that any 'Back to the game' hyperlink after successful payment is hidden to avoid creating confusion for the players. You can do this by setting the 'Manual redirect condition' to None in the Settings under the PayStation menu in your Xsolla project dashboard

- Make sure your game correctly handles payment statuses to avoid charging players without crediting them. For example, when they close the window during payment processing. You should rely on one of these options:
Use Webhooks to be notified on your API about the order status. Xsolla will call the webhook when various events occur, for example order_paid. If you don't have an API, you can use Webhooks API.

- The Inventory contains all the items purchased by the user. It’s the safest way to retrieve player purchases.

- You can also set up Client-side order tracking. This is useful for continuously monitoring the order and instantly adding the item to the player when the purchase completes but needs to be validated through Webhooks or Inventory. Please avoid navigating away from the shop screen while the purchase wasn't attributed yet.

- If your game supports purchases on the web version and is mobile friendly, hide or disable those UI elements when the game is opened in the CrazyGames App , so that players are not sent into an unsupported flow.

### Common mistakes

When integrating in-game purchases, take into account these common mistakes we've noticed:

- The integration is complex. You can check the embeddable widget Xsolla provides for simpler integration.

- On mobile, the Back button is sometimes hidden. You can check this resource.

- Players can accidentally close the Xsolla window by clicking outside the overlay or pressing Esc. You can disable `closeByClick` and `closeByKeyboard`
Additional HTML5 resource

- For Unity: in Unity, under the path `Assets/Xsolla/Core/Plugins/`, there is a file called `paystation.jslib`. In this file, the following lines need to be added as options: `closeByClick: false` and `closeByKeyboard: false`

### Lootbox and similar mechanics

Please note that we do not adhere to any specialized definitions for loot boxes or similar mechanics.
Loot box - a mechanic where a player receives a random item/set of random items, usually in a sealed 'box' or 'container' that can be opened either for free or for in-game/real currency. From a restriction standpoint, our main concerns are cases of purchasing items with hidden random content when they:

- are bought for money

- are bought for virtual currency that can be purchased for money

Other cases that may lead to restrictions are considered on a case-by-case basis, but the ones mentioned above are the most common.

Among the 'other loot boxes' (loot box mechanics) are included "wheel of fortune", card pack, etc., i.e. mechanics that have similar elements - hidden content, randomness of item drops, and monetization (for example, purchasing attempts to spin the wheel).

If the game includes loot boxes/ loot box mechanics, the following territories are subject to sales restrictions:

- Belgium, China, Netherlands, Serbia, Slovakia

- Additionally Taiwan, South Korea, if for items obtained from loot boxes/ in similar mechanics, the probabilities of their acquisition in percentages are NOT disclosed; it is important to note that this refers specifically to individual items with the same value (`weight`), not to the category of items where the `weight` of items may differ

- Additionally Japan, if
the user receives an item from the loot box with a value lower than the price paid for the loot box (i.e. the item must have a value equal to or greater than the price of the loot box)

- the project's Terms of Service (ToS) do not include prohibition on real money trading (RMT) and trading between players on secondary markets
