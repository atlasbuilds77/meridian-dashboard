# STRIPE KEYS - READY FOR RENDER

**Date:** 2026-02-20 20:19 PST  
**Status:** All 3 keys configured locally ✅

---

## Local Environment (.env.local) ✅

```bash
STRIPE_SECRET_KEY=sk_live_REPLACE_WITH_REAL_KEY
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_REAL_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_WITH_REAL_KEY
```

---

## Add to Render (Production)

**Go to:** Render Dashboard → meridian-dashboard service → Environment

**Add these 3 variables:**

```bash
STRIPE_SECRET_KEY=sk_live_REPLACE_WITH_REAL_KEY

STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_REAL_KEY

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_WITH_REAL_KEY
```

**Then:** Click "Save Changes" → Render will auto-redeploy (2-3 min)

---

## Test Locally First (Recommended)

```bash
cd /Users/atlasbuilds/Desktop/meridian-dashboard
npm run dev
```

**Open:** http://localhost:3001

**Test flow:**
1. Login with Discord
2. Complete onboarding (5 steps)
3. Go to Settings
4. Add test card: `4242 4242 4242 4242`
5. Verify card appears

**Test card details:**
- Card: 4242 4242 4242 4242
- Expiry: Any future date (e.g., 12/28)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

---

## Stripe Webhook Configuration ✅

**Endpoint:** https://meridian.zerogtrading.com/api/webhooks/stripe

**Events listening:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `setup_intent.succeeded`

**Signing Secret:** whsec_REPLACE_WITH_REAL_KEY ✅

---

## What's Ready

**Local:**
- ✅ Database migrations run (21 tables)
- ✅ Stripe keys configured
- ✅ All dependencies installed
- ✅ Ready to test

**Production:**
- ✅ Code deployed to GitHub
- ✅ Render auto-deploying
- ⏳ Add Stripe keys to Render environment
- ⏳ Test live deployment

---

## Next Steps

1. **Test locally** (5 min) - Verify onboarding + payment flow
2. **Add to Render** (2 min) - Paste 3 env vars
3. **Wait for deploy** (3 min) - Render builds
4. **Test production** (5 min) - Login, onboard, add card

**Total time:** 15 minutes to fully live

⚡ Ready to ship.
