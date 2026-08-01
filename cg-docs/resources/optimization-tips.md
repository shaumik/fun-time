<!-- https://docs.crazygames.com/resources/optimization-tips/ -->

# Unity - Optimization tips

The following tips will help you develop better games that run smoother in the browser.

Info

A lot of these tips will automatically be applied when creating a custom build with the help of our SDK.

## Build size

This section contains various tips for decreasing the build size of your game. A smaller build will increase the load rate of your game, subsequently increasing your revenue.

### Compression

Unity supports Brotli and Gzip compressed builds for WebGL.

We recommend that you use Brotli compression, which is supported in all the major browsers (caniuse.com) . Although it takes longer to build a Brotli compressed game, the final build is smaller compared to gzip. This improves the loading rate for your game significantly, and thus your revenue.

You can read more about Unity compression on their official documentation.

### Code optimization

Avoid using the default "Shorter Build Time" code optimization option. Please pick here one of these:

- "Runtime Speed with LTO" if you are concerned about performance

- "Disk Size with LTO" if you want a smaller build

### IL2CPP Code Generation

For reduced build sizes we recommend setting this to `Faster (smaller) builds`. In Unity 6.2 this was renamed to `Optimize for code size and build time`.

Expected gains

In our test with an empty Unity project build, selecting "Disk Size with LTO" and "Faster (smaller) builds" options mentioned in the above sections decreased the final size from 14.7MB down to 12.5MB (Brotli compression was used).

### Code stripping

The code stripping functionality allows Unity to remove unused code from your project, thus reducing the final build size.

By default, it is enabled, and set on the minimal level. If you are looking to further optimize your build size, you can increase the level to low, medium, or high. Be sure to test the final build, since, with a higher level of stripping, chances are that some useful code will also be removed. To read more about code stripping and how to protect your code from being removed at higher stripping levels, please check the official Unity documentation.

### API Compatibility Level

We recommend that you use the ".Net Standard" API compatibility level, as this provides smaller build sizes. ".Net Framework" should be used only if the game depends on APIs not compatible with ".Net Standard".

You can read more about the API compatibility, and other WebGL export settings on the official Unity documentation.

### Audio

Forcing audio to mono, and reducing the quality will reduce the size of the audio clip in your build.

### Textures

Another way to decrease the final build size is to correctly set the texture max size.

Some purchased assets, imported models, or even your textures, may have a large size, for example, 2048x2048. It is a good practice to set an appropriate size for the texture since this will reduce the size of the texture in the final build. For example, for small objects, or far away objects barely visible, you can pick a smaller texture size since the quality loss will not be as noticeable. Furthermore, you can also select low quality in the compression drop-down, to reduce texture size even more. Don't forget to check if the game still looks good after tweaking texture size and compression quality. The changes will also be visible in the editor.

You should also consider disabling "Generate Mipmap" if your texture is a sprite or is not supposed to be viewed at an angle or far distance, as mipmaps take some space in the final build.

You can also experiment with "Use Crunch Compression" texture option. In some cases this can reduce the build size even more. Check to make sure the textures still look good if you enable this option.

### Addressables

Addressable assets are a great way to decrease your final build size. Textures and sounds occupy significant space in the final build, so they can be kept separate from it, and loaded at runtime. Not only does this allow faster game loading, if you unload unused assets when they aren’t needed anymore, you can also reduce the runtime memory of your game.

CrazyGames allows you to upload your Addressable assets to our server, with limited effort and no cost.

Read more about the Unity Addressables package here.

Here are some considerations:

- We support addressables or streaming assets loading only for Unity 2020 and newer versions.

- Make sure to upload these files when submitting your game to CrazyGames, don't host them elsewhere (they will not count towards your initial download size if implemented correctly). You will need to upload both the `Build` folder as the `StreamingAssets` folder.

- Please make sure that the folder containing the external assets is named `StreamingAssets`, which is also the default name for it. Our system relies on this name to set the `streamingAssetsUrl` field in the Unity loader config.

- When manually loading assets, for example by using `UnityWebRequestAssetBundle`, please ensure the you construct a correct URL, using the `Application.streamingAssetsPath` path provided by Unity.

### URP and post-processing effects

If your game is using URP but you aren't using any post-processing effects (tonemapping, bloom, vignette, etc) we recommend that you disable the post-processing feature in the pipeline data. This will reduce the size of a Brotli compressed build by approximately 1mb. You can disable the post-processing effects by selecting the URP asset data, and unticking post-processing.

### Mesh compression

By default, Unity applies vertex compression to all the meshes in your project.

It is possible though to also enable mesh compression individually for each mesh. You can do this by selecting the mesh, selecting a compression level, and clicking the "Apply" button afterward.

This will reduce even more the build size compared to vertex compression. In our tests, a mesh file that was vertex compressed occupied ~300kb in the final build but individually compressed with the `High` option its size was lowered to 100kb.

Individual mesh compression doesn't come without any drawbacks. It may cause the following 2 things:

- slower loading times, since the meshes have to be decompressed on game start

- artifacts, since some data may get altered during compression

In our tests we didn't notice any of these, however, we recommend that you give a quick test to your game if you decide to compress the meshes individually, to be sure it still looks and loads fine.

You can read more about mesh compression on the official Unity documentation

### Unused packages

We recommend that you remove or disable all unused packages from `Window > Package Management > Package Manager` (both "In Project" and "Built-in"). This prevents unused dependencies from being included in your build and can reduce build size.

## Performance

This section contains various tips for improving the performance of your game. There are a lot of users that may play your game from weaker devices, for example, Chromebooks. So ensuring everyone can play it as smoothly as possible will result in increased revenue.

### Sprite atlases

For each individual sprite that you have in your 2D game, Unity will issue a draw call. The more draw calls your game has, the slower it will run. The sprite atlas combines multiple sprites in a single texture, thus issuing only a single draw call for the combined sprites.

You will need to install first of all the `2D SpriteShape` package.

Afterward, you can click anywhere in your Project view, and select `Create > 2D > Sprite Atlas` option to create a new Sprite atlas.

For more detailed information please refer to the official Unity documentation.

### Mesh LOD

Mesh LOD (Level Of Detail) is a Unity feature that reduces the number of polygons to draw with minimum memory footprint and computational overhead. In simpler terms, each mesh can have multiple levels of detail with less polygons, and if the mesh is too far from camera, Unity will switch to rendering a lower polygon version.

Starting with Unity 6.2 you can generate LODs on import, and we advise you make use of mesh LOD to get smoother performance on weaker devices.

### Static batching

Batching is a powerful technique to reduce the draw calls and thus increase the performance of the game. Static batching combines meshes from the objects that don't move, and sends them in a single draw call to the CPU. If you want to use static batching, you need to enable it in the build settings:

Furthermore, you'll need to also mark your objects as static objects, by either enabling the `Static` toggle or selecting only the specific `Batching Static` flag. Static objects must be objects that don't move, for example rocks, clouds, and buildings.

Static batching works by creating a combined mesh from all the static objects. This means that the more static objects you have, the more memory will be used. For example, if you have a forest with a lot of trees and mark them all as static, memory usage may increase substantially. So sometimes, compromises have to be made between memory usage and rendering performance.

Check the official Unity documentation to find out more about static batching.

### Exceptions

You can choose various levels for exception support when building for WebGL.

Selecting "None" provides better performance and smaller builds. However, if there is an exception thrown during the game, for example in a try/catch block, the game will crash. We recommend using this option only when you are sure the game runs as smoothly as possible, without any bugs, and you don't have any try/catch blocks in your code. Otherwise, the default "Explicitly thrown exceptions only" is also a good starting point. We recommend that you never submit a game with the "Full With Stacktrace" option selected. This option is only good for debugging, and it decreases the performance and increases the browser memory usage. You can find more information about exception support on the official Unity documentation.

### Quality settings

We recommend decreasing the quality settings in `Edit > Project Settings > Quality` in order to improve game performance. You can also create a custom quality level that fits your game better, with the optimal settings.

### WebAssembly 2023

Enabling WebAssembly 2023 can result in more performant builds and slightly reduced build size. For example, conversions to float or double to int will run faster and use less code. You can enable WebAssembly 2023 by enabling the checkbox shown in the image below. This can be done in Unity 6 or newer versions.

## Runtime memory

Unity uses a memory heap to store the objects, scenes, shaders, etc. when your game is running in the browser. The memory heap is resized automatically by Unity when needed. However, errors may happen during the resizing process, since the browser may fail to allocate more memory for resizing the heap. That's why it's important to keep your memory usage as low as possible. This also benefits the game when running on weaker devices, like mobile devices. You can find more information about memory usage on the official Unity documentation.

### Garbage collection

The garbage collector runs at the end of every frame in WebGL, so there are various minor optimizations you can do to your code to generate less garbage.

- for string concatenations, if the number of concatenated elements exceeds 10, it is recommended to start using StringBuilder

- cache arrays returned by the functions before using them in a for loop. In other words, avoid `for(int i=0;i<getArray();i++)`

- use `gameObject.CompareTag("tagName")` for tag comparison, since it doesn't allocate memory for the tag and is much more performant

- for coroutines, cache the yield, for example, `var delay = new WaitForSeconds(5.0f);` if you need to return it multiple times

Bad code example, which will end up creating thousands of temporary strings before the final iteration:

```
string hugeString = "";
for (int i = 0; i Use StringBuilder to optimize the above code:

```
using System.Text;
var stringBuilder = new StringBuilder();
for (int i = 0; i Bad code example, which with every loop allocates more and more memory:

```
byte[] data;
for (int i = 0; i It is better to preallocate once:

```
byte[] data = new byte[100000];
for (int i = 0; i Addressable assets are a great way to decrease your final build size. Textures and sounds occupy significant space in the final build, so they can be kept separate from it, and loaded at runtime. Not only does this allow faster game loading, if you unload unused assets when they aren’t needed anymore, you can also reduce the runtime memory of your game.

Build size section contains more info about addressables.

### Background audio compression

The official Unity documentation recommends using the CompressedInMemory load type for background audio. This decreases the runtime memory usage because the audio clip doesn't have to be decompressed when the game runs. The drawback is the loss of precision and the latency, which usually don't matter so much for background audio.

The following is a screenshot from the Unity Memory Profiler, which shows the total RAM memory used by a background audio clip. When the load type is set to CompressedInMemory (column A), the audio clip uses only 5mb of RAM.

### Memory profiler

To get a better overview of memory usage, we recommend using the Memory Profiler package. With the help of this tool, you can capture a snapshot of the memory usage at any given moment, and get an overview of the resources using the RAM memory.

In the `Unity Objects` tab, you will get a better overview of the meshes, textures, shaders, fonts, audio clips, animations, and many other things that are loaded in memory during the runtime.

See if there are for example:

- unused resources, like textures, meshes, objects, etc. (this means that they are referenced somewhere and get loaded, when in fact they aren't used in the game)

- background audio clips taking too much space. Their load type can be set to CompressedInMemory to reduce the runtime memory usage.

- textures, meshes, audio clips that occupy too much memory. Can they be simplified, downsized, or compressed even more to take less memory?

## Other

### Project Auditor

Project Auditor is a tool from Unity that will provide insights on issues with the scripts, assets, and settings in your project. We recommend installing it, analyzing the project, and following the provided tips. It will help you optimize your code and your assets.

### Diagnostics Overlay

Diagnostics overlay can be enabled for your game by going to `Player Settings > Publishing Settings` and toggling `Show Diagnostics Overlay`. It will allow you to show an overlay when running the game in your browsers, containing information about the FPS and memory usage. It is a quicker, although more minimalist, alternative to the Memory profiler. You should also use the default web template provided by Unity to have access to it.

For more details check the Unity documentation.

### Target frame rate

Unity allows customizing the target frame rate, at which your game will be rendered. This may be useful on mobile devices, however, it should be avoided on WebGL since it may decrease the game performance in browsers.

The default value for `Application.targetFrameRate` is `-1`, and should be kept like this on WebGL. This means that the browser itself will control the frame rate, which provides the best performance on WebGL.

### Blurry UI text

We recommend that you test your game at various resolutions, including at small resolutions for example 900x500.

If your game is not running fullscreen, your UI settings (targeting a high reference resolution in Canvas Scaler, or having texts with big fonts that are scaled down) may result in blurry text, like in the image below:

### Name file as hashes

We recommend that you select this option when building your game.

The files will have unique names on every build, composed of the MD5 hash of their content. Although we clean the cache on our side after each game update, the browsers may still hold onto the old files, and unique file names fix this problem.

### Disable splash screen

You can disable the Unity splash screen to reduce the startup time. This is available from Unity 6.

Please be sure you also disabled "Show Unity Logo", otherwise it will still be included in the build.

### Enable caching

Be sure to enable caching so that the game loads faster on subsequent visits.

## Advanced

Warning

The following are more extreme optimizations and should be considered only if you are already familiar with Unity.

Our tests showed that adding URP increases the WebGL build size by approximately 3.6 MB. For simple 2D games that don’t require advanced graphics and rely mostly on sprites, consider removing URP to reduce the initial load size.

TextMeshPro is another package that adds considerable size. A fresh import increases the build size by about 0.7 MB. By cleaning up the `Resources` folder inside `TextMesh Pro` folder (for example, removing the emoji font), you can reduce the added size to around 0.5 MB.

## Additional information

### Index.html and your custom JavaScript

For Unity games on CrazyGames, we ignore the index.html file and store only the build files. So any changes that you do to the index.html file or any additional JavaScript files that you include, won't be available. If your game relies on external JavaScript files, you can upload it as an HTML5 game. However, you will be missing the Unity improvements that we do, for example fixing broken loading indicators for specific Unity versions, the loading indicator itself, etc.

### External resources

This talk from JS GameDev summit 2022 may help you avoid some common performance and memory issues. Alternatively, this talk, given by one of our own product engineers at the JS GameDev summit 2023, can also help you optimize your game.
