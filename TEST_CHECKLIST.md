# 🧪 Meridian Dashboard Test Checklist

**Server:** http://localhost:3001  
**Status:** ✅ Running (started Feb 20, 4:17 PM)

## Pre-Flight Check
- [x] Dev server started successfully
- [x] Port 3001 active
- [x] Middleware redirecting to /login
- [x] No compilation errors
- [x] Database connected (meridian_0j0f)
- [x] Environment variables loaded

## Test Sequence

### 1. Login Page (`/login`)
- [ ] Page loads without errors
- [ ] "Login with Discord" button visible
- [ ] Singularity tier branding present
- [ ] Professional dark theme (#0a0a0a)
- [ ] Rocket logo displayed

### 2. Discord OAuth Flow
- [ ] Click "Login with Discord"
- [ ] Redirect to Discord authorization
- [ ] Shows requested permissions:
  - Identify (username, avatar)
  - Guilds (server list)
  - Guilds.members.read (role check)
- [ ] Authorize and redirect back
- [ ] Callback processes successfully
- [ ] Session cookie set

### 3. Role Verification
- [ ] Server checks guild membership (ID: 1354693841978134598)
- [ ] Server checks Singularity role (ID: 1454737556062208073)
- [ ] If missing role → "Access denied" error
- [ ] If has role → redirect to dashboard

### 4. Main Dashboard (`/`)
- [ ] Page loads successfully
- [ ] User avatar in top right
- [ ] System stats cards visible
- [ ] Data fetches from API
- [ ] No console errors

### 5. Settings Page (`/settings`)
- [ ] Navigate to settings
- [ ] Platform dropdown (Tradier only)
- [ ] API key input field
- [ ] Verification on submit
- [ ] Success/error messages
- [ ] Encrypted storage in database

### 6. Admin Dashboard (`/admin`) - CRITICAL
- [ ] Click avatar → "Admin Dashboard" link visible
- [ ] Navigate to /admin
- [ ] 4 system stat cards load:
  - Total Users
  - Active Traders
  - Total Trades
  - Combined P&L
- [ ] User table renders
- [ ] Columns display correctly:
  1. User (avatar + username)
  2. Tradier (account + status)
  3. Trading (ON/OFF toggle)
  4. Size % (editable input)
  5. Trades (count)
  6. P&L (green/red)
  7. Win Rate (%)
  8. Last Login (date)
- [ ] Test trading toggle (click ON/OFF)
- [ ] Test size % edit (change value)
- [ ] Database updates confirmed

### 7. Database Verification
- [ ] Check `users` table for new entry
- [ ] Check `accounts` table if API key added
- [ ] Verify encrypted credentials
- [ ] Check audit log entries

### 8. Logout Flow
- [ ] Click avatar → Logout
- [ ] Session cookie deleted
- [ ] Redirect to /login
- [ ] Can't access protected routes

## Expected Behavior

### Success Cases
✅ Valid Singularity member → full access  
✅ Admin (Orion) → sees "Admin Dashboard" link  
✅ API key encryption → stored securely  
✅ Trading toggle → updates database  

### Error Cases
❌ No Singularity role → "Access denied"  
❌ Invalid session → redirect to login  
❌ Non-admin tries /admin → 403 Forbidden  
❌ Invalid API key → verification failed  

## Console Checks

### Expected Logs (Server)
```
GET /login 200
GET /api/auth/discord/callback 302
GET / 200
GET /api/auth/session 200
GET /api/admin/users 200
```

### No Errors
- No database connection errors
- No JWT verification errors
- No Discord API errors
- No missing environment variables

## Database State After Test

### Tables Should Have:
- `users` - 1 row (your Discord user)
- `accounts` - 0-1 rows (if API key added)
- `api_credentials` - 0-1 rows (if API key added)
- `api_key_audit_log` - Activity logs
- `user_onboarding` - Onboarding state

## Production Readiness

After local testing passes:
- [ ] All features working locally
- [ ] No console errors
- [ ] Database operations successful
- [ ] Admin controls functional
- [ ] Ready for deployment

**When all checks pass → Push to GitHub for Render deployment** 🚀
