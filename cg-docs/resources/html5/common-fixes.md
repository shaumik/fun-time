<!-- https://docs.crazygames.com/resources/html5/common-fixes/ -->

# Common fixes

The snippet below addresses common UX issues caused by default browser behavior:

- Unwanted page scroll

- Unwanted key events

- Visibility changes on Samsung App

- Context menu appearing outside the Unity canvas

```
// Disable unwanted page scroll.
window.addEventListener("wheel", (event) => event.preventDefault(), {
    passive: false,
});

// Disable unwanted key events and spacebar scrolling.
window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", ""].includes(event.key)) {
        event.preventDefault();
    }
});

// Fix visibility change handling on webview (reported on Samsung App).
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState) {
        if (document.visibilityState === "hidden") {
            application.publishEvent("OnWebDocumentPause", "True");
        } else if (document.visibilityState === "visible") {
            application.publishEvent("OnWebDocumentPause", "False");
        }
    }
});

// Disable context menu after right click outside the canvas.
document.addEventListener("contextmenu", (event) => event.preventDefault());
```
