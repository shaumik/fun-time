<!-- https://docs.crazygames.com/other/game-challenge/ -->

# Game challenge

Congratulations on taking part in the new CrazyGames Game Challenge feature! These short docs will assist you to integrate the score submission functionality into your game.

To submit a score, you should call the `addScore` method from the HTML5 v2 SDK. Our backend contains the logic for saving the new score only if it's higher than the previous one. Thus, you can call the method as often as needed, for example, every time the user gets a new score. The code below shows an example of submitting a score with the `100` value. The score can also be a decimal number. An error will occur if the score is not a valid number.

Callback examplePromise example

```
const callback = (error) => {
    if (error) {
        console.log("Error:", error);
    }
};
window.CrazyGames.SDK.user.addScore(100, callback);
```

```
try {
    await window.CrazyGames.SDK.user.addScore(100, callback);
} catch (e) {
    console.log("Error:", e);
}
```
