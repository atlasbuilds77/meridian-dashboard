/**
 * Startup Validation
 * 
 * Validates all required environment variables and their constraints
 * before the application starts. Fails fast with clear error messages.
 */

const REQUIRED_SECRETS = [
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DATABASE_URL',
] as const;

const OPTIONAL_SECRETS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'DISCORD_GUILD_ID',
  'SINGULARITY_ROLE_ID',
  'ADMIN_DISCORD_IDS',
] as const;

interface ValidationError {
  variable: string;
  issue: string;
}

/**
 * Validate all required secrets are present and meet security requirements
 */
export function validateRequiredSecrets(): void {
  const errors: ValidationError[] = [];
  
  // Check all required secrets exist
  for (const key of REQUIRED_SECRETS) {
    if (!process.env[key]) {
      errors.push({
        variable: key,
        issue: 'Missing required environment variable',
      });
    }
  }
  
  // If any are missing, fail fast
  if (errors.length > 0) {
    console.error('\n❌ FATAL: Missing required environment variables:\n');
    errors.forEach(({ variable, issue }) => {
      console.error(`  - ${variable}: ${issue}`);
    });
    console.error('\nApplication cannot start without these variables.\n');
    process.exit(1);
  }
  
  // Validate SESSION_SECRET length
  const sessionSecret = process.env.SESSION_SECRET!;
  if (sessionSecret.length < 32) {
    errors.push({
      variable: 'SESSION_SECRET',
      issue: 'Must be at least 32 characters. Generate with: openssl rand -base64 32',
    });
  }
  
  // Validate ENCRYPTION_KEY is base64 and sufficient length
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  try {
    const decoded = Buffer.from(encryptionKey, 'base64');
    if (decoded.length < 32) {
      errors.push({
        variable: 'ENCRYPTION_KEY',
        issue: 'Must be at least 32 bytes when base64 decoded. Generate with: openssl rand -base64 32',
      });
    }
  } catch {
    errors.push({
      variable: 'ENCRYPTION_KEY',
      issue: 'Must be valid base64. Generate with: openssl rand -base64 32',
    });
  }
  
  // Validate DATABASE_URL format
  const databaseUrl = process.env.DATABASE_URL!;
  if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
    errors.push({
      variable: 'DATABASE_URL',
      issue: 'Must be a valid PostgreSQL connection string',
    });
  }
  
  // Production-specific validations
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Require SSL in production
    if (process.env.DATABASE_SSL !== 'true') {
      errors.push({
        variable: 'DATABASE_SSL',
        issue: 'Must be "true" in production',
      });
    }
    
    if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
      errors.push({
        variable: 'DATABASE_SSL_REJECT_UNAUTHORIZED',
        issue: 'Cannot be "false" in production (security risk)',
      });
    }
    
    // Warn about optional but recommended secrets in production
    for (const key of OPTIONAL_SECRETS) {
      if (!process.env[key]) {
        console.warn(`⚠️  WARNING: ${key} not set (optional but recommended for production)`);
      }
    }
  }
  
  // If any validation failed, exit
  if (errors.length > 0) {
    console.error('\n❌ FATAL: Environment variable validation failed:\n');
    errors.forEach(({ variable, issue }) => {
      console.error(`  - ${variable}: ${issue}`);
    });
    console.error('\nFix these issues before starting the application.\n');
    process.exit(1);
  }
  
  console.log('✅ All required secrets validated');
}

/**
 * Run all startup checks
 */
export function runStartupChecks(): void {
  console.log('🔒 Running security startup checks...');
  
  try {
    validateRequiredSecrets();
    console.log('✅ Startup checks passed\n');
  } catch (error) {
    console.error('❌ Startup checks failed:', error);
    process.exit(1);
  }
}
