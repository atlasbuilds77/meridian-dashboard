# Meridian Admin Audit Report

Date: 2026-02-26

Scope reviewed:
- `app/api/admin/**`
- `app/admin/**`
- `lib/db/**` (queries + relevant schema/migrations)

## Executive summary
Admin functionality is small and generally well-structured: API routes use parameterized SQL, admin authorization is enforced server-side via `requireAdminSession()`, and the one state-changing operation (`PATCH /api/admin/users`) correctly persists changes in a transaction (updates `api_credentials` and upserts `user_trading_settings`).

Main issues found are around **CSRF enforcement for API routes**, **admin UI route gating**, and a few **operational/UX pitfalls** (rate limiting + chatty inputs).

## Findings

### 1) CSRF protection is implemented but **not enforced** for admin API routes (PATCH)
**Where:**
- `lib/security/csrf.ts` implements `requireCsrfToken()` / `validateCsrfFromRequest()`.
- `middleware.ts` explicitly bypasses all `/api` routes:
  ```ts
  if (pathname.startsWith('/api')) {
    return withHeaders(NextResponse.next());
  }
  ```
- `app/api/admin/users/route.ts` (PATCH) does **not** call `validateCsrfFromRequest()`.

**Impact:**
- Today this is partially mitigated because the session cookie is `sameSite: 'lax'` (see `app/api/auth/discord/callback/route.ts`), which blocks many cross-site state-changing requests.
- However, the codebase clearly intends CSRF to be a first-class control; not enforcing it in API handlers is a gap and can become exploitable if cookie settings ever change (or if future routes accept other auth mechanisms).

**Fix needed:**
- In every state-changing API route (POST/PATCH/PUT/DELETE), call `validateCsrfFromRequest(req)` early.
- Specifically add it to `PATCH` in `app/api/admin/users/route.ts`.

---

### 2) `/admin` pages require login but do **not** hard-block non-admin users at the routing layer
**Where:**
- `middleware.ts` checks only for a valid session JWT for non-public, non-API routes.
- `app/admin/page.tsx` and `app/admin/users/[userId]/page.tsx` are client components; they rely on API responses to show “Access denied. Admin only.” after fetching.

**Impact:**
- Any authenticated user can load the admin UI shell and make admin API calls that will be rejected with 403.
- This is mostly a **defense-in-depth** issue, but it’s better security posture (and cleaner UX) to prevent access to `/admin` routes entirely for non-admins.

**Fix options:**
1. **Middleware gating for `/admin` paths**: After verifying the JWT, read its payload (contains `discordId`) and check against `isAdminDiscordId()`. Redirect non-admins.
2. Convert admin pages to **server components** (or add a server layout) that calls `requireAdminSession()` and redirects before any client rendering.

---

### 3) `GET /api/admin/users` has no rate limiting (can be heavy)
**Where:** `app/api/admin/users/route.ts` (GET)

**Impact:**
- The query is moderately expensive (CTE + aggregation across trades). A compromised admin session or aggressive polling could create load.

**Fix needed:**
- Add `enforceRateLimit()` for GET as well (separate limiter name, e.g. `admin_users_get`).

---

### 4) Admin dashboard “Size %” input is chatty and can trip rate limiting / poor UX
**Where:** `app/admin/page.tsx`
- `onChange` calls `updateSizePct(...)` which PATCHes immediately.

**Impact:**
- Every keystroke triggers a PATCH and then a full refetch of all users.
- With the current rate limit (`60/min`) this is easy to hit when editing several users.

**Fix needed:**
- Update on `onBlur` or add a debounce (e.g. 300–500ms).
- Consider optimistic UI update instead of refetching all users after every change.

---

### 5) Admin PATCH updates trading settings but does not write audit fields (`enabled_at`, `enabled_by`)
**Where:**
- `lib/db/schema-user-settings.sql` includes `enabled_at` and `enabled_by`.
- `app/api/admin/users/route.ts` upserts `user_trading_settings` but only sets `trading_enabled` and/or `size_pct`.

**Impact:**
- You lose provenance: who enabled trading and when.

**Fix needed:**
- When `trading_enabled` transitions to `true`, set `enabled_at = NOW()` and `enabled_by = <admin discordId>`.
- Optionally clear these when disabling.

---

## SQL injection / query safety review
- All DB queries inspected in the audited surface use **parameterized queries** (`$1`, `$2`, etc.).
- The only dynamic SQL composition in the admin patch route builds the SET clause from a fixed allowlist (`trading_enabled`, `size_pct`) and uses placeholders for values. No user-controlled identifiers are interpolated.

No SQL injection issues found in the audited files.

## CRUD persistence verification
- `PATCH /api/admin/users`:
  - Updates `api_credentials` for `(user_id, platform='tradier')`.
  - Upserts corresponding record in `user_trading_settings` (converting 1–100 → 0.0–1.0).
  - Uses an explicit transaction (`BEGIN`/`COMMIT`) with rollback on error.

Persistence looks correct.

## Recommended patch list (high → low)
1. **Enforce CSRF in API routes**: add `validateCsrfFromRequest()` checks to admin PATCH (and any other state-changing routes).
2. **Block `/admin` for non-admins** at middleware or server layout level.
3. Add **rate limiting** to `GET /api/admin/users`.
4. Improve admin UI input behavior (debounce / onBlur) to avoid rate-limit collisions.
5. Populate `enabled_at` / `enabled_by` in `user_trading_settings` for auditability.
