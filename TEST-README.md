# Meridian Dashboard — E2E Testing

## Overview

Adversarial end-to-end tests using [expect-cli](https://www.npmjs.com/package/expect-cli). These tests don't just confirm things render — they actively try to **break** the app: XSS payloads, rapid clicks, empty submits, deep links, API abuse, responsive stress, and more.

## Prerequisites

```bash
# Install expect-cli globally
npm install -g expect-cli

# Verify
expect-cli --version
```

## Setup (one-time)

### 1. Create a test user & session secret

```bash
# Needs DATABASE_URL in environment or .env.local
npm run test:create-session
```

This outputs three env vars:
- `TEST_MODE=true`
- `TEST_SESSION_SECRET=<random>`
- `TEST_USER_DB_ID=<id>`

### 2. Save to `.env.test`

```bash
cp .env.test.example .env.test
# Paste the values from step 1
# Also add your DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY
```

## Running Tests

```bash
npm run test:e2e
```

This will:
1. Start the app in `TEST_MODE` on port 3001
2. Run 7 adversarial test suites via expect-cli
3. Print pass/fail results
4. Exit with code 1 if any test fails

## What Gets Tested

| Test | What it breaks |
|------|---------------|
| **Auth Protection** | Unauthenticated access to all routes + API endpoints |
| **Login Page** | XSS in error params, oversized params, rapid refresh |
| **Dashboard Navigation** | All nav links, back/forward, rapid clicking |
| **Deep Linking** | Direct URL to every route, 404 handling, query params |
| **Settings Stress** | Empty submits, XSS in inputs, SQL injection, rapid clicks |
| **API Abuse** | Direct API access, rate limits, error response leaks |
| **Mobile/Responsive** | Viewport resize stress, mobile nav, layout overflow |

## How Auth Bypass Works

In `TEST_MODE=true`, the session layer checks for a `TEST_SESSION_TOKEN` cookie. If the cookie value matches `TEST_SESSION_SECRET`, a synthetic test session is created without needing Discord OAuth.

**Safety:** The bypass only activates when:
- `process.env.TEST_MODE === 'true'` (never set in production)
- The cookie value matches the secret (not guessable)
- `TEST_USER_DB_ID` maps to a real user row created by the setup script

## Adding New Tests

Edit `test/expect-tests.sh` and add a new `run_test` call:

```bash
run_test "My New Test" \
  "Inject cookie TEST_SESSION_TOKEN='$TEST_SESSION_SECRET' for localhost path /.

Navigate to $BASE_URL/my-page and try to break it:
1. Do something adversarial...
2. Check for console errors.
Report findings."
```

**Tips for good adversarial instructions:**
- Empty inputs, max-length inputs, special chars
- Rapid clicks / double-submits
- XSS payloads: `<script>alert(1)</script>`, `javascript:void(0)`
- SQL injection: `' OR 1=1 --`
- Navigate away mid-action, then come back
- Check console errors on every page

## Troubleshooting

**App won't start:** Check that `DATABASE_URL`, `SESSION_SECRET`, and `ENCRYPTION_KEY` are in `.env.test`.

**Tests time out:** The script waits up to 30s for the app. If your DB is slow, increase the wait loop in `test/expect-tests.sh`.

**Auth bypass doesn't work:** Verify `TEST_SESSION_SECRET` in `.env.test` matches what the test script injects. Re-run `npm run test:create-session` if needed.

**expect-cli not found:** `npm install -g expect-cli`
