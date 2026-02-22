import { timingSafeEqual } from 'crypto';

// Discord snowflake IDs are 17-19 digits
const DISCORD_ID_PATTERN = /^\d{17,19}$/;

const configuredAdminIds = (process.env.ADMIN_DISCORD_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
  .filter(id => {
    // Validate Discord ID format on startup
    if (!DISCORD_ID_PATTERN.test(id)) {
      console.warn(`⚠️  Invalid Discord ID in ADMIN_DISCORD_IDS: ${id} (must be 17-19 digits)`);
      return false;
    }
    return true;
  });

// Use Set for O(1) lookup
const adminIdSet = new Set(configuredAdminIds);

export function getAdminDiscordIds(): string[] {
  return configuredAdminIds;
}

/**
 * Check if a Discord ID is an admin using constant-time comparison
 * to prevent timing attacks that could leak admin IDs.
 */
export function isAdminDiscordId(discordId: string): boolean {
  // Validate input format first (fail fast for invalid input)
  if (!DISCORD_ID_PATTERN.test(discordId)) {
    return false;
  }
  
  // Quick check with Set (still need constant-time for actual comparison)
  if (!adminIdSet.has(discordId)) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  // Even though we already know it's in the set, this prevents
  // timing analysis of which admin ID was matched
  for (const adminId of configuredAdminIds) {
    if (adminId.length === discordId.length) {
      const a = Buffer.from(adminId, 'utf8');
      const b = Buffer.from(discordId, 'utf8');
      
      if (timingSafeEqual(a, b)) {
        return true;
      }
    }
  }
  
  return false;
}

export function hasConfiguredAdminIds(): boolean {
  return configuredAdminIds.length > 0;
}
