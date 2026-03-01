# Adding Admin Users to Meridian Dashboard

## Current Setup

Admin access is controlled by the `ADMIN_DISCORD_IDS` environment variable.
This is a comma-separated list of Discord user IDs (17-19 digit snowflakes).

## Current Admins

| Name | Discord Username | Discord ID |
|------|------------------|------------|
| Hunter | orionzerog | 838217421088669726 |

## Adding Aphmas as Admin

### User Details
- **Name:** Kevin (aphmas)
- **Discord ID:** 361901004631145355
- **Role:** Admin (full dashboard access)

### Steps to Add

#### Option 1: Render Dashboard (Production)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select the `meridian-dashboard` service
3. Go to **Environment** tab
4. Find `ADMIN_DISCORD_IDS` variable
5. Update value to: `838217421088669726,361901004631145355`
6. Click **Save Changes**
7. The service will automatically redeploy

#### Option 2: Local Development

Add to `.env.local`:
```bash
ADMIN_DISCORD_IDS=838217421088669726,361901004631145355
```

## Verification

After updating, Aphmas can verify admin access by:
1. Logging into the dashboard via Discord OAuth
2. Clicking their avatar in the top-right
3. Seeing the "Admin Dashboard" link with a gear icon
4. Accessing `/admin` to view the admin panel

## How Admin Checks Work

The admin check is in `lib/auth/admin.ts`:
- Reads `ADMIN_DISCORD_IDS` from environment
- Validates each ID is 17-19 digits
- Uses timing-safe comparison for security
- Returns `true` if the logged-in user's Discord ID matches

## Security Notes

- Admin Discord IDs should NEVER be committed to git
- Keep the env var in Render's secure environment only
- The example file (.env.local.example) shows empty value intentionally
