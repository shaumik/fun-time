<!-- https://docs.crazygames.com/resources/unity-addressables-guide/ -->

# Addressables guide

The Addressables package allows you to extract assets (audio clips, textures, meshes, and even scenes and prefabs) from your build, and load them when needed. This can drastically reduce the build size, thus increasing the number of players that actually wait for the game to load and play it.

This beginner's guide will teach you how to install the package and extract some basic assets, and then load them when needed.

## Package installation

Open the Package Manager window from `Window > Package Management > Package Manager`. Go to Unity Registry, search for Addressables, and install the package.

There is nothing else that you need to configure in the installed package. You are ready to use Addressables.

## Addressable assets

Background audio clips are usually long clips that take up a lot of space in the final build. You can see in the image below that this audio clip takes almost 3MB. It is a good idea to extract these in external assets and load them later after the game is loaded.

To do this, you will first of all need to mark your asset as "Addressable":

If you build the project at this point, you will see a `StreamingAssets` folder appear near the `Build` folder. This folder contains the external assets that will be loaded at runtime. Don't forget to upload it on CrazyGames when submitting your build.

Warning

If you reference the audio clip anywhere in your project, for example, if you assigned it to an Audio Source component, Unity will continue including this asset in your Build files. This can easily be spotted if your build size doesn't decrease, even though you marked assets as Addressables.

## Loading addressable assets

With a little bit of code, you can now load this audio clip and play it in your game. Attach this script to an object:

```
using UnityEngine;
using UnityEngine.AddressableAssets;

public class BackgroundAudioPlayer : MonoBehaviour
{
    public AssetReference audioClipAsset;

    private void Start()
    {
        audioClipAsset.LoadAssetAsync().Completed += handle =>
        {
            var audioSource = gameObject.AddComponent();
            audioSource.clip = handle.Result;
            audioSource.Play();
        };
    }
}
```

And don't forget to assign the audio clip to it:

Please note that in this case Unity doesn't assign the audio clip itself, but just a reference to it, so that it knows what asset to load.

Build your project again, and you will notice in the network tab how the audio clip is loaded in a separate network request.

## More advanced stuff

You can do much more advanced stuff with addressables. For example:

- If you mark a prefab as addressable, all the assets referenced in that prefab (audio, meshes, textures) will be extracted in a separate bundle. This can be done if your game has a skin shop. Only load those assets when the shop is opened and when the player is in the game itself.

- If you have multiple loaded assets, you can call `audioClipAsset.ReleaseAsset();` to release them from memory. It is a good practice to do this with unused assets to reduce memory usage during runtime.

- You can split your addressables into different groups and package them in different files, so that you avoid loading a big bundle and load smaller bundles.
