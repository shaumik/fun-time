<!-- https://docs.crazygames.com/sdk/leaderboard-api/ -->

# Leaderboards API

## Overview

The Leaderboard API allows game developers to submit player scores directly from their backend servers to CrazyGames leaderboards. This is designed for games that need to validate scores server-side before submitting them.

Key features:

- Authentication using API keys

- Batch score submissions (up to 100 scores per request)

- Higher rate limits compared to client-side submissions

- Partial success support (individual score failures don't block the entire batch)

- Detailed error responses with only failed scores returned, including the original score data

## Endpoint

```
POST https://leaderboard.crazygames.com/leaderboard/scores
```

## Authentication

Authentication is performed via an API key sent in the request header.

### Header

| Header | Required | Value |

| `X-API-Key` | Yes | The game's API key |

| `Content-Type` | Yes | `application/json` |

API Key Security

The API key is unique to the game and can be found in the Developer Portal under the Leaderboard tab of your game (only visible for games with leaderboards enabled). Keep this key secret.

### Authentication Errors

| Status Code | Response | Description |

| `401 Unauthorized` | `{"error": "Unauthorized"}` | Missing, invalid format, or unrecognized API key |

## Rate Limiting

The endpoint implements rate limiting to prevent abuse:

- Limit: 1000 requests per 60 seconds per API key

- Response: `429 Too Many Requests` when limit is exceeded

## Request Format

### Body Structure

The request body must be a JSON object containing a `scores` array. Maximum batch size is 100 scores per request.

```
{
  "scores": [
    {
      "userId": "string",
      "score": number,
      "timestamp": "ISO 8601 string (e.g., 2026-04-07T12:39:32.989Z)"
    }
  ]
}
```

### Score Object Fields

| Field | Type | Required | Description |

| `userId` | string | Yes | Unique identifier for the user (obtained by verifying and decoding the user token on your backend) |

| `score` | number | Yes | The score value (must be a finite number) |

| `timestamp` | string | Yes | ISO 8601 timestamp of when the score was achieved. Must include date, time, and timezone (e.g., `2026-04-07T12:39:32.989Z`). Cannot be in the future. |

## Response Format

### Response Status Codes

| Status | Condition |

| `200 OK` | Scores were processed (check `errors` for individual failures) |

| `400 Bad Request` | Request payload is invalid, or score format/timestamp validation failed |

```
{
  "success": boolean,
  "total": number,
  "successCount": number,
  "failureCount": number,
  "errors": [
    {
      "score": object,
      "type": "string"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |

| `success` | boolean | `true` if all scores succeeded, `false` if any failures occurred |

| `total` | number | Total number of scores processed |

| `successCount` | number | Number of successfully submitted scores |

| `failureCount` | number | Number of failed score submissions |

| `errors` | array | Array containing only the failed scores with their error details |

### Error Object

| Field | Type | Description |

| `score` | object | The original score object that was submitted, exactly as received |

| `type` | string | The error type (see Error Types below) |

### Error Types

| Type | Description |

| `no-active-season` | No active leaderboard season for this game |

| `user-not-found` | User ID does not exist in the system |

| `privacy-disabled` | User has disabled leaderboards in their privacy settings |

| `validation` | Score validation failed (score out of range, invalid timestamp, or invalid format) |

| `internal-server-error` | Database or unknown internal error occurred |

### Error Responses

| Status Code | Response Body | Description |

| `400 Bad Request` | `{"error": "Request body must contain a scores array"}` | Missing scores field |

| `400 Bad Request` | `{"error": "Scores must be an array"}` | Scores field is not an array |

| `400 Bad Request` | `{"error": "Scores must be a non-empty array"}` | Empty scores array |

| `400 Bad Request` | `{"error": "Batch size must not exceed 100 scores"}` | Batch size exceeds maximum limit of 100 |

| `400 Bad Request` | Standard response with `errors` array | Some scores failed format/timestamp validation (entire batch rejected) |

| `401 Unauthorized` | `{"error": "Unauthorized"}` | Missing or invalid API key |

| `429 Too Many Requests` | `{"error": "Too Many Requests"}` | Rate limit exceeded. The `Retry-After` response header contains the number of seconds to wait before retrying |

| `500 Internal Server Error` | `{"error": "Internal Server Error"}` | Unexpected server error |

## Example Requests

### Batch Score Submission

cURLJavaScript

```
curl -X POST https://leaderboard.crazygames.com/leaderboard/scores \
  -H "X-API-Key: api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "scores": [
      {
        "userId": "user123",
        "score": 1500,
        "timestamp": "2026-03-25T10:30:00.000Z"
      },
      {
        "userId": "user456",
        "score": 2000,
        "timestamp": "2026-03-25T10:31:00.000Z"
      },
      {
        "userId": "user789",
        "score": 1750,
        "timestamp": "2026-03-25T10:32:00.000Z"
      }
    ]
  }'
```

```
const axios = require('axios');

const response = await axios.post(
  'https://leaderboard.crazygames.com/leaderboard/scores',
  {
    scores: [
      { userId: 'user123', score: 1500, timestamp: '2026-03-25T10:30:00.000Z' },
      { userId: 'user456', score: 2000, timestamp: '2026-03-25T10:31:00.000Z' },
      { userId: 'user789', score: 1750, timestamp: '2026-03-25T10:32:00.000Z' },
    ]
  },
  {
    headers: {
      'X-API-Key': 'api-key-here',
      'Content-Type': 'application/json'
    }
  }
);
```

### Success Response Example (200 OK)

When all scores succeed:

```
{
  "success": true,
  "total": 3,
  "successCount": 3,
  "failureCount": 0,
  "errors": []
}
```

### Partial Success Response Example (200 OK)

When some scores fail to be processed (e.g. `user-not-found`) but others succeed:

```
{
  "success": false,
  "total": 3,
  "successCount": 2,
  "failureCount": 1,
  "errors": [
    {
      "score": {
        "userId": "user456",
        "score": 2000,
        "timestamp": "2026-03-25T10:31:00.000Z"
      },
      "type": "user-not-found"
    }
  ]
}
```

Validation errors abort the entire batch

If any score in the batch fails format or timestamp validation (invalid field types, missing fields, future timestamp), the entire batch is rejected, no scores are processed and `successCount` will be `0`.

In this case `failureCount` reflects the total number of scores submitted (the entire batch), while `errors` contains only the scores that failed validation (not the valid scores that were collaterally rejected). Fix the validation errors in `errors`, then re-submit the entire original batch.

Non-validation errors (`user-not-found`, `privacy-disabled`, `no-active-season`) are per-score and allow partial success.

### All Failures Response Example (200 OK)

When all scores fail due to per-score errors:

```
{
  "success": false,
  "total": 3,
  "successCount": 0,
  "failureCount": 3,
  "errors": [
    {
      "score": {
        "userId": "user123",
        "score": 1500,
        "timestamp": "2026-03-25T10:30:00.000Z"
      },
      "type": "no-active-season"
    },
    {
      "score": {
        "userId": "user456",
        "score": 2000,
        "timestamp": "2026-03-25T10:31:00.000Z"
      },
      "type": "user-not-found"
    },
    {
      "score": {
        "userId": "user789",
        "score": 1750,
        "timestamp": "2026-03-25T10:32:00.000Z"
      },
      "type": "privacy-disabled"
    }
  ]
}
```

## Best Practices

### 1. Batch Multiple Scores

For better performance, submit multiple scores in a single request when possible. Note that the maximum batch size is 100 scores per request.

```
const scores = [
  { userId: 'user123', score: 1500, timestamp: '2026-03-25T10:30:00.000Z' },
  { userId: 'user456', score: 2000, timestamp: '2026-03-25T10:31:00.000Z' },
  // ...
];

// If you have more than 100 scores, split them into chunks
const BATCH_SIZE = 100;
for (let i = 0; i Always check the `errors` array in the response:

```
const response = await submitScores({ scores });

if (!response.success || response.errors.length > 0) {
  // some scores failed
  response.errors.forEach(error => {
    console.error(`Score submission failed:`, {
      userId: error.score.userId,
      score: error.score.score,
      errorType: error.type
    });
  });
}
```

### 3. Respect Rate Limits

Implement exponential backoff when receiving 429 responses:

```
async function submitWithRetry(scores, maxRetries = 3) {
  for (let attempt = 0; attempt  setTimeout(resolve, retryAfter * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

### 4. Validate Scores Before Submission

Ensure scores meet the game's leaderboard configuration (min/max values) before submitting:

```
function isValidScore(score, minScore, maxScore) {
  return Number.isFinite(score) && score >= minScore && score
  isValidScore(s.score, 0, 999999)
);
```

### 5. Use Accurate Timestamps

Always use the actual timestamp when the score was achieved and not when you're submitting it, as we use it to sort rankings:

```
// when score is achieved
const scoreData = {
  userId: user.id,
  score: finalScore,
  timestamp: new Date().toISOString()
};

// later, when submitting (timestamp remains unchanged)
await submitScores({ scores: [scoreData] });
```

## Complete Implementation Example

Here's a complete implementation example with error handling and best practices:

```
const axios = require('axios');

class CrazyGamesScoreAPI {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseURL = options.baseURL || 'https://userportal.crazygames.com';
    this.maxRetries = options.maxRetries || 3;
    this.maxBatchSize = 100; // Maximum batch size enforced by the API
  }

  async submitScores(scores) {
    try {
      const response = await axios.post(
        `${this.baseURL}/leaderboard/scores`,
        { scores },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        if (error.response.status === 400 && error.response.data?.errors) {
          return error.response.data;
        }
        switch (error.response.status) {
          case 401:
            throw new Error('Invalid API key');
          case 429: {
            const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
            const rateLimitError = new Error('Rate limit exceeded');
            rateLimitError.retryAfter = retryAfter;
            throw rateLimitError;
          }
          case 400:
            throw new Error(`Bad request: ${error.response.data.error}`);
          default:
            throw new Error(`API error: ${error.response.status}`);
        }
      }
      throw error;
    }
  }

  async submitScoresWithRetry(scores) {
    for (let attempt = 0; attempt  setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  async submitSingleScore(userId, score, timestamp = new Date().toISOString()) {
    return this.submitScores([{
      userId,
      score,
      timestamp
    }]);
  }

  async submitLargeBatch(scores) {
    const results = [];

    // Split into chunks of maxBatchSize
    for (let i = 0; i  r.success),
      total: results.reduce((sum, r) => sum + r.total, 0),
      successCount: results.reduce((sum, r) => sum + r.successCount, 0),
      failureCount: results.reduce((sum, r) => sum + r.failureCount, 0),
      errors: results.flatMap(r => r.errors)
    };
  }

  validateScore(score, minScore, maxScore) {
    return Number.isFinite(score) && score >= minScore && score  {
      console.error(`Failed: ${error.score.userId} - ${error.type}`);
    });
  }
} catch (error) {
  console.error('Failed to submit batch:', error.message);
}

// submit large batch (automatically splits into chunks of 100)
try {
  const largeScoreArray = [
    { userId: 'user1', score: 1500, timestamp: '2026-03-25T10:30:00.000Z' },
    { userId: 'user2', score: 2000, timestamp: '2026-03-25T10:31:00.000Z' },
    // ... 250 scores total
  ];

  const result = await api.submitLargeBatch(largeScoreArray);
  console.log(`Submitted ${result.total} scores: ${result.successCount} succeeded, ${result.failureCount} failed`);
} catch (error) {
  console.error('Failed to submit large batch:', error.message);
}
```

## Troubleshooting

### Getting 401 Unauthorized

Possible causes:

- Missing `X-API-Key` header

- Invalid API key format

- API key not associated with any game

Solution: Verify the API key is correct and properly set in the request header.

### Scores failing with validation errors

Possible causes:

- Scores have invalid field types or values

- Missing required fields (userId, score, timestamp)

- Invalid timestamp format

Solution: Check the `errors` array in the response to see exactly which scores failed and why. Each error object contains the original score data and the error type to help you identify and fix the issues.

### Scores failing with "user-not-found" error

Possible cause: The `userId` provided does not exist in the CrazyGames system

Solution: Ensure you're using the correct user ID obtained from the user token.

### Scores showing as failed with "validation" error

Possible causes:

- Score values exceed the minimum or maximum values configured for the leaderboard

- Invalid timestamp format

Solution: Check the leaderboard configuration in the developer portal and ensure scores fall within the allowed range. Verify that timestamps are valid.

### Getting 429 Too Many Requests

Possible cause: Exceeding rate limit of 1000 requests per 60 seconds

Solution: Implement batching to reduce request frequency and add retry logic with exponential backoff.

### Scores not appearing on leaderboard

Possible causes:

- No active season configured for the game (`no-active-season` error)

- User ID does not exist (`user-not-found` error)

- User has disabled leaderboards in their settings (`privacy-disabled` error)

- Score failed validation (`validation` error)

- Internal server error occurred (`internal-server-error`)

Solution: Check the response `errors` array for specific error details for each failed score submission.

### Getting 400 Bad Request - "Batch size must not exceed 100 scores"

Possible cause: Attempting to submit more than 100 scores in a single request

Solution: Split the scores into batches of 100 or fewer. Use the `submitLargeBatch` method from the implementation example above to automatically handle large batches by splitting them into chunks.
