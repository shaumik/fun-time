<!-- https://docs.crazygames.com/sdk/leaderboards-client/ -->

# Leaderboards SDK

## Score Reporting

Start by encrypting the score. This is crucial to make it harder for hackers to tamper with your leaderboard.

HTML5UnityConstructCocos

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

Afterwards, submit the score. You need to pass both the encrypted and the plain score:

HTML5UnityConstructCocos

```
const encryptionKey = 'your-32-byte-base64-key-here';

// Encrypt the score
const finalScore = 152.1;
const encryptedScore = await encryptScore(finalScore, encryptionKey);

// Submit the score
CrazyGames.SDK.user.submitScore({
    encryptedScore: encryptedScore,
    score: finalScore,
});
```

```
private string encryptionKey = "your-32-byte-base64-key-here";

// Encrypt the score
float finalScore = 152.1f;
string encryptedScore = EncryptScore(finalScore, encryptionKey);

// Submit to leaderboard
CrazySDK.User.SubmitScore(encryptedScore, finalScore);
```

```
const encryptionKey = 'your-32-byte-base64-key-here';

// Encrypt the score
const finalScore = 152.1;
const encryptedScore = await encryptScore(finalScore, encryptionKey);

// Submit the score
window.ConstructCrazySDK.user.submitScore({
    encryptedScore: encryptedScore,
    score: finalScore,
});
```

```
const encryptionKey = 'your-32-byte-base64-key-here';

// Encrypt the score
const finalScore = 152.1;
const encryptedScore = await encryptScore(finalScore, encryptionKey);

// Submit the score
CrazySDK.user.submitScore({
    encryptedScore: encryptedScore,
    score: finalScore,
});
```

## Testing

You can test your leaderboard integration in our preview tool on the Developer Portal.

- When your game submits a score, you'll see a `submitScore` message in the logs and in browser console.

- To avoid hacking, the server response is always successful and validation is applied in our back-end.
