<!-- https://docs.crazygames.com/resources/optimizer-package/ -->

# Unity - Optimizer package

Deprecated

The optimizer package was deprecated in favour of custom CrazyGames builds. If you are still looking for the optimizer, you can find it on on GitHub.

The WebGL Unity optimizer is an open-source utility created by CrazyGames. Its purpose is to tweak various Unity settings and help you optimize the assets, so you get a bundle as low as possible, with the highest performance. You can find the Utility as a separate project on GitHub. It also comes integrated by default in our SDK, so you don't have to download it as a separate package.

Minimum required versions:

- C# 6.0

- Unity 2019

Once you have imported our SDK in Unity, or the package from GitHub, it will be accessible in the `Tools > WebGL Optimizer` menu option.

## Export optimizations

The export optimizations tab contains a checklist of options that should be correctly set to improve the performance and decrease the bundle size of your WebGL game.

## Texture optimizations

The texture optimizations tool provides an overview of all the textures in your project, and also various tips about optimizing the size they occupy in the final build.

It finds textures in your project in these 2 ways:

- By looking at the scenes included in the build (Build settings > Scenes in build), and finding recursively all the textures on which those scenes depend.

- By finding textures in `Resources` folders, or by recursively finding textures on which the assets from the Resources folders depend.

This means that the texture detection may miss more intricate textures that are not covered by the above cases.

You can toggle the "Include files from Packages" options to also display textures from the installed packages, for example from Package Manager.

## Build logs analyzer

The build logs analyzer parses the Editor.log file to extract the list of files included in your build and the space they occupy. You can use this utility to furthermore analyze the files included in your project.

Similar to the texture optimizer, you can toggle the "Include files from Packages" options to also display textures from the installed packages, for example from Package Manager.
