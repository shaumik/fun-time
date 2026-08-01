<!-- https://docs.crazygames.com/sdk/data/ -->

# Data

The data module allows to save and retrieve user data for logged in CrazyGames users. The data will also be synced on all the devices where the user plays the game.

If the user is not logged in, the data module will store the game data in LocalStorage. If the user logs in later, the LocalStorage game data will be synced and backed up on the user's account.

Warning

If you intend to use the data module, don't forget to select the appropriate Progress Save toggle in the submission flow. The data module will be disabled otherwise.

You need to fully rely on the Data Module save (for both guest and logged-in users on CrazyGames) and avoid relying on local saves to ensure the Data Module save works correctly.

## Using the data module

After reading our SDK Introduction page for your engine, follow these steps in order to use the `data` module.

HTML5UnityGameMakerConstructGodotCocos

Initialization

Before using any methods from the data module, please be sure the SDK is initialized.

```
await window.CrazyGames.SDK.init();
```

We recommend that you do this during the loading screen of your game since the SDK preloads all the game data when it is initialized. This may take some time, depending on how much user data is stored.

Usage

The data module has the same API as the localStorage:

```
clear(): void;
getItem(key: string): string | null;
removeItem(key: string): void;
setItem(key: string, value: string): void;
```

You can call methods from the data module like this:

```
window.CrazyGames.SDK.data.setItem("gold", 100);
```

The data module has the same API as the PlayerPrefs:

```
void SetInt(string key, int value);
int GetInt(string key);
int GetInt(string key, int defaultValue);
void SetFloat(string key, float value);
float GetFloat(string key);
float GetFloat(string key, float defaultValue);
void SetString(string key, string value);
string GetString(string key);
string GetString(string key, string defaultValue);
bool HasKey(string key);
void DeleteKey(string key);
void DeleteAll();
```

You can call methods from the data module like this:

```
CrazySDK.Data.SetInt("gold", 100);
```

In case you still need to rely on PlayerPrefs for saving data on environments where the SDK is not available, for example mobile devices, we created this helper script.

Initialization

Before using any methods from the data module, please be sure the SDK is initialized as explained on the introduction page.
We recommend that you do this during the loading screen of your game since the SDK preloads all the game data when it is initialized. This may take some time, depending on how much user data is stored.

Usage

You can use these methods to set and later retrieve the `value` for any `key` you want to use.

```
crazy_data_get_item(key)
crazy_data_set_item(key,value)
crazy_data_remove_item(key)
```

You can clear all data with this function, but be aware this action is irreversible.

```
crazy_data_clear()
```

Initialization

Before using any methods from the data module, please be sure the SDK is initialized.

```
await window.ConstructCrazySDK.init();
```

Our demo project contains a loading layout that loads the SDK, initializes it and then loads the game.

Using the data module

The data module has the same API as the localStorage:

```
clear(): void;
getItem(key: string): string | null;
removeItem(key: string): void;
setItem(key: string, value: string): void;
```

The `getItem()` method retrieves stored data for a specific key. Use it to fetch previously saved user data:

```
const value = window.ConstructCrazySDK.data.getItem("keyName");
```

The `setItem()` method stores data for a specific key. The data will be synced across the user's devices. In this code, first we check if the data we want to set already exists in our storage or not:

```
var key = document.getElementById("keyVal").value;
var res = window.ConstructCrazySDK.data.getItem(key);
var val = document.getElementById("mainVal").value;
if (res != null) {
var final = parseInt(res) + parseInt(val);
window.ConstructCrazySDK.data.setItem(key, final);
} else {
window.ConstructCrazySDK.data.setItem(key, val);
}
```

Godot 3.xGodot 4.x

You can call methods from the data module like this:

```
CrazyGames.Data.data_set_item("gold", "100")
var gold = 0
if CrazyGames.Data.data_has_key("gold"):
    gold = int(CrazyGames.Data.data_get_item("gold"))
```

You can call methods from the data module like this:

```
CrazyGames.Data.data_set_item("gold", "100")
var gold := 0
if CrazyGames.Data.data_has_key("gold"):
    gold = int(CrazyGames.Data.data_get_item("gold"))
```

```
// you can access the data module like this:
CrazySDK.data;
```

The data module has the same API as the localStorage:

```
clear(): void;
getItem(key: string): string | null;
removeItem(key: string): void;
setItem(key: string, value: string): void;

// example usage:
CrazySDK.data.getItem("level");
```

Avoid losing user progress

In general, it's a good practice to always retrieve your data before setting data to ensure that the player's previous progress isn't lost.

## Errors

The data module can throw errors, for example:

```
{
    "code": "dataLimitExcedeed",
    "message": "Game data when converted to a JSON string cannot exceed 1048576 bytes. Data was not saved"
}
```

Possible error codes:

- `dataLimitExcedeed` - you can store maximum 1MB of user data

- `dataModuleDisabled` - please be sure you selected the "Yes, using the Data Module from the CrazyGames SDK" option when submitting your game

- `other`

## Guest user behaviour

For guest users, the data module stores the game data in `localStorage`. When a guest user signs in, you don't need to do anything. Our SDK will automatically load the account game data if there is any, or if this user hasn't played your game before, the SDK will transfer the guest data to the user account.

When the user signs out, the SDK will revert back to using the guest game data.

## Data saving limits

The SDK debounces data saving with 1 second, meaning that multiple calls to the methods will be saved after 1 second. There may be exceptions in various cases, when data saving may be debounced with more time, up to 30 seconds.

There is a 1MB data limit. If you are approaching it, you will see warnings in the browser console. The data won't be backed up anymore if it exceeds 1MB.

## Help with the data module

If you're unsure on how to use the data module to save & load progress data, refer to the localStorage API which works identically to the Data module.

## Integrating data module into already published games

HTML5UnityGameMakerConstructGodotCocos

Since the `data` module offers the same API as `window.localStorage`, it is quite easy to integrate it into your already published games. To avoid players losing their data, you should copy all the existing `localStorage` keys into the `data` module if the user played your game before.

Since the `Data` module offers the same API as `PlayerPrefs`, it is quite easy to integrate it into your already published games. To avoid players losing their data, you should copy all the existing PlayerPrefs keys into the `Data` module if the user played your game before.

To avoid that returning players lose their data when playing your game again after it's been updated, copy any existing user data into the data module.

Since the `data` module offers the same API as `window.localStorage`, it is quite easy to integrate it into your already published games. To avoid players losing their data, you should copy all the existing `localStorage` keys into the `data` module if the user played your game before.

Godot 3.xGodot 4.x

Since the `Data` module provides a key/value storage API, migration is supported. If your existing game used browser-local saves, run a one-time migration into `CrazyGames.Data` keys so returning players keep their progress.

Since the `Data` module provides a key/value storage API, migration is supported. If your existing game used browser-local saves, run a one-time migration into `CrazyGames.Data` keys so returning players keep their progress.

Since the `data` module offers the same API as `window.localStorage`, it is quite easy to integrate it into your already published games. To avoid players losing their data, you should copy all the existing `localStorage` keys into the `data` module if the user played your game before.
