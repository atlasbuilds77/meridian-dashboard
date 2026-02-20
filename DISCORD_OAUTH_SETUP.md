# Discord OAuth Setup Guide

## Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "Meridian Dashboard" (or whatever you prefer)
4. Click "Create"

## Step 2: Configure OAuth2 Settings

1. In your application, go to the "OAuth2" tab in the left sidebar

2. **Get Credentials:**
   - Copy your **Client ID**
   - Copy your **Client Secret** (click "Reset Secret" if needed)

3. **Set Bot Permissions (IMPORTANT):**
   - Scroll down to "Bot Permissions"
   - Check these permissions:
     - `guilds` (View basic server info)
     - `guilds.members.read` (View server members - REQUIRED for role checking)

## Step 3: Add Redirect URI

1. Still in the OAuth2 tab, scroll down to "Redirects"
2. Click "Add Redirect"
3. Add these URIs:
   - **Local development:** `http://localhost:3000/api/auth/discord/callback`
   - **Production (when deployed):** `https://your-domain.vercel.app/api/auth/discord/callback`
4. Click "Save Changes"

## Step 4: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Discord credentials:
   ```env
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_CLIENT_SECRET=your_client_secret_here
   DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
   
   # Both regular and NEXT_PUBLIC_ version needed
   NEXT_PUBLIC_DISCORD_CLIENT_ID=your_client_id_here
   
   # Optional: Restrict to specific Discord users
   AUTHORIZED_DISCORD_USERS=123456789012345678,987654321098765432
   ```

## Step 5: Get Discord Server & Role IDs (REQUIRED - Singularity Tier Only)

**This dashboard is restricted to Singularity tier members only.**

1. **Enable Developer Mode in Discord:**
   - Open Discord → User Settings → Advanced → Developer Mode (toggle ON)

2. **Get Your Discord Server (Guild) ID:**
   - Right-click on your server name (top-left) → "Copy Server ID"
   - This is your `DISCORD_GUILD_ID`

3. **Get the Singularity Role ID:**
   - Go to Server Settings → Roles
   - Find the "Singularity" role (or whatever you call your premium tier)
   - Right-click the role → "Copy Role ID"
   - This is your `SINGULARITY_ROLE_ID`

4. **Add to `.env.local`:**
   ```env
   DISCORD_GUILD_ID=123456789012345678
   SINGULARITY_ROLE_ID=987654321098765432
   ```

**IMPORTANT:** Only users who are in your Discord server AND have the Singularity role can access the dashboard.

## Step 6: Test Locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`

3. You should be redirected to `/login`

4. Click "Login with Discord"

5. Authorize the application

6. You should be redirected back to the dashboard with your Discord avatar in the top-right

## Step 7: Deploy to Production (Vercel)

1. Add environment variables in Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add all variables from `.env.local`
   - Update `DISCORD_REDIRECT_URI` to use your production domain

2. Redeploy your application

3. Test the production login flow

## Troubleshooting

### "Access denied. Singularity tier required."
- Make sure the user has the Singularity role in your Discord server
- Verify `SINGULARITY_ROLE_ID` in `.env.local` matches the actual role ID
- Right-click the role in Server Settings → Roles to confirm the ID

### "You must be a member of the trading Discord server."
- User needs to join your Discord server first
- Verify `DISCORD_GUILD_ID` in `.env.local` is correct
- Right-click your server name → "Copy Server ID" to confirm

### "Auth Failed" Error
- Verify your Client ID and Client Secret are correct
- Make sure the Redirect URI matches exactly (including http vs https)
- Check that you've added the redirect URI in Discord Developer Portal

### Session Expires Too Fast
- Default session duration is 7 days
- Edit `app/api/auth/discord/callback/route.ts` to change `expiresAt` calculation

### How to Verify User Has Singularity Role
1. In Discord, go to your server
2. Right-click the user → "Roles"
3. Confirm they have the Singularity role assigned
4. If not, assign it: Server Settings → Members → Find user → Add role

### Role Not Being Detected
- Make sure you requested the `guilds.members.read` scope in OAuth2 settings
- Clear your browser cookies and try logging in again
- Check the server console logs for detailed error messages

## Security Notes

- **Never commit `.env.local`** to version control (it's in .gitignore)
- Keep your Client Secret safe - regenerate it if it's ever exposed
- Use HTTPS in production (Vercel does this automatically)
- Session cookies are httpOnly and secure in production
