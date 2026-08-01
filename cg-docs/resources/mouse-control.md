<!-- https://docs.crazygames.com/resources/mouse-control/ -->

# Mouse Control tips

On desktop, a significant part of our users plays outside fullscreen mode. Your game should avoid users accidentally leaving the game by clicking outside of the game frame. Examples below explain how this can be done.

We recognize 3 different game types:

- First-person games:
Lock the mouse in the center of the screen during gameplay

- Implement a keyboard shortcut to unlock the mouse (e.g. Escape, Tab)

- Examples: Bloxd.io

- Top-view games in which the character moves based on mouse gestures (Agar.io, GunMaster.io, Stickman King, …). In these games, we require your game to:
Lock the mouse & confine it to the game area

- Show a custom pointer or use an alternative method to display the mouse position (‘joystick’)

- Implement a keyboard shortcut to unlock the mouse (e.g. Escape, Tab)

- If any UI buttons are shown during gameplay, they should either be clickable or a keyboard shortcut should be indicated

- If you require additional functionalities, such as drag-and-drop they need to be managed from the game

- Optionally, the game could also add WASD/Arrow keys

- Examples: Little Big Fighters, GunMaster.io

- Other games, where most actions are taken with mouse clicks on the UI (clickers, bubble shooter, …)
In these games with limited mouse movement, we do not require mouse confinement.

## HTML5 resources

For HTML5 games, please refer to the Pointer Lock API.

## Unity examples

Here is a code example that uses `customMouse` as a variable that contains a custom mouse image confined to the game area.

Warning

The fake cursor won’t click on the Unity UI buttons, you will need to implement additional logic for that. Refer to the requirements above.

```
public Image customMouse;
public RectTransform canvas;
public float cursorSpeed = 20f; // adjust parameter according to your game
private bool isLocked = false;

void Start()
{
   isLocked = true;
   customMouse.enabled = false; //hide custom mouse
   Cursor.lockState = CursorLockMode.Locked; //Hide hardware cursor
}

void Update()
{
   float mouseX = Input.GetAxis("Mouse X") * cursorSpeed; //reads movement along X
   float mouseY = Input.GetAxis("Mouse Y") * cursorSpeed; //reads movement along Y

   // tracks the current position of the custom cursor.
   Vector2 currentPosition = customMouse.rectTransform.localPosition;

   // moves the custom cursor based on mouse input.
   currentPosition.x += mouseX;
   currentPosition.y += mouseY;

   // ensures the cursor stays within the canvas boundaries
   currentPosition.x = Mathf.Clamp(currentPosition.x, canvas.rect.min.x, canvas.rect.max.x);
   currentPosition.y = Mathf.Clamp(currentPosition.y, canvas.rect.min.y, canvas.rect.max.y);

   customMouse.rectTransform.localPosition = currentPosition;

   if (Input.anyKeyDown) {
      Cursor.lockState = CursorLockMode.Locked;
      if (isLocked)
      {
         customMouse.enabled = true;
         isLocked = false;
      }
   }

   if (Application.isFocused == false)
   {
      Cursor.lockState = CursorLockMode.None;
      if (!isLocked)
      {
         customMouse.enabled = false;
         isLocked = true;
      }
    }
}
```
