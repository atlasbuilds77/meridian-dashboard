#!/bin/bash
# =============================================================================
# Meridian Dashboard — Adversarial E2E Tests (expect-cli)
# =============================================================================
# Runs the app in TEST_MODE and throws expect-cli at it to break things.
#
# Usage:
#   npm run test:e2e
#   # or directly:
#   ./test/expect-tests.sh
#
# Prerequisites:
#   - expect-cli installed globally (npm i -g expect-cli)
#   - DATABASE_URL set (local or remote)
#   - Run `npx tsx scripts/create-test-session.ts` once to get test creds
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PORT="${TEST_PORT:-3001}"
BASE_URL="http://localhost:$PORT"

# Load test env if present
if [ -f .env.test ]; then
  echo "[test] Loading .env.test"
  set -a
  source .env.test
  set +a
fi

# Validate required env
if [ -z "${TEST_SESSION_SECRET:-}" ]; then
  echo "ERROR: TEST_SESSION_SECRET not set."
  echo "Run: npx tsx scripts/create-test-session.ts"
  exit 1
fi
if [ -z "${TEST_USER_DB_ID:-}" ]; then
  echo "ERROR: TEST_USER_DB_ID not set."
  echo "Run: npx tsx scripts/create-test-session.ts"
  exit 1
fi

# ---------------------------------------------------------------------------
# Start app in test mode
# ---------------------------------------------------------------------------
echo "[test] Starting Meridian in TEST_MODE on port $PORT..."
TEST_MODE=true \
TEST_SESSION_SECRET="$TEST_SESSION_SECRET" \
TEST_USER_DB_ID="$TEST_USER_DB_ID" \
npm run dev -- -p "$PORT" &
APP_PID=$!

# Ensure cleanup on exit
cleanup() {
  echo ""
  echo "[test] Shutting down app (PID $APP_PID)..."
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  echo "[test] Done."
}
trap cleanup EXIT INT TERM

# Wait for app to be ready
echo "[test] Waiting for app to start..."
for i in $(seq 1 30); do
  if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo "[test] App is up! ($i seconds)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: App failed to start within 30 seconds"
    exit 1
  fi
  sleep 1
done

# ---------------------------------------------------------------------------
# Test results tracking
# ---------------------------------------------------------------------------
PASS=0
FAIL=0
TESTS_RUN=0

run_test() {
  local name="$1"
  local instruction="$2"
  
  TESTS_RUN=$((TESTS_RUN + 1))
  echo ""
  echo "================================================================"
  echo "[TEST $TESTS_RUN] $name"
  echo "================================================================"
  
  if EXPECT_BASE_URL="$BASE_URL" expect-cli -m "$instruction" -y; then
    echo "[PASS] $name"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $name"
    FAIL=$((FAIL + 1))
  fi
}

# ---------------------------------------------------------------------------
# TEST 1: Auth Protection (no session — should block access)
# ---------------------------------------------------------------------------
run_test "Auth Protection - Unauthenticated Access" \
  "You are testing auth protection with NO cookies set. Do the following:
1. Navigate to $BASE_URL/settings — since there is no session, verify the page either redirects to /login, shows an 'unauthorized' error, or renders with no user data (empty state). Check the network tab or page content for 401 responses.
2. Navigate to $BASE_URL/trades — same check: should not show any real user data without auth.
3. Navigate to $BASE_URL/analytics — same check.
4. Navigate to $BASE_URL/billing — same check.
5. Try to hit the API directly: fetch $BASE_URL/api/auth/session and confirm it returns {\"authenticated\":false} with status 401.
6. Try to hit $BASE_URL/api/user/settings — should return 401 Unauthorized.
7. Check for any console errors or leaked data on each page.
Report what each page does for unauthenticated users."

# ---------------------------------------------------------------------------
# TEST 2: Login Page Resilience
# ---------------------------------------------------------------------------
run_test "Login Page - Adversarial" \
  "Navigate to $BASE_URL/login. Try to break the login page:
1. Verify the Discord login button renders and is clickable.
2. Click the login button — it should redirect to Discord OAuth or /api/auth/discord/login. Don't follow the external redirect, just verify the redirect happens.
3. Navigate to $BASE_URL/login?error=not_in_server — verify the error message renders correctly.
4. Navigate to $BASE_URL/login?error=no_singularity_role — verify error message.
5. Navigate to $BASE_URL/login?error=auth_failed — verify error message.
6. Navigate to $BASE_URL/login?error=expired — verify error message.
7. Navigate to $BASE_URL/login?error=invalid_state — verify error message.
8. Try a bogus error param: $BASE_URL/login?error=<script>alert(1)</script> — should NOT execute JS, should show no error or a safe fallback.
9. Try $BASE_URL/login?error=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa (100+ chars) — should not break layout.
10. Rapidly refresh the page 5 times. Check for console errors.
Report all findings."

# ---------------------------------------------------------------------------
# TEST 3: Authenticated Dashboard (with test cookie)
# ---------------------------------------------------------------------------
run_test "Dashboard - Authenticated Navigation" \
  "IMPORTANT: Before doing anything, inject a cookie named TEST_SESSION_TOKEN with value '$TEST_SESSION_SECRET' for domain localhost on path /. 

Now test the authenticated dashboard:
1. Navigate to $BASE_URL/ — the main dashboard should load. Verify it shows some dashboard content (cards, stats, etc), not a login redirect.
2. Check that the navigation bar has links: Dashboard, Trades, Predictions, Billing, Analytics, Settings.
3. Click each nav link and verify the page loads without errors:
   - Click 'Trades' → should load /trades
   - Click 'Analytics' → should load /analytics  
   - Click 'Billing' → should load /billing
   - Click 'Settings' → should load /settings
   - Click 'Dashboard' → should return to /
4. Try browser back button after navigating through several pages — should work smoothly.
5. Try browser forward button — should work.
6. Check for console errors on every page.
7. Rapidly click between Dashboard and Trades 5 times — should not crash or show stale data.
Report findings for each page."

# ---------------------------------------------------------------------------
# TEST 4: Direct URL Access (Deep Linking)
# ---------------------------------------------------------------------------
run_test "Deep Link / Direct URL Access" \
  "Inject cookie TEST_SESSION_TOKEN='$TEST_SESSION_SECRET' for localhost path /.

Test direct URL access to every route:
1. Navigate directly to $BASE_URL/trades — should load trade history page.
2. Navigate directly to $BASE_URL/analytics — should load analytics.
3. Navigate directly to $BASE_URL/billing — should load billing page.
4. Navigate directly to $BASE_URL/settings — should load settings page.
5. Navigate directly to $BASE_URL/prediction-markets — should load predictions.
6. Navigate to $BASE_URL/nonexistent-page — should show a 404 or redirect gracefully.
7. Navigate to $BASE_URL/admin — should either show admin page or block non-admin access.
8. Navigate to $BASE_URL/api/auth/session — should return JSON with authenticated:true.
9. Try $BASE_URL/settings?random_param=test — should still load settings normally.
10. Try $BASE_URL/trades#fragment — should load normally.
Check for console errors on each. Report status of every route."

# ---------------------------------------------------------------------------
# TEST 5: Settings Page Stress Test
# ---------------------------------------------------------------------------
run_test "Settings Page - Adversarial Stress" \
  "Inject cookie TEST_SESSION_TOKEN='$TEST_SESSION_SECRET' for localhost path /.

Go to $BASE_URL/settings and try to break it:
1. Verify the settings page loads with API credential management UI.
2. Look for any input fields. If there are API key inputs, try:
   a. Submit empty fields — should show validation error.
   b. Enter extremely long strings (1000+ chars) — should not break layout.
   c. Enter special characters: <script>alert(1)</script> — should be escaped.
   d. Enter SQL injection: ' OR 1=1 -- — should be handled safely.
3. If there's a SnapTrade connect button, click it. Verify it either:
   - Generates a redirect URL to SnapTrade
   - Shows a connection flow modal
   - Shows an error if SnapTrade isn't configured
4. If there's a connect button, click it 5 times rapidly — should not create duplicate requests or crash.
5. Look for the Risk Settings section — if present, try adjusting sliders/inputs to extreme values.
6. Check for any payment method section — verify it loads or shows appropriate state.
7. Refresh the page mid-interaction — should reload cleanly.
8. Check console for errors throughout.
Report all findings."

# ---------------------------------------------------------------------------
# TEST 6: API Endpoint Abuse
# ---------------------------------------------------------------------------
run_test "API Endpoints - Abuse & Edge Cases" \
  "Inject cookie TEST_SESSION_TOKEN='$TEST_SESSION_SECRET' for localhost path /.

Test API endpoints directly by navigating to them or using fetch from the console:
1. Navigate to $BASE_URL/api/auth/session — should return JSON with user data.
2. Navigate to $BASE_URL/api/trades — check if it returns trade data or 404.
3. Navigate to $BASE_URL/api/status — check response.
4. Navigate to $BASE_URL/api/auth/logout — should redirect to login (GET request to logout).
5. Navigate to $BASE_URL/api/nonexistent — should return 404.
6. Try to access $BASE_URL/api/admin/users — should return 403 Forbidden (not admin).
7. Check if any API endpoint leaks stack traces or internal paths in error responses.
8. Rapidly refresh $BASE_URL/api/auth/session 10 times — check for rate limit responses (429).
Report all findings including status codes and response shapes."

# ---------------------------------------------------------------------------
# TEST 7: Mobile Nav & Responsive Stress
# ---------------------------------------------------------------------------
run_test "Mobile Navigation - Responsive Adversarial" \
  "Inject cookie TEST_SESSION_TOKEN='$TEST_SESSION_SECRET' for localhost path /.

Test mobile/responsive behavior:
1. Navigate to $BASE_URL/ 
2. Resize the viewport to mobile width (375px). Check if mobile nav appears at the bottom.
3. If there's a mobile hamburger menu or bottom nav, tap each link and verify navigation works.
4. Resize rapidly between mobile and desktop widths 5 times — should not break layout.
5. On mobile width, try scrolling the page — content should be properly contained.
6. Check for any overlapping elements or text overflow on mobile.
7. Switch to $BASE_URL/trades on mobile — verify table/list adapts or scrolls properly.
Report responsive issues found."

# ---------------------------------------------------------------------------
# Results Summary
# ---------------------------------------------------------------------------
echo ""
echo "================================================================"
echo "                    E2E TEST RESULTS"
echo "================================================================"
echo "  Total:  $TESTS_RUN"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "================================================================"

if [ "$FAIL" -gt 0 ]; then
  echo "  STATUS: ❌ SOME TESTS FAILED"
  exit 1
else
  echo "  STATUS: ✅ ALL TESTS PASSED"
  exit 0
fi
