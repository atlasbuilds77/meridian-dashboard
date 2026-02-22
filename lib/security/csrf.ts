/**
 * CSRF Protection Utilities
 * 
 * Protects against Cross-Site Request Forgery attacks by requiring
 * a valid CSRF token for all state-changing operations (POST/PATCH/DELETE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import { getUserIdFromSession } from '@/lib/auth/session';

const CSRF_SECRET = process.env.SESSION_SECRET;

if (!CSRF_SECRET || CSRF_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters for CSRF protection');
}

/**
 * Generate a CSRF token for the current session
 */
export function generateCsrfToken(userId: number): string {
  const timestamp = Date.now().toString();
  const random = randomBytes(16).toString('hex');
  const payload = `${userId}:${timestamp}:${random}`;
  
  const hmac = createHmac('sha256', CSRF_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(token: string, userId: number): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    
    if (parts.length !== 4) return false;
    
    const [tokenUserId, timestamp, random, signature] = parts;
    
    // Verify user ID matches
    if (parseInt(tokenUserId, 10) !== userId) return false;
    
    // Verify token isn't expired (1 hour)
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (now - tokenTime > 60 * 60 * 1000) return false;
    
    // Verify signature
    const payload = `${tokenUserId}:${timestamp}:${random}`;
    const hmac = createHmac('sha256', CSRF_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Middleware to enforce CSRF protection on state-changing requests
 */
export async function requireCsrfToken(request: NextRequest): Promise<NextResponse | null> {
  const method = request.method;
  
  // Only enforce CSRF on state-changing methods
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    return null; // Allow request to proceed
  }
  
  // Get user ID from session
  const userId = await getUserIdFromSession();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Extract CSRF token from header
  const csrfToken = request.headers.get('x-csrf-token');
  if (!csrfToken) {
    return NextResponse.json(
      { error: 'CSRF token required', code: 'CSRF_TOKEN_MISSING' },
      { status: 403 }
    );
  }
  
  // Validate token
  if (!validateCsrfToken(csrfToken, userId)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token', code: 'CSRF_TOKEN_INVALID' },
      { status: 403 }
    );
  }
  
  // Token valid, allow request to proceed
  return null;
}

/**
 * Helper to extract CSRF token from request (for use in route handlers)
 */
export async function validateCsrfFromRequest(request: NextRequest): Promise<{
  valid: boolean;
  response?: NextResponse;
}> {
  const errorResponse = await requireCsrfToken(request);
  
  if (errorResponse) {
    return { valid: false, response: errorResponse };
  }
  
  return { valid: true };
}
