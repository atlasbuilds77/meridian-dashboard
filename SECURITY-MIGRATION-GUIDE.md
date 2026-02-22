# Security Migration Guide

## ⚠️ BREAKING CHANGES - READ BEFORE DEPLOYING

This update includes **critical security fixes** that require changes to your environment variables and may break existing encrypted data.

---

## 🔴 REQUIRED ACTIONS BEFORE DEPLOYMENT

### 1. Rotate ENCRYPTION_KEY (CRITICAL)

**Old format (scrypt-based with static salt):**
```bash
ENCRYPTION_KEY=any-32-character-string-here-abc
```

**New format (base64-encoded random bytes):**
```bash
# Generate a new key:
openssl rand -base64 32

# Example output:
# 5rIdx1otJbAi9O9KN8iAZxzXiAzH97FIFIiMfkaQg6c=
```

**Why:** The old implementation used a static salt (`'meridian-salt'`), which meant the same ENCRYPTION_KEY resulted in the same derived key across all deployments. The new implementation uses a proper random key.

**Impact:**
- ❌ Existing encrypted API keys **cannot be decrypted** with the new system
- ✅ Users will need to **re-enter their API keys** after deployment
- ✅ Much stronger encryption going forward

**Steps:**
1. Generate new key: `openssl rand -base64 32`
2. Update production environment variable
3. Notify users they'll need to re-add API keys
4. Consider sending email: "For security, please re-enter your trading API keys"

---

### 2. Validate All Required Secrets

The app will now **exit immediately on startup** if any required secret is missing or invalid.

**Required environment variables:**
- `SESSION_SECRET` (min 32 chars, generate with: `openssl rand -base64 32`)
- `ENCRYPTION_KEY` (min 32 bytes base64, generate with: `openssl rand -base64 32`)
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DATABASE_URL`

**Production-only requirements:**
- `DATABASE_SSL=true` (enforced in production)
- `DATABASE_SSL_REJECT_UNAUTHORIZED` cannot be `false` (security risk)

**Before deploying:**
```bash
# Check your .env.local or production environment:
cat .env.local | grep -E "SESSION_SECRET|ENCRYPTION_KEY|DATABASE"

# Make sure SESSION_SECRET and ENCRYPTION_KEY are at least 32 chars
```

---

### 3. Session Expiration

**Duration:** 7 days (reverted from initial 2-hour change per user request)

**Impact:**
- Session lasts one week before requiring re-login
- Matches trading platform usage patterns (users want extended sessions)

**User experience:**
- Users stay logged in for 7 days
- No frequent re-authentication required

---

### 4. Admin Discord IDs Validated

Admin Discord IDs are now validated on startup. Invalid IDs will be **rejected with a warning**.

**Valid format:** 17-19 digit Discord snowflake IDs

**Example:**
```bash
ADMIN_DISCORD_IDS=838217421088669726,123456789012345678
```

**Check your admin IDs:**
```bash
echo $ADMIN_DISCORD_IDS | tr ',' '\n' | while read id; do
  if [[ ! $id =~ ^[0-9]{17,19}$ ]]; then
    echo "❌ Invalid ID: $id"
  else
    echo "✅ Valid ID: $id"
  fi
done
```

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment (LOCAL)

- [ ] Generate new ENCRYPTION_KEY: `openssl rand -base64 32`
- [ ] Update `.env.local` with new ENCRYPTION_KEY
- [ ] Test app starts without errors: `npm run dev`
- [ ] Verify startup checks pass (look for "✅ All required secrets validated")
- [ ] Test login still works
- [ ] Test adding a new API key (existing keys won't work)

### Production Deployment

- [ ] Update production `ENCRYPTION_KEY` environment variable
- [ ] Update production `SESSION_SECRET` if weak (check length)
- [ ] Set `DATABASE_SSL=true`
- [ ] Set `DATABASE_SSL_REJECT_UNAUTHORIZED=true` (or leave unset)
- [ ] Validate `ADMIN_DISCORD_IDS` format
- [ ] Deploy application
- [ ] Check logs for startup validation success
- [ ] Test login immediately after deploy

### Post-Deployment

- [ ] Notify all users to re-add API keys (if they had any)
- [ ] Monitor error logs for 24 hours
- [ ] Test all critical flows:
  - [ ] Discord OAuth login
  - [ ] API key addition
  - [ ] Trade creation
  - [ ] Billing/payments
  - [ ] Admin access

---

## 🔧 TROUBLESHOOTING

### App Won't Start

**Error:** `ENCRYPTION_KEY must be valid base64`

**Fix:**
```bash
# Generate new key properly:
openssl rand -base64 32
# Copy output to ENCRYPTION_KEY
```

**Error:** `SESSION_SECRET must be at least 32 characters`

**Fix:**
```bash
# Generate new session secret:
openssl rand -base64 32
# Copy output to SESSION_SECRET
```

**Error:** `PRODUCTION REQUIRES: DATABASE_SSL=true`

**Fix:**
```bash
# In production environment, set:
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

### Users Can't Decrypt Old API Keys

**This is expected.** Old encrypted API keys used the old scrypt-based system with static salt.

**Solution:**
1. Users must delete old API keys (they'll fail to decrypt anyway)
2. Users add new API keys with the new encryption system
3. Optionally: Add banner on settings page: "Please re-enter your API keys for improved security"

### Sessions Keep Expiring

Sessions now expire after 7 days (same as before the security update).

**This is expected behavior.** Users will need to re-login once per week.

---

## 📊 SECURITY IMPROVEMENTS SUMMARY

| Item | Before | After | Impact |
|------|--------|-------|--------|
| Encryption | scrypt with static salt | Direct base64 key | ✅ Stronger, no shared salt |
| Session Duration | 24 hours | 7 days | ↔️ Extended for UX |
| Startup Checks | None | Full validation | ✅ Fail fast on misconfig |
| Admin IDs | No validation | Format + timing-safe | ✅ Harder to brute force |
| Stripe Webhooks | No timestamp check | 5-min tolerance | ✅ Prevents replay attacks |
| Rate Limiting | Some endpoints | All endpoints | ✅ DoS protection |

---

## 🆘 NEED HELP?

**If deployment fails:**
1. Check logs for specific startup validation errors
2. Verify all environment variables are set correctly
3. Test locally first with `npm run dev`
4. Rollback to previous version if critical issue

**If users report issues:**
1. Check if they're trying to use old API keys → tell them to re-add
2. Check if sessions are expiring → expected behavior (2 hours now)
3. Check error logs for unexpected issues

---

**Last Updated:** 2026-02-22  
**Security Score Before:** 6.1/10  
**Security Score After:** ~7.5/10 (estimated)
