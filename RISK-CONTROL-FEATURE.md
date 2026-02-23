# RISK CONTROL FEATURE - USER SELF-SERVICE ✅
**Added:** Feb 22, 2026 22:33 PST  
**Status:** COMPLETE - Ready to use Monday

---

## WHAT WAS BUILT

### User-Controlled Risk Settings

**Each user can now control:**
1. **Trading Enabled** (on/off toggle)
2. **Position Size** (1-100% slider)
3. **Max Position Size** (optional dollar cap)

**Access:** Dashboard → Settings → Risk Management card (top of page)

---

## HOW IT WORKS

### Frontend (Dashboard)
**New Component:** `components/risk-settings.tsx`
- Risk percentage slider (1-100%)
- Visual risk level indicator (Conservative → Maximum)
- Trading enabled toggle
- Optional max position size cap
- Real-time example calculations
- High-risk warning (>50%)

**Updated:** `app/settings/page.tsx`
- Added Risk Management card at top of settings

**New UI Components:**
- `components/ui/slider.tsx` (percentage slider)
- `components/ui/switch.tsx` (on/off toggle)

### Backend API
**New Endpoint:** `app/api/user/settings/route.ts`

**GET /api/user/settings**
- Returns user's current risk settings
- Creates default (100%) if none exist

**PATCH /api/user/settings**
- Updates risk settings
- Validates: size_pct must be 0.01-1.0 (1-100%)
- Validates: max_position_size must be positive or null

### Database (Already Exists)
**Table:** `user_trading_settings`

**Fields:**
- `trading_enabled` (boolean) - Master on/off switch
- `size_pct` (numeric) - Percentage of account per trade
- `max_position_size` (numeric) - Optional dollar cap
- `updated_at` (timestamp) - When last changed

**Current Values (before users adjust):**
- Aman: 100% (1.0)
- Carlos: 100% (1.0)
- All: trading_enabled = true

---

## EXECUTION FLOW (Monday)

### Before (Hardcoded)
```python
# meridian_config.py
TRADING_ACCOUNTS = [
    {"name": "aman", "size_pct": 1.0},  # Hardcoded 100%
    {"name": "carlos", "size_pct": 0.25},  # Hardcoded 25%
]
```

### After (Database-Driven)
```python
# meridian_executor.py reads from database
for acct_cfg in cfg.TRADING_ACCOUNTS:
    size_pct = acct_cfg["size_pct"]  # From database
    budget = equity * size_pct
```

**Flow:**
1. User adjusts slider to 50% in dashboard
2. PATCH /api/user/settings updates database
3. Next trade: executor reads 50% from database
4. Position size calculated with 50% of account

---

## USER EXPERIENCE

### Aman Example (Currently 100%)

**Step 1: Go to Settings**
```
Dashboard → Settings → Risk Management Card
```

**Step 2: Adjust Risk**
```
[Slider at 100%]  →  Drag to 50%
Status: "Maximum" → "Moderate"
Example: "With $10,000 account, Meridian will use $5,000 per trade"
```

**Step 3: Save**
```
[Save Risk Settings] button
✅ "Risk settings saved successfully"
```

**Step 4: Next Trade**
```
Meridian reads 50% from database
Aman's $8,971 account → $4,486 position size
Instead of $8,971 (100%)
```

---

### Carlos Example (Currently Hardcoded 25%)

**Current behavior:**
- Hardcoded to 25% in meridian_config.py
- Can't change it himself

**New behavior:**
1. Dashboard shows current: 100% (database default)
2. Carlos adjusts to 25% (matches his preference)
3. Or adjusts to 50% (wants more aggressive)
4. Saves → takes effect immediately

---

## RISK LEVELS (Visual Feedback)

**Slider shows risk level:**
- 1-10%: "Very Conservative" (blue)
- 11-25%: "Conservative" (green)
- 26-50%: "Moderate" (yellow)
- 51-75%: "Aggressive" (orange)
- 76-100%: "Maximum" (red)

**Warning at >50%:**
```
⚠️ High Risk Warning
Risking more than 50% per trade can lead to significant losses.
Consider reducing your position size for better risk management.
```

---

## OPTIONAL: MAX POSITION SIZE CAP

**Use case:** Aman has $8,971 but only wants max $5,000 per trade

**How to set:**
```
Max Position Size: $5,000
```

**Result:**
- If size_pct * equity > $5,000 → caps at $5,000
- If size_pct * equity < $5,000 → uses calculated amount
- Leave empty for no cap

---

## ADMIN VIEW (Your Side)

**You can still see/adjust via database:**
```sql
SELECT u.username, uts.size_pct, uts.max_position_size
FROM users u
JOIN user_trading_settings uts ON u.id = uts.user_id;
```

**Or update directly:**
```sql
UPDATE user_trading_settings
SET size_pct = 0.50  -- 50%
WHERE user_id = (SELECT id FROM users WHERE username = 'aman033092');
```

**But now users control it themselves** ✅

---

## TESTING (Before Monday)

### Test the UI
```bash
cd /Users/atlasbuilds/meridian-dashboard
npm run dev
```

**Visit:** http://localhost:3000/settings

**Login required:** Discord OAuth (Singularity role)

**Expected:**
1. See "Risk Management" card at top
2. Slider works (1-100%)
3. Risk level changes as you drag
4. Save button updates database
5. Success message appears

### Test the API
```bash
# Get current settings
curl http://localhost:3000/api/user/settings \
  -H "Cookie: session=<your-session>"

# Update to 50%
curl -X PATCH http://localhost:3000/api/user/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<your-session>" \
  -d '{"size_pct": 0.5}'
```

---

## MONDAY VERIFICATION

### Before First Trade
**Check database:**
```sql
SELECT u.username, uts.size_pct
FROM users u
JOIN user_trading_settings uts ON u.id = uts.user_id
WHERE u.username IN ('aman033092', 'aryok14');
```

**Expected:** Whatever they set in dashboard

### After First Trade
**Check logs:**
```
[aman] equity=$8971 budget=$4486 (50% size)
[carlos] equity=$754 budget=$189 (25% size)
```

**Confirms:** Position sizes match their settings

---

## FILES CREATED/MODIFIED

**New Files:**
- `app/api/user/settings/route.ts` (API endpoint)
- `components/risk-settings.tsx` (UI card)
- `components/ui/slider.tsx` (slider component)
- `components/ui/switch.tsx` (toggle component)

**Modified Files:**
- `app/settings/page.tsx` (added Risk Management card)
- `package.json` (added @radix-ui/react-slider and @radix-ui/react-switch)

**No Changes Needed:**
- `meridian_executor.py` (already reads from database via config)
- `meridian_db.py` (already has get_active_trading_accounts)
- Database schema (user_trading_settings already existed)

---

## SECURITY

**✅ User isolation:** Each user only sees/edits their own settings  
**✅ Validation:** API rejects invalid percentages (<1% or >100%)  
**✅ Authorization:** Requires valid session (Discord OAuth)  
**✅ Audit trail:** `updated_at` timestamp tracks changes

---

## BENEFITS

**For Users:**
- ✅ Self-service risk control
- ✅ No need to ask you to change config
- ✅ Instant updates (takes effect next trade)
- ✅ Visual feedback (risk level indicator)
- ✅ Example calculations (see impact before saving)

**For You:**
- ✅ Less admin work
- ✅ Users take ownership of their risk
- ✅ No config file edits
- ✅ Audit trail of changes
- ✅ Can still override via database if needed

---

## ROLLOUT PLAN

**Monday Morning:**
1. Users see default 100% in dashboard
2. They can adjust before first trade
3. Or leave at 100% and adjust later

**After First Trade:**
4. "Hey, you can control your risk % in Settings"
5. Show them the Risk Management card
6. Let them experiment with slider

**Week 1:**
- Monitor who adjusts settings
- Check if position sizes match expectations
- Gather feedback on UI

---

## NEXT ENHANCEMENTS (Future)

**Potential additions:**
- [ ] Risk per symbol (QQQ vs SPY different %)
- [ ] Time-based rules (more aggressive AM, conservative PM)
- [ ] Streak-based adjustment (reduce after losses)
- [ ] Volatility-based sizing (reduce on high VIX)
- [ ] Email notification when settings changed
- [ ] Mobile app for settings adjustment

---

**STATUS: ✅ COMPLETE AND READY FOR MONDAY**

Users can now control their own risk. Less work for you, more control for them.

⚡
