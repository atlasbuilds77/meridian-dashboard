/**
 * Next.js Instrumentation
 * 
 * This file runs once when the server starts up (before any requests).
 * Perfect place for startup validation checks.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { runStartupChecks } from './lib/startup-checks';

export async function register() {
  // Only run startup checks on server (not in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    runStartupChecks();
  }
}
