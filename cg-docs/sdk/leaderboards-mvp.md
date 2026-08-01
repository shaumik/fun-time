<!-- https://docs.crazygames.com/sdk/leaderboards-mvp/ -->

# Leaderboards MVP Documentation

Info

In Q4 2025 CrazyGames will launch a Leaderboard system where selected games will have access to SDK functions to post scores which will be shown on the CrazyGames portal in a ‘weekly leaderboard’. This page contains the first iteration of the docs for this.

Disclaimer: as this is an MVP, these can’t be considered final and could change when the feature is opened up for all games.

## Leaderboard MVP: Feature overview

- Games with Leaderboards will get a new widget

- Users can check their score, and their rank globally, within their Country and CrazyGames friends

- Score labels can be selected per game, as whether the score is incremental or not

- Season ends every week on Monday 7AM UTC, and scores are reset

- Trophies are awarded after every season for global places 1, 2 and 3 and for the top 1%, 5% and 10% of players

Leaderboard drawer, gamepage widget and awards:

## Leaderboard Configuration

These are the settings for the leaderboard in your game.

Warning

In the MVP phase these settings have to be manually configured by the CrazyGames admin. Please pass along the settings you want us to configure via your CrazyGames contact.

Required parameters:

- Leaderboard Guide: A short text shown to players explaining how to get ranked in the CrazyGames leaderboards. Max length: 50 characters
Indicates which mode, level, or game type the leaderboard refers to

- Explains what players need to do to compete or achieve a higher score

- Examples:
`"Endless Mode - Survive as long as possible"`

- `"Finish the race as fast as possible"`

- Encryption Key: 32-byte base64-encoded string (chosen by game developers)
Used for client-side score encryption

- Same key across all environments

- Can be generated here

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
Scores submitting within threshold are rejected

- Example: `10` for reasonable score pacing

Example:

```
{
    "encryptionKey": "dGhpcyBpcyBhIDMyLWJ5dGUga2V5IGZvciB0ZXN0aW4=",
    "scoreLabel": "POINTS",
    "scoreSorting": "DESC",
    "minValue": 0.0,
    "maxValue": 500000.0,
    "cooldownSeconds": 10,
    "isIncremental": false
}
```

Note: The Leaderboard Guide is configured separately from the JSON above.

## Score reporting

This section describe how to encrypt and submit scores.

Start by encrypting the score. This is crucial to make it harder for hackers to tamper with your leaderboard.

HTML5Unity

```
export async function encryptScore(score, encryptionKey) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const algorithm = { name: 'AES-GCM', iv: iv };

    const keyBytes = new Uint8Array(
    atob(encryptionKey)
    .split('')
    .map((c) => c.charCodeAt(0)),
    );

    const cryptoKey = await window.crypto.subtle.importKey('raw', keyBytes, algorithm, false, ['encrypt']);

    const dataBuffer = new TextEncoder().encode(score.toString());
    const encryptedBuffer = await window.crypto.subtle.encrypt(algorithm, cryptoKey, dataBuffer);

    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return btoa(String.fromCharCode(...combined));
    }
```

```
using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

public static string EncryptScore(float score, string encryptionKey)
{
    // generate random IV
    byte[] iv = new byte[12];
    using (var rng = System.Security.Cryptography.RandomNumberGenerator.Create())
    {
        rng.GetBytes(iv);
    }

    byte[] key = Convert.FromBase64String(encryptionKey);
    byte[] plaintext = Encoding.UTF8.GetBytes(score.ToString(CultureInfo.InvariantCulture));

    using (var aes = Aes.Create())
    {
        aes.Key = key;
        aes.Mode = CipherMode.ECB;
        aes.Padding = PaddingMode.None;

        using (var encryptor = aes.CreateEncryptor())
        {
            // CTR mode encryption
            byte[] ciphertext = new byte[plaintext.Length];
            byte[] counter = new byte[16];
            Buffer.BlockCopy(iv, 0, counter, 0, 12);
            counter[15] = 1; // Start counter at 1

            for (int i = 0; i = 12; k--)
                {
                    if (++counter[k] != 0)
                        break;
                }
            }

            // combine: IV + ciphertext + Unity marker
            byte[] result = new byte[iv.Length + ciphertext.Length + 1];
            Buffer.BlockCopy(iv, 0, result, 0, iv.Length);
            Buffer.BlockCopy(ciphertext, 0, result, iv.Length, ciphertext.Length);
            result[result.Length - 1] = 0x55; // Unity marker byte

            string base64Result = Convert.ToBase64String(result);
            return base64Result;
        }
    }
}
```

Afterwards, submit the score:

HTML5Unity

```
const encryptionKey = 'your-32-byte-base64-key-here';

// Encrypt the score
const finalScore = 152.1;
const encryptedScore = await encryptScore(finalScore, encryptionKey);

// Submit the score
CrazyGames.SDK.user.submitScore({
encryptedScore: encryptedScore,
});
// No immediate feedback from the API: always returns true to prevent reverse-engineering of anti-cheat validation
```

```
private string encryptionKey = "your-32-byte-base64-key-here";

// Encrypt the score
float finalScore = 152.1f;
string encryptedScore = EncryptScore(finalScore, encryptionKey);

// Submit to leaderboard
CrazySDK.User.SubmitScore(encryptedScore);
// No immediate feedback from the API: always returns true to prevent reverse-engineering of anti-cheat validation
```

## Testing

You can test your leaderboard integration in our preview tool on the Developer Portal.

- Preview your game from our Developer Portal (`/preview` route) and open the Logs tab.

- When your game submits a score, you'll see a `submitScore` message in the logs and in browser console.

- To avoid hacking, the server response is always successful and validation is applied in our back-end.

- Scores submitted through the `/preview` route are not saved in the database so won't be visible on the leaderboard. Our team can confirm whether scores are received correctly from our server logs.

## Out of scope

Some functionality is out of scope for the MVP in order to deliver it quickly - we’ve already identified possible add-ons towards a global release and future ideas. The below extensions are subject to change:

- Leaderboard configuration via Developer Portal

- Score moderation via Developer Portal

- Score reporting via the back-end API

- More trophies/awards

- Multiple leaderboards per game (e.g. 1 per map)

- Notifications to users if they are losing ranks

- Notifications to users at end of season

- Dynamic season length / option to not reset

- More advanced ‘league’ system where users can promote, to improve the experience for ‘casual’ players

- Aggregate leaderboards across games to a ‘CrazyGames leaderboard’

If you have other requirements/ideas, please reach out.
