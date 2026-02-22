# CSRF Protection Implementation

## Overview

All state-changing API endpoints (POST, PATCH, PUT, DELETE) are protected against Cross-Site Request Forgery (CSRF) attacks.

## How It Works

1. **Session Cookie Security**
   - `sameSite: 'lax'` - Prevents cookie from being sent in cross-site requests
   - `httpOnly: true` - Prevents JavaScript access to the cookie
   - `secure: true` - Only sent over HTTPS in production

2. **CSRF Tokens**
   - Required for all POST/PATCH/PUT/DELETE requests
   - Time-limited (1 hour expiration)
   - User-specific (bound to session)
   - HMAC-signed to prevent tampering

## Frontend Integration

### 1. Fetch CSRF Token

Before making any state-changing request, get a CSRF token:

```typescript
const response = await fetch('/api/auth/csrf');
const { token } = await response.json();
```

### 2. Include Token in Requests

Add the token to the `x-csrf-token` header:

```typescript
await fetch('/api/user/credentials', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': token,
  },
  body: JSON.stringify(data),
});
```

### 3. Example: React Hook

```typescript
import { useState, useEffect } from 'react';

export function useCsrfToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/csrf')
      .then(res => res.json())
      .then(data => {
        setToken(data.token);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch CSRF token:', err);
        setLoading(false);
      });
  }, []);

  return { token, loading };
}

// Usage
function MyComponent() {
  const { token, loading } = useCsrfToken();

  const handleSubmit = async (data) => {
    if (!token) return;

    await fetch('/api/user/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
      },
      body: JSON.stringify(data),
    });
  };
}
```

### 4. Token Refresh

Tokens expire after 1 hour. If you get a 403 error with code `CSRF_TOKEN_INVALID`, fetch a new token:

```typescript
async function apiRequest(url, options) {
  let token = getStoredToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'x-csrf-token': token,
    },
  });

  if (response.status === 403) {
    const error = await response.json();
    if (error.code === 'CSRF_TOKEN_INVALID') {
      // Refresh token and retry
      const csrfResponse = await fetch('/api/auth/csrf');
      const { token: newToken } = await csrfResponse.json();
      storeToken(newToken);

      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'x-csrf-token': newToken,
        },
      });
    }
  }

  return response;
}
```

## Protected Endpoints

The following routes require CSRF tokens:

### User Credentials
- `POST /api/user/credentials` - Add API key
- `DELETE /api/user/credentials` - Remove API key

### Trades
- `POST /api/user/trades` - Create trade
- `PATCH /api/user/trades` - Update trade
- `DELETE /api/user/trades` - Delete trade

### Accounts
- `POST /api/user/accounts` - Create account
- `PATCH /api/user/accounts` - Update account
- `DELETE /api/user/accounts` - Delete account

### Billing & Payments
- `POST /api/billing/setup-intent` - Create payment setup intent
- `POST /api/billing/payment-method` - Save payment method
- `DELETE /api/billing/payment-method` - Remove payment method

## Error Responses

### Missing Token
```json
{
  "error": "CSRF token required",
  "code": "CSRF_TOKEN_MISSING"
}
```
**HTTP Status:** 403

### Invalid Token
```json
{
  "error": "Invalid CSRF token",
  "code": "CSRF_TOKEN_INVALID"
}
```
**HTTP Status:** 403

Reasons for invalid token:
- Token expired (>1 hour old)
- Token signature invalid (tampered)
- Token from different user session

## Security Notes

1. **Never disable CSRF protection** - It prevents attackers from tricking users into performing unwanted actions

2. **Don't cache tokens** across sessions - Always fetch a fresh token after login

3. **Keep tokens client-side only** - Don't log or expose tokens in URLs

4. **Use HTTPS in production** - Ensures cookies and tokens can't be intercepted

## Testing

To test CSRF protection:

```bash
# This should fail (no token)
curl -X POST http://localhost:3000/api/user/credentials \
  -H "Content-Type: application/json" \
  -d '{"platform":"tradier","api_key":"test"}' \
  --cookie "meridian_session=..."

# This should succeed
TOKEN=$(curl http://localhost:3000/api/auth/csrf --cookie "meridian_session=..." | jq -r '.token')
curl -X POST http://localhost:3000/api/user/credentials \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOKEN" \
  -d '{"platform":"tradier","api_key":"test"}' \
  --cookie "meridian_session=..."
```

## Implementation Details

- **Token Generation:** HMAC-SHA256 signed payload with user ID, timestamp, and random nonce
- **Token Format:** Base64URL-encoded to prevent character encoding issues
- **Validation:** Constant-time comparison to prevent timing attacks
- **Storage:** No server-side storage required (stateless)
