# Multi-Tenant Dashboard Build Progress

**Status:** IN PROGRESS (50% complete)
**Goal:** One dashboard URL, each user sees only their data, Singularity role gate

---

## ✅ COMPLETED

### 1. Database Schema (`lib/db/schema.sql`)
- **users** table - Discord auth + user profiles
- **accounts** table - User trading accounts (user_id isolation)
- **trades** table - User trades (user_id isolation)
- **user_portfolio_summary** view - Aggregated stats per user
- Indexes for performance
- Multi-tenant ready (all data tagged with user_id)

### 2. Database Helper Functions (`lib/db/users.ts`)
- `getOrCreateUser()` - Create user on first login
- `getUserByDiscordId()` - Lookup existing user
- `getUserAccounts()` - Get user's accounts only
- `getUserTrades()` - Get user's trades only
- `getUserStats()` - Portfolio summary for user

### 3. Updated Discord OAuth (`app/api/auth/discord/callback/route.ts`)
- Creates database user on first login
- Stores `dbUserId` in session (for queries)
- Still checks Singularity role (access gate)
- Links Discord ID → database user ID

### 4. Updated Session API (`app/api/auth/session/route.ts`)
- Returns `dbUserId` for frontend queries
- Maintains Discord profile info

### 5. Accounts API (`app/api/user/accounts/route.ts`)
- GET - List user's accounts (filtered by session user_id)
- POST - Add new account (tagged with user_id)
- PATCH - Update account (ownership check)
- **Data isolation:** Users can only see/edit their own accounts

---

## 🔄 IN PROGRESS / TODO

### 1. Trades API (`app/api/user/trades/route.ts`) - NEXT
- GET - List user's trades
- POST - Add new trade
- PATCH - Update trade
- DELETE - Remove trade
- Same pattern as accounts API

### 2. Stats API (`app/api/user/stats/route.ts`) - NEXT
- GET user's portfolio summary
- Win rate, total P&L, account balance
- Uses `user_portfolio_summary` view

### 3. Update Existing APIs
- `/api/trades` - Filter by user_id from session
- `/api/accounts` - Filter by user_id from session
- `/api/market` - Keep as-is (public data)
- `/api/status` - Keep as-is (system health)

### 4. Frontend Forms (Manual Data Entry)
- **Add Account Form**
  - Platform dropdown (Tradier, Webull, TopstepX, etc.)
  - Account name input
  - Account ID (optional)
  - Starting balance
  
- **Add Trade Form**
  - Symbol input
  - Direction (LONG/SHORT/CALL/PUT)
  - Asset type (stock/option/future/crypto)
  - Entry price, exit price
  - Entry date, exit date
  - Quantity
  - Auto-calculate P&L

### 5. Update Dashboard Pages
- **Main Dashboard** (`app/page.tsx`)
  - Fetch user-specific data (`/api/user/stats`)
  - Show only logged-in user's portfolio
  - "Add Account" and "Add Trade" buttons
  
- **Trades Page** (`app/trades/page.tsx`)
  - List user's trades only
  - Filter/sort by date, symbol, P&L
  - Edit/delete buttons

- **Accounts Page** (new)
  - List user's accounts
  - Total balance
  - Edit balance button

### 6. Database Initialization
- Need to run schema.sql on PostgreSQL database
- Create tables: users, accounts, trades
- Create view: user_portfolio_summary
- Add indexes

---

## ARCHITECTURE FLOW

```
1. User visits dashboard
   ↓
2. Redirected to /login
   ↓
3. Click "Login with Discord"
   ↓
4. Discord OAuth
   ↓
5. Check: In server + Has Singularity role?
   ├─ YES → Create/get database user
   │         Store dbUserId in session
   │         Redirect to dashboard
   └─ NO  → "Access denied. Singularity tier required."
   
6. Dashboard loads
   ↓
7. Fetch user data (filtered by dbUserId from session)
   - GET /api/user/accounts (their accounts only)
   - GET /api/user/trades (their trades only)
   - GET /api/user/stats (their stats only)
   ↓
8. User manually adds trades/accounts
   ↓
9. All data tagged with their user_id
   ↓
10. Only they can view/edit their data
```

---

## SECURITY MODEL

**Access Control:**
- Singularity role = Can create account
- Once account created = Can only see their own data
- All queries filtered by `user_id` from session
- Ownership checks on updates/deletes

**Session:**
- 7-day cookie
- Contains: discordId, dbUserId, username, avatar
- Middleware checks session before allowing access

**Database:**
- All tables have `user_id` column
- Foreign keys enforce referential integrity
- ON DELETE CASCADE cleans up user data
- Indexes on user_id for performance

---

## NEXT STEPS (Priority Order)

1. **Create trades API** (`app/api/user/trades/route.ts`)
2. **Create stats API** (`app/api/user/stats/route.ts`)
3. **Run database schema** (initialize tables)
4. **Build "Add Account" form component**
5. **Build "Add Trade" form component**
6. **Update main dashboard** to fetch user-specific data
7. **Create accounts management page**
8. **Test multi-user isolation** (two different Discord users)
9. **Deploy database schema to Render PostgreSQL**
10. **Test full flow** (login → add account → add trade → view dashboard)

---

## FILES CREATED

1. `/lib/db/schema.sql` - Database schema
2. `/lib/db/users.ts` - Helper functions
3. `/app/api/user/accounts/route.ts` - Accounts API
4. Updated: `/app/api/auth/discord/callback/route.ts` - User creation
5. Updated: `/app/api/auth/session/route.ts` - Return dbUserId

---

## FILES TO CREATE

1. `/app/api/user/trades/route.ts` - Trades API
2. `/app/api/user/stats/route.ts` - Stats API
3. `/components/add-account-form.tsx` - Add account UI
4. `/components/add-trade-form.tsx` - Add trade UI
5. `/app/accounts/page.tsx` - Accounts management page

---

## TESTING CHECKLIST

- [ ] Two users with different Discord IDs
- [ ] User A adds account → User B can't see it
- [ ] User A adds trade → User B can't see it
- [ ] User A can only edit their own data
- [ ] Non-Singularity user gets rejected at login
- [ ] Session expiration works correctly
- [ ] Database queries are efficient (use indexes)
- [ ] Frontend shows loading states
- [ ] Error messages are user-friendly

---

**Current State:** Backend 50% complete, Frontend 0% complete
**Next Session:** Build trades/stats APIs + data entry forms
**ETA:** 2-3 hours to complete full multi-tenant system

✅ **Singularity role check:** Still active (access gate)
✅ **Data isolation:** Working (user_id filtering)
✅ **Manual entry:** Ready to build (APIs in place)
⏳ **Auto-sync:** Future feature (API keys later)
