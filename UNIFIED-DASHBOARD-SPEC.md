# Unified Dashboard Spec — Helios + Meridian Integration

## Goal
Extend Meridian dashboard to include Helios signals and SnapTrade execution, role-gated by Discord roles.

## Current State
- Meridian: Live at https://meridian-dashboard-z2m7.onrender.com
- Tradier execution working
- Discord OAuth with SINGULARITY_ROLE_ID gate
- Stripe billing

## Target Architecture

```
/                   → Dashboard home (existing)
/trades             → Trade history (existing)  
/analytics          → Performance (existing)
/signals            → NEW: Helios signals feed + execution
/settings           → Settings (existing, add SnapTrade connection)
/billing            → Billing (existing)
```

## Role Gating
- `SINGULARITY_ROLE_ID` (existing) → Full access to Meridian 0DTE features
- `HELIOS_ROLE_ID` (new env var) → Access to /signals tab
- Users with both roles see both tabs

## New Features

### 1. /signals page
- Fetch from Helios API: `https://helios-px7f.onrender.com/positions` and `/weekly`
- Display current positions with live P&L
- Show signal history
- "Copy Trade" button → executes via SnapTrade

### 2. SnapTrade Integration
- Add to /settings: "Connect Broker via SnapTrade" 
- Store snaptrade_user_id, snaptrade_user_secret, selected_account in DB
- Use production keys: SNAPTRADE_CLIENT_ID=ZERO-G-TRADING-XSJQB

### 3. Execution Flow
Signal comes in → User clicks "Copy" → 
  - Check user has SnapTrade connected
  - Call SnapTrade API to place order
  - Log trade in DB
  - Show confirmation

## API Endpoints Needed

### GET /api/helios/positions
Proxy to Helios API, add user context

### GET /api/helios/signals  
Fetch signal history from Helios

### POST /api/execute/snaptrade
Execute trade via SnapTrade for logged-in user

### GET /api/user/snaptrade/accounts
List user's connected SnapTrade accounts

### POST /api/user/snaptrade/connect
Generate SnapTrade connection URL

## Database Changes
Add to users table (or new table):
- snaptrade_user_id
- snaptrade_user_secret  
- snaptrade_selected_account
- snaptrade_connected_at

## Env Vars Needed
- HELIOS_WEBHOOK_KEY (to auth with Helios API)
- SNAPTRADE_CLIENT_ID
- SNAPTRADE_CONSUMER_KEY
- HELIOS_ROLE_ID (Discord role for Helios access)

## Testing Strategy
- Mock Discord OAuth for E2E tests (set TEST_MODE=true, accept test tokens)
- Test SnapTrade in sandbox mode first
- E2E: login → navigate to /signals → see positions → execute trade

## DO NOT BREAK
- Existing Tradier execution
- Existing Discord auth flow
- Existing billing
- Existing user data
