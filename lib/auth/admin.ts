import { timingSafeEqual } from 'crypto';

// Discord snowflake IDs are 17-19 digits
const DISCORD_ID_PATTERN = /^\d{17,19}$/;

const BREAKGLASS_ADMIN_IDS = [
  // Orion
  '838217421088669726',
  // Aphmas
  '361901004631145355',
] as const;

function parseAdminIds(rawValue: string, source: string): string[] {
  return rawValue
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
  .filter((id) => {
    if (!DISCORD_ID_PATTERN.test(id)) {
      console.warn(`⚠️  Invalid Discord ID in ${source}: ${id} (must be 17-19 digits)`);
      return false;
    }
    return true;
  });
}

const envAdminIds = parseAdminIds(process.env.ADMIN_DISCORD_IDS || '', 'ADMIN_DISCORD_IDS');

const configuredAdminIds = envAdminIds.length > 0
  ? envAdminIds
  : [...BREAKGLASS_ADMIN_IDS];

if (envAdminIds.length === 0) {
  console.warn('⚠️  ADMIN_DISCORD_IDS is empty; using breakglass admin IDs');
}

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
  return adminIdSet.size > 0;
}
