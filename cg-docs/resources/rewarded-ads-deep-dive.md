<!-- https://docs.crazygames.com/resources/rewarded-ads-deep-dive/ -->

# Mastering Rewarded Ads: A Deep Dive

Advertisement requirements

Check our Advertisement requirements page for any restrictions.

Rewarded ads are a fantastic ad format, offering high revenue per ad and a great user experience because they are entirely opt-in. Since players choose to watch them, they feel they are making a fair trade of their time for in-game value.

However, integrating rewarded ads takes some planning. Poor implementation can hurt your game's economy or lead to fewer clicks.

## Value Exchange

Players are usually happy to watch a short ad if the reward feels worth their time. Think about what motivates your players:

### Urgency & Loss Aversion

This is a very strong motivator. If a player is about to lose something valuable (a high score, a rare item drop, or progress in a long level), they will often watch an ad to save it.

- Example: "Watch to Revive" immediately after falling (limited to once per session to stay within frequency guidelines).

- Example: "Keep your items" if they fail a level.

### Convenience & Time Saving

Players love to make progress quickly. If your game features timers or grinding, you can offer a helpful shortcut.

- Example: "Skip 1 hour of waiting time."

- Example: "Instantly complete this upgrade."

### Exclusivity & Status

You can offer rewards that can't be easily obtained through normal gameplay.

- Example: Exclusive skins that are only unlockable by watching a rewarded ads.

- Example: A "Premium Chest" that drops rare items, available once per day.

## What Makes a Great Placement?

Looking at the top-performing games on CrazyGames, successful rewarded ad placements are usually:

- Designed as a core gameplay feature: The best-earning games are designed with rewarded ads in mind from the start.

- Easy to find: Placement buttons are shown in lots of different places throughout the game loop, like main menus, level select screens, shops, and natural breaks.

- Impactful: The reward should feel worth it, like doubling end-of-level rewards or unlocking a helpful temporary booster.

- Visible in natural breaks: Showing the option during natural pauses (e.g. between levels or after a wave is cleared) means players are more open to watching.

- A lifeline during failure: Offering an ad as a lifeline when the player fails a challenge (e.g., "Respawn now" or "Keep your score") works incredibly well (remember to cap revives at once per session).

## Economy Balancing & Reward Scaling

If your rewards are too generous, players might lose interest in playing the game and just watch ads. If they are too weak, no one will click the button.

### Dynamic Reward Scaling

A static reward (like 100 coins) becomes less useful as the player progresses and item costs rise.

Tip

Tie the reward to the player's current progress. Try rewarding them with a percentage of the cost of their next upgrade, or an amount equal to a few minutes of play.

### Caps and Limits

It's a good idea to protect your economy so players don't burn through it by watching too many ads:

- Daily Caps: Limit how many times a player can watch an ad for premium currency (e.g., maximum 5 times per day).

- Diminishing Returns: The first ad gives 100 gems, the second gives 50, and the third gives 25. This encourages players to return daily.

Restrictions

Placement, UI, and reward rules are in our Advertisement requirements.

## Best Placements & UI Design

Make sure players know rewarded ads are available so they actually click them.

### High-Converting Placements:

- Game Over Screen: "Watch to Revive" or "Double your coins".

- The Store/Shop Menu: Place a "Free Daily Chest" at the top of the shop.

- Main Menu / Lobby: A "Daily Ad Reward" button that lights up when available.

- Out of Resources: When a player tries to buy an item but doesn't have enough coins, show a prompt: "You need 50 more coins. Watch a quick ad to get them?"

### UI Best Practices:

- Be clear about the reward: It should be clear what players get. Instead of "Watch Ad", try "Watch Ad for +50 Gems".

- Use video icons: Include a small video camera or play icon next to the reward icon so players know they'll see a video ad.

### Handling Players with Ad Blockers

A significant amount of web game players use ad blockers. While we work to limit ad blocker usage across the platform, you need to make sure your game still works.

Info

For more information, refer to the Adblock detection SDK documentation.

## Genre-Specific Trends

Ad strategies can vary quite a bit depending on your game's genre:

- Action Games & Clicker Games: These genres often use rewarded ads frequently. Top action games show more rewarded ads than the platform average, even with shorter sessions.

- Word Games: These games usually show fewer ads overall but monetize very well because players tend to stay and return. High retention means more players engage with rewarded opportunities.

- Puzzle Games: Puzzle games generally perform best overall. Slower gameplay is perfect for offering hints or undo moves that players are happy to watch an ad for.

## Optimizing Your Rewards

It's always a good idea to experiment and find what works best:

- Experiment with reward amounts: Try adjusting the rewards (e.g. offering 50 coins instead of 100). If players watch just as many ads for the smaller reward, keeping it smaller helps protect your game's economy.

- Try different placements: See where buttons perform best. Try placing a "Double Loot" button in different areas of the screen to see what players prefer.
