<!-- https://docs.crazygames.com/resources/midgame-ads-pacing/ -->

# Optimizing Midgame Ads: Pacing and Placement

Advertisement requirements

Check our Advertisement requirements page for any restrictions.

Midgame ads (interstitials) are a major source of ad revenue, often accounting for 40–60% of total earnings in casual games. However, placing them poorly is the fastest way to frustrate players and drive them away from your game.

## Finding Natural Breaks in Gameplay

Keep ads out of active gameplay. Midgame ads should only appear when the player naturally expects a pause or transition.

### Ideal Placement Opportunities:

- Between levels or rounds: This is the most common and accepted placement.

- After a boss fight or milestone: Players are already pausing to take a breath.

- Before claiming a large reward: Builds anticipation (though rewarded ads are often a better fit here).

Restrictions

More details about restrictions around when and how to show midgame ads can be found in our Advertisement requirements.

## Pacing and Placement

The best monetizing games focus on player experience, not ad volume. Worry less about how many ads to show, and more about where and when they appear.

We enforce midgame ad frequency automatically (see our Advertisement requirements): at most one midgame ad every 3 minutes, with additional safeguards around game start and rewarded ads. This pacing is tuned for what works on CrazyGames. Request ads at every natural break in your game loop and let the SDK handle the rest. You do not need to implement your own cooldown timers to show fewer ads than the SDK allows.

### 1. Focus on Logical Breaks

Most players think in terms of game progression (like finishing a level or returning to a menu). Make sure your ad requests:

- Stick to natural transitions: Request ads when the player is resting (e.g., on a "Stage Clear" summary screen, not right as the next level is loading).

- Keep the flow: Avoid triggering ads while a user is actively navigating menus or starting a task.

### 2. Desktop vs. Mobile Placement

- Desktop: Players typically have longer, more focused sessions. Death screens, level transitions, and summary screens all work well.

- Mobile: Mobile sessions are often shorter and more fragmented. Death screens and level transitions are usually the most natural placement points.

## Protecting Day 1 Retention

The first few minutes of your game are critical. If players are shown ads before they understand the core loop, they may leave. It is usually better to wait until the player completes the tutorial or has played for at least 3-5 minutes before showing a midgame ad. You could also only show midgame ads after Level 3 or 4 - let players get hooked on the gameplay first!

## Analytics and Optimization

It is important to track the impact of your ad pacing. Keep an eye on these metrics:

- Ads per active user: Are players actually seeing the ads?

- Retention Drop-off: Does retention drop at the level where you show the first midgame ad?

- Session Length: Are players quitting immediately after an ad plays?

Tips for optimizing:

- Avoid showing the first ad too early. Try introducing midgame ads after Level 3 or 4 instead of Level 1.

- Delay midgame ads for the first few minutes of a player's first session to help them get into the game.

- If retention drops after introducing ads, revisit where you place them rather than reducing how often you request them.
