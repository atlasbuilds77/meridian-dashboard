import pool from './pool';
import { encryptApiKey, decryptApiKey, hashApiKey } from '../crypto/encryption';

export interface ApiCredential {
  id: number;
  user_id: number;
  platform: 'tradier' | 'topstepx' | 'webull' | 'polymarket';
  key_name?: string;
  is_active: boolean;
  last_verified?: Date;
  verification_status: 'pending' | 'verified' | 'failed';
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DecryptedCredential extends ApiCredential {
  api_key: string;
  api_secret?: string;
}

/**
 * Store encrypted API credentials
 */
export async function storeApiCredential(
  userId: number,
  platform: string,
  apiKey: string,
  apiSecret?: string,
  keyName?: string
): Promise<ApiCredential> {
  const { encrypted, iv, authTag } = encryptApiKey(apiKey);
  
  let encryptedSecret = null;
  let secretIv = null;
  let secretAuthTag = null;
  
  if (apiSecret) {
    const secretEncryption = encryptApiKey(apiSecret);
    encryptedSecret = secretEncryption.encrypted;
    secretIv = secretEncryption.iv;
    secretAuthTag = secretEncryption.authTag;
  }
  
  // Store encrypted_api_key as "encrypted:authTag" format
  const encryptedKeyWithTag = `${encrypted}:${authTag}`;
  const encryptedSecretWithTag = encryptedSecret 
    ? `${encryptedSecret}:${secretAuthTag}` 
    : null;
  // For secrets, store their IV separately (use secretIv if exists, otherwise null)
  // Main encryption_iv is for the API key
  
  const result = await pool.query(
    `INSERT INTO api_credentials (
      user_id, platform, encrypted_api_key, encrypted_api_secret, 
      encryption_iv, key_name, verification_status
    ) 
    VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    ON CONFLICT (user_id, platform) 
    DO UPDATE SET 
      encrypted_api_key = EXCLUDED.encrypted_api_key,
      encrypted_api_secret = EXCLUDED.encrypted_api_secret,
      encryption_iv = EXCLUDED.encryption_iv,
      key_name = EXCLUDED.key_name,
      verification_status = 'pending',
      updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      userId,
      platform,
      encryptedKeyWithTag,
      encryptedSecretWithTag,
      iv,
      keyName || `${platform} API Key`,
    ]
  );
  
  return result.rows[0] as ApiCredential;
}

/**
 * Get and decrypt user's API credentials for a platform
 */
export async function getApiCredential(
  userId: number,
  platform: string
): Promise<DecryptedCredential | null> {
  const result = await pool.query(
    `SELECT * FROM api_credentials 
     WHERE user_id = $1 AND platform = $2 AND is_active = true`,
    [userId, platform]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  
  try {
    // Parse encrypted key and auth tag
    const [encryptedKey, authTag] = row.encrypted_api_key.split(':');
    const apiKey = decryptApiKey(encryptedKey, row.encryption_iv, authTag);
    
    let apiSecret: string | undefined;
    if (row.encrypted_api_secret) {
      const [ivPart, authTagPart] = row.encryption_iv.split(':');
      const [encryptedSecretPart] = row.encrypted_api_secret.split(':');
      apiSecret = decryptApiKey(encryptedSecretPart, ivPart, authTagPart);
    }
    
    return {
      ...row,
      api_key: apiKey,
      api_secret: apiSecret,
    };
  } catch (error) {
    console.error(`Failed to decrypt API credential for user ${userId}, platform ${platform}:`, error);
    return null;
  }
}

/**
 * Get all platforms user has configured
 */
export async function getUserPlatforms(userId: number): Promise<ApiCredential[]> {
  const result = await pool.query(
    `SELECT id, user_id, platform, key_name, is_active, last_verified, 
            verification_status, error_message, created_at, updated_at
     FROM api_credentials 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  );
  
  return result.rows as ApiCredential[];
}

/**
 * Mark API credential as verified (successful API call)
 */
export async function markCredentialVerified(
  userId: number,
  platform: string,
  accountNumber?: string
): Promise<void> {
  await pool.query(
    `UPDATE api_credentials 
     SET verification_status = 'verified', 
         last_verified = CURRENT_TIMESTAMP,
         error_message = NULL,
         account_number = COALESCE($3, account_number),
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND platform = $2`,
    [userId, platform, accountNumber || null]
  );
}

/**
 * Mark API credential as failed (API call error)
 */
export async function markCredentialFailed(
  userId: number,
  platform: string,
  errorMessage: string
): Promise<void> {
  await pool.query(
    `UPDATE api_credentials 
     SET verification_status = 'failed', 
         error_message = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND platform = $2`,
    [userId, platform, errorMessage]
  );
}

/**
 * Delete API credential
 */
export async function deleteApiCredential(
  userId: number,
  platform: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM api_credentials 
     WHERE user_id = $1 AND platform = $2 
     RETURNING id`,
    [userId, platform]
  );
  
  return result.rowCount! > 0;
}

/**
 * Log API key operation for audit trail
 */
export async function logApiKeyOperation(
  userId: number,
  credentialId: number | null,
  action: string,
  ipAddress?: string,
  userAgent?: string,
  details?: any
): Promise<void> {
  await pool.query(
    `INSERT INTO api_key_audit_log (user_id, credential_id, action, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, credentialId, action, ipAddress, userAgent, JSON.stringify(details || {})]
  );
}
