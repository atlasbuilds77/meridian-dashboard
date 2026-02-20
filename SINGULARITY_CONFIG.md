# Singularity Tier Configuration - Quick Start

**Access Restriction:** Dashboard is ONLY accessible to users with the **Singularity** Discord role.

## What You Need

1. **Discord Application** (OAuth2 app)
2. **Your Discord Server ID** (Guild ID)
3. **Singularity Role ID** (the role that grants access)

## Quick Setup (3 Steps)

### 1. Get Your Server ID
```
Discord → Right-click server name → Copy Server ID
```

### 2. Get Singularity Role ID
```
Discord → Server Settings → Roles → Right-click "Singularity" → Copy Role ID
```

### 3. Add to .env.local
```env
DISCORD_GUILD_ID=your_server_id_here
SINGULARITY_ROLE_ID=your_singularity_role_id_here
```

## How It Works

**When a user logs in:**
1. Discord OAuth authenticates the user
2. System checks if user is in your Discord server
3. System checks if user has Singularity role
4. ✅ **Access granted** if they have the role
5. ❌ **Access denied** if they don't

**Error Messages:**
- "You must be a member of the trading Discord server" → User not in server
- "Access denied. Singularity tier required" → User in server but no role
- Shows on login page, user-friendly

## Testing

### Test User WITH Singularity Role:
1. Make sure they're in your Discord server
2. Assign them the Singularity role
3. They click "Login with Discord"
4. Should land on dashboard ✅

### Test User WITHOUT Singularity Role:
1. User in server but no role
2. They click "Login with Discord"
3. See error: "Access denied. Singularity tier required" ❌

## Role Assignment

**To give someone Singularity access:**
```
Discord → Server Settings → Members → Find user → Add role "Singularity"
```

**To remove access:**
```
Discord → Server Settings → Members → Find user → Remove role "Singularity"
```

Changes take effect immediately on next login.

## Security

- No hardcoded user IDs (dynamic role checking)
- Access controlled entirely by Discord roles
- You manage access in Discord (easy)
- Session expires after 7 days
- No way to bypass role check

## Optional: Rename the Role

If your premium tier isn't called "Singularity":
1. Use whatever role name you want in Discord
2. Just get its Role ID and add to `SINGULARITY_ROLE_ID`
3. The code doesn't care about the name, only the ID

## Production Deployment

When deploying to Vercel:
1. Add environment variables in Vercel dashboard
2. Include `DISCORD_GUILD_ID` and `SINGULARITY_ROLE_ID`
3. Update `DISCORD_REDIRECT_URI` to production URL
4. Test login flow on production

---

**Bottom Line:** Only Singularity members get in. Everyone else gets a clear error message. You control access via Discord roles. ⚡
