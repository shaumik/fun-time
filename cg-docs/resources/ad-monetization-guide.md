<!-- https://docs.crazygames.com/resources/ad-monetization-guide/ -->

# CrazyGames Monetization: The Guide to Maximizing Ad Revenue

Advertisement requirements

Check our Advertisement requirements page for any restrictions.

This guide explains how to best use the three ad formats we support - Banners, Midgame ads, and Rewarded ads - to meaningfully improve your revenue per 1000 plays.

## The ad formats and your strategy

- Revenue per 1000 plays: Your primary monetization metric. Optimizing when and where ads appear directly impacts this number.

- Player experience: The best monetization strategies feel natural. Forcing too many ads will hurt your retention and play time, which in turn reduces your revenue. It is a fine line to walk!

- Genre matters: The best monetization is specific to the game genre. Puzzle games need different placements to casual games, etc. Check out our dedicated genre guides:
Hypercasual & IO Games

- Midcore, RPG & Idle Games

- Puzzle Games

- Action Games

- Clicker Games

- Word Games

- Driving Games

Games with smart, balanced ad placements generate much higher revenue while keeping their players happy.

## Crucial Monetization Principles

Before choosing your ad mix, keep these key insights in mind:

- The best monetizing games focus on player experience, not ad volume. Worry less about how many ads to show, and more about making placements feel natural. Poor placement hurts retention and play time, which in turn reduces your revenue.

- Optimizing conversion is critical. Conversion (the percentage of players playing for at least one minute after starting the game) relates directly to the percentage of players that contribute to your impressions-per-play. Better conversion means you earn more without needing to chase more ad impressions.

- Average play time and impressions per play are linked. That means you need to design your game loop to retain players longer, and the monetization will naturally follow.

## 1. Rewarded ads

Info

For a deeper dive into economy balancing and placement psychology, read our guide on Mastering Rewarded Ads.

What they are: Ads that players voluntarily choose to watch to get an in-game reward (e.g., extra lives, premium currency, or exclusive skins).

Why they matter: Rewarded ads have the highest eCPM (revenue per ad) and go down better with players because they are opt-in and are tied to meaningful in-game benefits.

Pros:

- Highest revenue potential per impression.

- Positive impact on player retention and satisfaction.

- Completely opt-in, so they never interrupt gameplay unexpectedly.

Cons:

- Requires careful game design to balance the economy (rewards can't be too generous or too weak).

- Lower impression volume compared to midgame ads, as players must choose to watch them.

Restrictions

Placement, UI, and reward rules are in our Advertisement requirements.

### How to use them best

- Make rewards meaningful: Offer things players actually want, like a revive in a runner game or a rare weapon in a shooter.

- Placement is key: Put the offer where the player needs it most (e.g., a "Revive" button on the game over screen, limited to once per session to comply with platform frequency caps, or a "Double Coins" button at the end of a level).

- Genre tips:
Action/Arcade: revives or temporary power-ups (see Action Games).

- Idle/Merge: time skips or offline earnings multipliers (see Clicker Games).

- RPG/Strategy: premium currency or gacha pulls (see Midcore, RPG & Idle Games).

- Puzzle: hints or extra moves (see Puzzle Games).

## 2. Midgame ads

Info

To learn how to protect your Day 1 Retention while maximizing impressions, read our guide on Optimizing Midgame Ads.

What they are: Video ads that play automatically at natural breaks in your game, e.g. between levels or after a player dies.

Why they matter: They guarantee impressions and form the baseline of your ad revenue, especially for players who don't engage with rewarded ads.

Pros:

- High volume of impressions, leading to consistent revenue.

- Easy to integrate into most game loops.

Cons:

- Can frustrate players and hurt retention if shown at the wrong times or in the middle of active gameplay.

- Lower revenue per impression than rewarded ads.

Restrictions

When and how to show midgame ads are in our Advertisement requirements.

### How to use them best

- Find the natural breaks: Show them when the player is already expecting a pause, like loading the next level, or after a "Level Complete" screen.

- Focus on placement, not volume: Request midgame ads at every natural break in your game loop: between levels, after a death, on a summary screen. The SDK handles ad pacing automatically (max 1 every 3 minutes) so you don't need to manage frequency yourself. The best monetizing games get this right by making ads feel like a natural part of the experience.

- Genre tips:
Hypercasual/Puzzle: Show ads between levels, but make sure levels are long enough to justify the break (see Puzzle Games).

- Shooter/IO/Action: Show ads on the death/respawn screen, but give the player a moment to breathe first (see Action Games).

## 3. Banners

Info

For tips on UI/UX design and avoiding accidental clicks, read our guide on Banner Ad Best Practices.

What they are: Static or animated display ads that cover part of the screen.

Why they matter: They provide a slow but steady stream of revenue without interrupting the core gameplay loop.

Pros:

- Non-intrusive; players can continue interacting with the game while the ad is visible.

- Consistent, passive income. Banners serve as a reliable revenue stream, though few games currently use them.

Cons:

- Lowest revenue per impression of the three formats.

- Takes up valuable screen real estate, which can be tricky on smaller screens.

- Require changes to your UI, and extra development time to implement.

Restrictions

Placement and usage rules are in our Advertisement requirements.

### How to use them best

- Use menu screens: Place banners on main menus, shops, lobbies, and level-select screens - not during active gameplay.

- Keep UI clean: Ensure your game's buttons and joysticks are far away from the banner to prevent accidental clicks.

- Genre tips:
Puzzle, Clicker & Word Games: Use banners on level-select screens, main menus, and shop screens.

- Simulation/Management: Great for persistent UI screens where players spend a lot of time reading or planning.

- Board/Card Games: Place banners on menu and lobby screens, not over the active board.

## Desktop vs. Mobile Web Strategy

CrazyGames players enjoy playing on both desktop and mobile. Your monetization strategy should adapt to this!

### Screen Real Estate and UI

- Desktop: You have a lot of screen space. Large banners can easily fit at the bottom or top of the screen without cluttering the UI or interfering with gameplay.

- Mobile: Screen space is at a premium. A standard banner might take up 10–15% of the screen on a mobile device in landscape mode, so you need to be careful with placement.

### Session Lengths and Pacing

- Desktop: Players typically have longer, more focused sessions. You can rely more heavily on deep economy rewarded ads and midgame ads at natural breaks.

- Mobile: Sessions are often shorter and more fragmented. You may need to introduce your first midgame ad slightly earlier or rely more heavily on quick "Watch to Revive" rewarded ads to capture value before the short session ends.

## Dealing with Ad Blockers

A significant amount of web game players use ad blockers. While we work to limit ad blocker usage across the platform, you need to make sure your game still works.

Info

For more information, refer to the Adblock detection SDK documentation.

## Key takeaways

If you make your monetization strategy a core part of your game's design instead of an afterthought, your game will earn more! The best games integrate ads so smoothly that they feel like a natural part of the experience.

To meaningfully improve your revenue per 1000 plays, focus on high-value Rewarded ads, use Midgame ads respectfully during natural breaks, and add Banners where space allows. Protect your player experience, and the revenue will follow.
