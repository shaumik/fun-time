<!-- https://docs.crazygames.com/resources/getting-to-the-first-frame/ -->

# Getting to the First Frame: Making Web Games Load Fast and Feel Great

If you've spent any time making games for the web, you know the challenge: getting players into your game as quickly as possible, and making it feel snappy once they are there.

At CrazyGames, we have over 50 million monthly players, so every delay matters. A few extra seconds of load time can mean the difference between a new fan and someone who bounces before the fun even begins.

This guide is all about the journey to the first frame: what happens under the hood before the first pixel appears, and what developers can do (in Unity, Godot, or anywhere else) to make it fast.

## Why loading times matter

Loading is the first impression your game makes, and it's where most players drop off if it's not handled well.

According to user interface research:

- <100 ms: Perceived as instant. No feedback needed.

- 1 second: Feels fine, does not break flow.

- 10 seconds: Attention starts to wander. You must show feedback or preload activities.

Google page speed metrics also show that bounce probability rises quickly as load time increases.

The goal is not necessarily to load instantly. For most games, that is unrealistic. The goal is to make loading feel instant by providing immediate feedback.

## What's actually happening when your game loads

Before the first frame appears, the browser still needs to:

- Download game files (WASM, JS, textures, audio, models).

- Initialize the engine (memory setup, shader compile, core systems).

- Process assets (decompress, parse, upload to GPU).

- Run your startup code (for example, Unity `Awake()`/`Start()` or Godot `_init()`/`_ready()`).

Only after all of this does rendering begin.

### CrazyGames Load Size

On CrazyGames, we track first-load time and size up to the moment your game calls the SDK `gameplayStart` method. This should represent the first moment of real gameplay, not only a loading screen.

A practical setup is:

- Load tutorial-critical assets first.

- Start gameplay as soon as the tutorial can be played.

- Continue loading main-game content while the player is in the tutorial.

- If content is still loading after the tutorial, show a loading screen before entering the full game.

## Win #1: Reduce initial download size

The biggest win is to shrink, split, or defer what players download first.

Both Unity and Godot support loading heavy content later, once players are already interacting with the game.

UnityGodot

By default, Unity includes everything in the initial build, even content players might not see for a long time.

`Addressables` let you split content into groups, load it asynchronously, and optionally host it externally.

Get started:

- Install `Addressables` via Package Manager.

- Mark assets or folders as Addressable in the Inspector.

- Assign assets to groups.

- Build groups: Addressables -> Build -> New Build -> Default Build Script.

- Load assets asynchronously:

```
var handle = Addressables.LoadAssetAsync("IntroScene");
```

Release the handle when done:

```
Addressables.Release(handle);
```

In Godot, you can export sections of content as `.pck` files, host them externally, download them at runtime, and mount them.

```
var http_request = HTTPRequest.new()
add_child(http_request)
http_request.connect("request_completed", self, "_on_pck_downloaded")
http_request.request("https://mygame.com/level_2.pck")
```

Write the response to disk, then mount it:

```
ProjectSettings.load_resource_pack("user://level_2.pck")
```

Load interactively to avoid frame stalls:

```
var loader = ResourceLoader.load_interactive("res://levels/level_2/main_scene.tscn")
```

```
if loader:
    var err = loader.poll()
    if err == ERR_FILE_EOF:
        get_tree().change_scene_to(loader.get_resource())
    elif err == OK:
        $UI/ProgressBar.value = float(loader.get_stage()) / loader.get_stage_count()
```

## Win #2: Optimize build size

Smaller builds load faster and reach gameplay sooner.

UnityGodot

- Use Brotli compression.

- Use efficient texture compression (for example ASTC).

- Use Vorbis audio and force mono where possible.

- Compress models and disable `Read/Write Enabled` where possible.

- Check splash/logo export settings.

- Use Build Report and Project Auditor.

- Consider the CrazyGames SDK optimizer package.

See also: Optimization tips, Optimizer package.

- Compress exported `.wasm`, `.js`, and `.pck` files with Brotli.

- Serve `.br` files with `Content-Encoding: br`.

- Keep PCK external when appropriate.

- Use suitable texture compression for your targets (for example S3TC or ETC2).

- Disable debug symbols for release builds.

- Use Project -> Tools -> Optimize Resources.

## Win #3: Shorten engine initialization

Even after download completes, players can still see a blank screen during engine boot and startup logic.

UnityGodot

- Use aggressive code stripping and test carefully.

- Use stripping tools and profile startup scripts.

- Keep `Awake()` and `Start()` light.

- Move heavy startup work to coroutines or async tasks.

- Avoid overusing `Resources.Load()`.

- Use a custom export template for web builds.

- Disable unneeded modules/features.

- Keep `_init()` and `_ready()` lightweight.

- Defer heavy logic via `call_deferred()`.

- Keep logging low in release web builds.

## Runtime performance

After startup, maintain smooth frame pacing and responsiveness.

Common bottlenecks:

- CPU-heavy JS/WASM logic

- Overdraw from transparency

- Heavy physics

- Runtime allocations and garbage collection

- Audio latency

UnityGodot

- Use IL2CPP for WebGL.

- Minimize per-frame allocations.

- Profile in both Editor and browser.

- Test on lower-end devices.

- Reduce physics FPS when appropriate.

- Tune vsync settings for responsiveness.

- Profile with Monitors and frame-time tools.

- Keep memory usage stable for browser reliability.

## The future: WebGPU and beyond

The web platform is improving quickly. As WebGPU adoption grows, graphics performance and shader compilation times continue to improve.

That means less time spent working around platform limits, and more time building games that are high-fidelity, responsive, and fast to start in a browser tab.
