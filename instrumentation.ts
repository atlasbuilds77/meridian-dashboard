/**
 * Next.js Instrumentation
 * 
 * This file runs once when the server starts up (before any requests).
 * Perfect place for startup validation checks.
 * 
 * Note: Disabled for now due to Edge Runtime compatibility.
 * Startup checks are now in middleware.ts instead.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Commented out - Edge Runtime doesn't support process.exit
// Startup checks moved to server-side code instead

export async function register() {
  // Startup checks disabled - see middleware.ts
  console.log('✅ Server starting (validation in middleware)');
}
