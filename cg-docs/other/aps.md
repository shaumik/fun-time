<!-- https://docs.crazygames.com/other/aps/ -->

# Automatic progress save

The automatic progress save system (APS) is responsible for saving user data, and then syncing it across all the devices where the user is authenticated. For example, a player can start playing your game on the mobile phone, and then continue playing it on the PC (as long as the player is using the same CrazyGames account on both devices).

The APS system can backup data from the local storage (used mostly by HTML5 games), or from IndexedDB (Unity games).

Data Module from SDK

Automatically saving local progress carries certain risks. It is not allowed for games with in-game purchases. Please refer to Account integration page for better methods to save progress.

## Local storage

Most of the HTML5 games save game data in `window.localStorage`. The APS system automatically backs up and restores the `localStorage` on the devices where the user plays. As a developer, there is no implementation required from your side.

## IndexedDB

Most Unity games will store user data in `PlayerPrefs`. On the Web, Unity games save the `PlayerPrefs` in IndexedDB, which is a database provided by the browser. If you save game data in `PlayerPrefs`, there is nothing that you should do, it will be synced automatically.
