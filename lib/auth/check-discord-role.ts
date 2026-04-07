import { getSession } from '@/lib/auth/session';

/**
 * Check if the current user has a specific Discord role.
 *
 * Uses the Discord Bot API (requires DISCORD_BOT_TOKEN) to look up the
 * member's roles in the configured guild.  Falls back gracefully when the
 * bot token is missing — in that case the check always fails (safe default).
 *
 * This is a *server-only* helper — never import from client components.
 */

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

export async function currentUserHasRole(roleId: string): Promise<boolean> {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !roleId) {
    return false;
  }

  const session = await getSession();
  if (!session) return false;

  return userHasDiscordRole(session.discordId, roleId);
}

export async function userHasDiscordRole(
  discordUserId: string,
  roleId: string,
): Promise<boolean> {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !roleId) {
    return false;
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}`,
      {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        signal: AbortSignal.timeout(8_000),
        cache: 'no-store',
      },
    );

    if (!res.ok) return false;

    const member = (await res.json()) as { roles?: string[] };
    return (member.roles ?? []).includes(roleId);
  } catch {
    console.error('[check-discord-role] Failed to check role for', discordUserId);
    return false;
  }
}
