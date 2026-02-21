# MERIDIAN ONBOARDING SYSTEM - DEPLOYMENT GUIDE

**Built:** February 20, 2026  
**Status:** Ready for deployment  
**Timeline:** 2 weeks to production-ready

---

## What Was Built

### 1. **Database Schema** ✅
**File:** `lib/db/schema-onboarding.sql`

**10 tables created:**
- `onboarding_sessions` - Track user onboarding progress
- `risk_acknowledgments` - Store risk checkbox acceptances
- `document_agreements` - Track ToS/Privacy/Risk acceptance
- `signature_events` - E-signature audit trail (ESIGN Act compliant)
- `accredited_investor_verifications` - SEC compliance (if needed later)
- `user_documents` - S3 document storage references
- `age_verification_failures` - Under-18 blocking
- `onboarding_audit_log` - Complete event tracking
- `user_consents` - GDPR/CCPA compliance
- `cooling_off_periods` - 24-hour waiting period (optional)

**Run migration:**
```bash
cd /Users/atlasbuilds/Desktop/meridian-dashboard
node scripts/run-migrations.js
```

---

### 2. **API Routes** ✅

**Created:**
- `/api/onboarding/start` - Start new onboarding session
- `/api/onboarding/submit` - Submit each step (risks, ToS, fees, signature)
- `/api/onboarding/status` - Check if user completed onboarding

**Features:**
- IP address logging (backend only, not shown to user)
- Session token validation
- Document hashing (SHA-256)
- Signature verification (HMAC)
- Audit trail for all events

---

### 3. **Onboarding UI** ✅

**File:** `app/onboarding/page.tsx`

**5-step flow:**

**Step 1: Welcome**
- Introduction screen
- Estimated time: 2-3 minutes

**Step 2: Risk Acknowledgments**
- 6 risk checkboxes (all required)
- Link to full Risk Disclosure document
- Cannot proceed until all checked

**Step 3: Terms of Service**
- Key points displayed
- Checkbox to accept
- Link to full ToS document

**Step 4: Fee Agreement**
- **$1,200/month** membership
- **10% automation fee** (weekly profits only)
- Clear example breakdown
- Checkbox to accept

**Step 5: E-Signature**
- Type full legal name
- Date auto-populated
- Age certification (18+)
- IP logged (not shown)
- Final submit button

**Features:**
- Progress indicator (steps 1-5)
- Error handling
- Loading states
- Mobile-responsive
- Cannot skip steps

---

### 4. **Legal Documents** ✅

**Created:**
- `/app/legal/terms/page.tsx` - Full Terms of Service
- `/app/legal/risk-disclosure/page.tsx` - Complete Risk Disclosure

**Content includes:**
- Arbitration agreement
- Liability caps ($1,200 or lifetime fees)
- No investment advice disclaimers
- "AS IS" warranty disclaimers
- All trading risks (options, automation, volatility, etc.)

---

### 5. **Onboarding Gate** ✅

**File:** `components/onboarding-gate.tsx`

**Functionality:**
- Checks if user completed onboarding on every page load
- Redirects to `/onboarding` if not completed
- Shows loading spinner during check
- Fails open (allows access) if API error

**Integrated into:** `app/layout.tsx`

---

## Deployment Steps

### Step 1: Run Database Migration

```bash
cd /Users/atlasbuilds/Desktop/meridian-dashboard
node scripts/run-migrations.js
```

**Expected output:**
```
🔗 Connecting to database...
📄 Running onboarding schema migration...
✅ Migration completed successfully!
```

---

### Step 2: Test Locally

```bash
npm run dev
```

**Open:** http://localhost:3001

**Test flow:**
1. Login via Discord
2. Should redirect to `/onboarding` (first time)
3. Complete all 5 steps
4. Should redirect back to dashboard
5. Try accessing `/onboarding` again (should redirect to dashboard)

---

### Step 3: Deploy to Render

**Push to GitHub:**
```bash
cd /Users/atlasbuilds/Desktop/meridian-dashboard
git add .
git commit -m "Add onboarding system with legal agreements"
git push origin main
```

**Render will auto-deploy** (already connected to GitHub repo)

---

### Step 4: Verify Production

**After deployment:**
1. Visit https://meridian.zerogtrading.com
2. Login with Discord
3. Complete onboarding flow
4. Check database for records:

```sql
-- Check onboarding completion
SELECT u.discord_username, os.status, os.completed_at
FROM users u
JOIN onboarding_sessions os ON os.user_id = u.id
WHERE os.status = 'completed'
ORDER BY os.completed_at DESC;

-- Check signatures
SELECT user_id, signer_name, signer_date, timestamp_utc
FROM signature_events
ORDER BY timestamp_utc DESC;
```

---

## Fee Structure Implementation

### Current Status: ✅ Legal Framework Ready

**What's built:**
- Fee agreement acceptance (Step 4 of onboarding)
- User consent tracking in database
- Legal disclaimers ("automation service fee")

**What's needed next (Week 2):**
1. Stripe billing integration
2. Weekly P&L calculation cron job
3. Auto-charge on Sunday nights
4. Email receipts

**Fee calculation logic:**
```javascript
// Pseudocode
async function calculateWeeklyFee(userId) {
  const weekStart = getLastMonday();
  const weekEnd = getLastFriday();
  
  const trades = await getTrades(userId, weekStart, weekEnd);
  const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  
  if (totalPnL > 0) {
    const fee = totalPnL * 0.10;
    await chargeStripe(userId, fee, 'Automation service fee');
  }
}
```

---

## Security Features

✅ **E-Signature Compliance (ESIGN Act):**
- Typed signature with timestamp
- IP address logging
- HMAC verification hash
- Document SHA-256 hashing
- Audit trail of all events

✅ **GDPR/CCPA Compliance:**
- User consent tracking
- Data retention policies (6 years)
- Privacy policy acceptance
- Right to access/delete (future)

✅ **Legal Protection:**
- Arbitration agreement (blocks class actions)
- Liability caps ($1,200 or lifetime fees)
- No investment advice disclaimers
- "AS IS" warranty disclaimers
- User responsibility acknowledgments

---

## File Structure

```
meridian-dashboard/
├── app/
│   ├── api/
│   │   └── onboarding/
│   │       ├── start/route.ts
│   │       ├── submit/route.ts
│   │       └── status/route.ts
│   ├── onboarding/
│   │   └── page.tsx (5-step wizard)
│   └── legal/
│       ├── terms/page.tsx
│       └── risk-disclosure/page.tsx
├── components/
│   └── onboarding-gate.tsx
├── lib/
│   └── db/
│       └── schema-onboarding.sql
└── scripts/
    └── run-migrations.js
```

---

## Testing Checklist

**Before Production:**
- [ ] Run migration on production database
- [ ] Test complete onboarding flow
- [ ] Verify all checkboxes work
- [ ] Test signature capture
- [ ] Check database inserts
- [ ] Verify legal documents load
- [ ] Test onboarding gate (redirects work)
- [ ] Test with multiple users
- [ ] Verify email delivery (if implemented)
- [ ] Check mobile responsiveness

---

## Next Steps (Week 2)

### Stripe Billing Integration
1. Create Stripe Customer on user signup
2. Save payment method during onboarding
3. Build weekly P&L calculation cron
4. Implement Sunday night auto-charge
5. Send email receipts
6. Add billing history page

### User Flow Enhancement
1. Add "View Documents" in Settings
2. PDF generation (signed agreements)
3. S3 upload for document storage
4. Email signed documents to user

### Admin Dashboard
1. View all onboarded users
2. See signature events
3. Export legal documents
4. Audit trail viewer

---

## Support

**Questions or issues?**
- Check audit log: `SELECT * FROM onboarding_audit_log ORDER BY timestamp DESC;`
- Check failed sessions: `SELECT * FROM onboarding_sessions WHERE status = 'failed';`
- Check database connection: `node scripts/run-migrations.js`

---

## Legal Note

**Attorney review strongly recommended before production launch.**

Cost: $5K-$15K for opinion letter

Send:
- All legal documents (ToS, Risk Disclosure)
- Fee structure explanation
- Onboarding flow screenshots
- Database schema

**Protection:** Opinion letter provides "good faith" defense if SEC/FINRA questions arise.

---

**Status:** Ready to deploy Week 1. Iterate in Week 2.

—Atlas ⚡
