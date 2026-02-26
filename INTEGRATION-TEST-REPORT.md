# Meridian Dashboard – Integration Test Report

Date: 2026-02-26

Scope (requested):
1) Admin → User settings sync (trading_enabled, size_pct, max_daily_loss)
2) User → Admin settings sync
3) Trading enabled/disabled toggle (DB + UI + copy-trading respects)
4) PnL share card generation (/api/share/generate + templates)

---

## Environment
- Repo: `meridian-dashboard`
- DB: Render Postgres (from `.env.local`)
- Verified tables present (via `node check-db.js`): `user_trading_settings` has rows and exists.

---

## Findings & Fixes

### 1) Admin → User settings sync

**Expected:** Admin updates `trading_enabled`, `size_pct`, `max_daily_loss` in admin portal → user dashboard reflects.

**What I found (pre-fix):**
- Admin settings API (`app/api/admin/users/[userId]/settings/route.ts`) reads/writes **`user_trading_settings`** and includes `max_daily_loss`.
- User settings API (`app/api/user/settings/route.ts`) **did not include `max_daily_loss`** in GET/PATCH.
- User dashboard UI (`components/risk-settings.tsx`) had no field for `max_daily_loss`.

**Fix implemented:**
- Updated **User Settings API** to include `max_daily_loss`:
  - GET now selects and returns `max_daily_loss`.
  - PATCH now validates and updates `max_daily_loss`.
- Updated **User Risk Settings UI** to display/edit `max_daily_loss` (optional `$` input).

**Files changed:**
- `app/api/user/settings/route.ts`
- `components/risk-settings.tsx`

---

### 2) User → Admin settings sync

**Expected:** User changes their settings → admin portal shows updated values.

**What I found (pre-fix):**
- Admin list/dashboard (`/admin` → `app/admin/page.tsx`) reads settings from `api_credentials` (`trading_enabled`, `size_pct` as **1–100 integer**).
- User settings API PATCH updated **only** `user_trading_settings` (where `size_pct` is **0.01–1.0**), so the admin list view could appear stale.

**Fix implemented:**
- User settings PATCH now **also updates `api_credentials`** (platform = `tradier`) for:
  - `trading_enabled`
  - `size_pct` (converted from `0.01–1.0` → `1–100`)

**File changed:**
- `app/api/user/settings/route.ts`

**Note:** The admin *per-user settings* endpoint already uses `user_trading_settings` and a different `size_pct` scale (0.01–1.0), while the admin *list* uses `api_credentials` (1–100). That split is workable, but it requires the sync done above (or a UI refactor to read only from one source).

---

### 3) Trading enabled/disabled toggle

**Expected:** Toggle updates DB, UI reflects, and copy-trading respects.

**What I found:**
- Admin PATCH `/api/admin/users` already updates BOTH:
  - `api_credentials` (admin dashboard uses this)
  - `user_trading_settings` (comment indicates trading system reads this)
- User toggle (dashboard) uses `/api/user/settings`.

**Fix implemented:**
- User PATCH now updates:
  - `user_trading_settings.trading_enabled`
  - `api_credentials.trading_enabled` (tradier)

**Additional bug fixed:**
- In `app/api/user/settings/route.ts`, when no row existed and the code inserted a default row, the response still returned `result.rows[0]` from the failed UPDATE (undefined). This is now fixed by returning the INSERT/UPSERT row.

**Copy-trading system:**
- This repo does not include the trade-execution service; I cannot fully verify runtime behavior here.
- However, the DB write-path is now consistent: both tables are updated from both admin and user APIs.
- If the copier reads `user_trading_settings`, it will see correct values. If it reads `api_credentials`, it will also see correct values after this fix.

---

## 4) PnL share card generation

### Endpoint
- `POST /api/share/generate` exists at `app/api/share/generate/route.ts`.
- It requires a `userId` in the request body (session decoding is TODO).

### Templates
- Templates found in `lib/templates/`:
  - `black-edition.html`
  - `ruby-edition.html`
  - `emerald-edition.html`
  - `sapphire-edition.html`
  - `diamond-edition.html`

### Render test (all 5 editions)
Generated sample images successfully using Puppeteer via a local script:
- Script added: `scripts/generate-share-cards.ts`
- Output folder: `share-card-test-output/`
  - `sample-black.png`
  - `sample-ruby.png`
  - `sample-emerald.png`
  - `sample-sapphire.png`
  - `sample-diamond.png`

Command used:
```bash
npx -y tsx scripts/generate-share-cards.ts
```

### Mockups
Mockups folder was found as a sibling directory:
- `../meridian-share-mockups`

I did not do pixel-perfect comparisons in this run, but all templates rendered and screenshots completed without errors.

---

## Summary of Changes

### Code fixes made
1) **User API now supports `max_daily_loss`** (GET + PATCH)
2) **User settings updates now sync `api_credentials`** so admin list views update immediately
3) **Fixed response bug** when `user_trading_settings` row did not exist (insert path returned undefined)
4) **User dashboard UI** now displays/edits Max Daily Loss

### Files changed / added
- Modified:
  - `app/api/user/settings/route.ts`
  - `components/risk-settings.tsx`
- Added:
  - `scripts/generate-share-cards.ts`
  - `share-card-test-output/*.png`

---

## Recommended follow-ups (not required for this fix)
- Unify `size_pct` scale across admin endpoints/UI:
  - Admin list uses `api_credentials.size_pct` (1–100)
  - Admin per-user settings uses `user_trading_settings.size_pct` (0.01–1.0)
  - Consider standardizing API contract to avoid conversion bugs.
- Implement session-based userId extraction in `/api/share/generate` (currently returns `userId required` when not passed).
