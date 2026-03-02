import { timingSafeEqual } from 'crypto';
import pool from '@/lib/db/pool';

// Discord snowflake IDs are 17-19 digits
const DISCORD_ID_PATTERN = /^\d{17,19}$/;

const BREAKGLASS_ADMIN_IDS = [
  // Orion
  '838217421088669726',
  // Aphmas
  '361901004631145355',
] as const;

const envAdminIds = (process.env.ADMIN_DISCORD_IDS || '')
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

const configuredAdminIds = envAdminIds.length > 0 ? envAdminIds : [...BREAKGLASS_ADMIN_IDS];

// Use Set for O(1) lookup
const adminIdSet = new Set(configuredAdminIds);

export function getAdminDiscordIds(): string[] {
  return configuredAdminIds;
}

/**
 * Check if a Discord ID is an admin
 * Checks BOTH env var (ADMIN_DISCORD_IDS) AND database (admin_users table)
 */
export async function isAdminDiscordId(discordId: string): Promise<boolean> {
  // Validate input format first (fail fast for invalid input)
  if (!DISCORD_ID_PATTERN.test(discordId)) {
    return false;
  }
  
  // Check env var first (faster, no DB hit)
  if (adminIdSet.has(discordId)) {
    // Constant-time comparison to prevent timing attacks
    for (const adminId of configuredAdminIds) {
      if (adminId.length === discordId.length) {
        const a = Buffer.from(adminId, 'utf8');
        const b = Buffer.from(discordId, 'utf8');
        
        if (timingSafeEqual(a, b)) {
          return true;
        }
      }
    }
  }

  // Check database table (allows runtime admin management)
  try {
    const result = await pool.query(
      `SELECT discord_id FROM admin_users 
       WHERE discord_id = $1 AND is_active = true 
       LIMIT 1`,
      [discordId]
    );
    
    if (result.rows.length > 0) {
      // Still use constant-time comparison for DB result
      const dbId = result.rows[0].discord_id;
      if (dbId.length === discordId.length) {
        const a = Buffer.from(dbId, 'utf8');
        const b = Buffer.from(discordId, 'utf8');
        
        return timingSafeEqual(a, b);
      }
    }
  } catch (error) {
    console.error('Error checking admin_users table:', error);
    // Fall back to env var only if DB fails
  }
  
  return false;
}

/**
 * Synchronous version for middleware (uses env var only)
 * For full check (including DB), use isAdminDiscordId()
 */
export function isAdminDiscordIdSync(discordId: string): boolean {
  if (!DISCORD_ID_PATTERN.test(discordId)) {
    return false;
  }
  
  if (!adminIdSet.has(discordId)) {
    return false;
  }
  
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

/**
 * Add a new admin user (requires existing admin auth)
 */
export async function addAdminUser(
  discordId: string,
  username: string,
  grantedBy: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  if (!DISCORD_ID_PATTERN.test(discordId)) {
    return { success: false, error: 'Invalid Discord ID format' };
  }

  try {
    await pool.query(
      `INSERT INTO admin_users (discord_id, username, granted_by, notes, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (discord_id) 
       DO UPDATE SET 
         username = EXCLUDED.username,
         is_active = true,
         updated_at = CURRENT_TIMESTAMP`,
      [discordId, username, grantedBy, notes || null]
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error adding admin user:', error);
    return { success: false, error: 'Database error' };
  }
}

/**
 * Revoke admin access (soft delete)
 */
export async function revokeAdminUser(
  discordId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await pool.query(
      `UPDATE admin_users 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP 
       WHERE discord_id = $1`,
      [discordId]
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error revoking admin user:', error);
    return { success: false, error: 'Database error' };
  }
}

/**
 * List all active admin users
 */
export async function listAdminUsers(): Promise<Array<{
  discord_id: string;
  username: string | null;
  granted_by: string | null;
  granted_at: Date;
  notes: string | null;
}>> {
  try {
    const result = await pool.query(
      `SELECT discord_id, username, granted_by, granted_at, notes
       FROM admin_users 
       WHERE is_active = true 
       ORDER BY granted_at ASC`
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error listing admin users:', error);
    return [];
  }
}
