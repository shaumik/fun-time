<!-- https://docs.crazygames.com/sdk/leaderboards/ -->

# Leaderboards

Leaderboards allow players to compete globally, track their progress, and earn seasonal awards. Games with leaderboards enabled get additional visibility through a dedicated page in the sidebar, homepage carousels and widgets.

Warning

The leaderboard feature is only available for invited games.

Warning

Only one leaderboard per game is supported.

Key Features:

- Weekly Seasons: Seasons run Monday to Monday, ending at 9:00 AM UTC with automatic score reset

- Multi-Tiered Rankings: Players can view their rank globally, by country, and among friends

- Seasonal Awards: Trophies awarded for top positions (1st, 2nd, 3rd) and top percentiles (1%, 5%, 10%)

- Flexible Configuration: Choose score type (points, time, XP, KDA), sorting direction, and whether scores are incremental

- Platform Integration: Leaderboard widgets appear on game pages and user profiles

## Platform Visibility

The leaderboard system integrates seamlessly into the CrazyGames platform.

Leaderboard DrawerGame Page WidgetUser Profile Awards

## Score Submission Approaches

There are two ways to submit scores to a CrazyGames leaderboard:

- Client-side via the SDK — scores are submitted directly from the game client. No backend required, but scores can be manipulated since the client is not a trusted environment.

- Server-side via the API — scores are submitted from your backend server. Recommended if you have a server, as validation happens server-side and cannot be bypassed by the client.

The configuration below reflects both approaches: the Encryption Key is used for client-side submissions, while the API Key is used for server-side submissions.

Choose the integration guide that matches your setup:

- Client-only games — no backend server, submit scores directly from the game client using the SDK

- Games with a server — submit scores from your backend using the Leaderboard API

## Leaderboard Configuration

These are the settings for the leaderboard in your game.

Warning

At least one between Encryption Key and API Key is required in your configuration. Encryption Key is used for submitting score via the SDK, while API Key is used for submitting scores via the API.

Required parameters:

- Leaderboard Guide: A short text shown to players explaining how to get ranked in the CrazyGames leaderboards. Max length: 50 characters
Indicates which mode, level, or game type the leaderboard refers to

- Explains what players need to do to compete or achieve a higher score

- Examples:
`"Endless Mode - Survive as long as possible"`

- `"Finish the race as fast as possible"`

- Encryption Key (optional): 32-byte base64-encoded string (chosen by game developers)
Used for client-side score encryption

- Same key across all environments

- Can be generated automatically on the Developer portal via a button next to the input field for it

- Example: `"dGhpcyBpcyBhIDMyLWJ5dGUga2V5IGZvciB0ZXN0aW4="`

- API Key (optional): 32-byte base64-encoded string (chosen by game developers)
Required only for server-side score submission via the Leaderboard API

- Can be generated automatically on the Developer portal via a button next to the input field for it

- Example: `"dGhpcyBpcyBhIDMyLWJ5dGUga2V5IGZvciB0ZXN0aW4="`

- Metric Type: Defines what the score represents in the UI
Options: `'XP' | 'KDA' | 'POINTS' | 'MINUTES'`

- Determines leaderboard labeling

- Incremental Scoring: Boolean indicating if scores accumulate over time
`true` - For incremental games where scores continuously grow

- `false` - For games with distinct play sessions

- Score Sorting: How scores are ranked
`"ASC"` - Lower scores are better (i.e. best time)

- `"DESC"` - Higher scores are better (i.e. points)

- Min Allowed Score: Minimum valid score value (float)
Scores below this threshold are rejected

- Example: `0.0` for games where negative scores aren't possible

- Max Allowed Score: Maximum valid score value (float)
Scores above this threshold are rejected

- Example: `999999.0` for reasonable score caps

- Cooldown interval: Minimum amount of seconds between submitting scores for a user (int)
Scores submitted within threshold are rejected

- Only applies to client-side submissions via the SDK — not enforced for backend submissions via the Leaderboard API

- Example: `10` for reasonable score pacing

Example:

```
{
    "encryptionKey": "dGhpcyBpcyBhIDMyLWJ5dGUga2V5IGZvciB0ZXN0aW4=",
    "apiKey": "sGrZXWMMtYZBoGHjD+YKJLg/9tlAso7R5iT3A2MOA24=",
    "scoreLabel": "POINTS",
    "scoreSorting": "DESC",
    "minValue": 0.0,
    "maxValue": 500000.0,
    "cooldownSeconds": 10,
    "isIncremental": false,
}
```

Note: The Leaderboard Guide is configured separately from the JSON above.
