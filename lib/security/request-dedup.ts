/**
 * Request Deduplication
 * 
 * Prevents rapid-fire duplicate API requests that could cause:
 * - Multiple identical orders being placed
 * - Race conditions in database writes
 * - Unnecessary API calls
 * 
 * Uses an in-memory store with automatic cleanup.
 */

interface RequestKey {
  userId: string;
  endpoint: string;
  method: string;
  bodyHash?: string;
}

interface PendingRequest {
  timestamp: number;
  expiresAt: number;
}

// In-memory store: Map<requestId, PendingRequest>
const pendingRequests = new Map<string, PendingRequest>();

// Cleanup interval (every 60 seconds)
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Generate a unique request identifier
 */
function generateRequestId(key: RequestKey): string {
  const parts = [key.userId, key.endpoint, key.method];
  if (key.bodyHash) {
    parts.push(key.bodyHash);
  }
  return parts.join(':');
}

/**
 * Hash request body for deduplication
 */
async function hashRequestBody(body: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(body);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for environments without crypto.subtle
  return Buffer.from(body).toString('base64');
}

/**
 * Start cleanup timer if not already running
 */
function ensureCleanupTimer() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, request] of pendingRequests.entries()) {
        if (request.expiresAt < now) {
          pendingRequests.delete(id);
        }
      }
      
      // Stop timer if no pending requests
      if (pendingRequests.size === 0 && cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }
    }, CLEANUP_INTERVAL_MS);
  }
}

/**
 * Check if a request is a duplicate and mark it as pending
 * 
 * @param userId - User making the request
 * @param endpoint - API endpoint path
 * @param method - HTTP method
 * @param body - Request body (optional, for POST/PUT/PATCH)
 * @param windowMs - Deduplication window in milliseconds (default: 2000ms)
 * @returns true if duplicate, false if unique
 */
export async function isDuplicateRequest(
  userId: string,
  endpoint: string,
  method: string,
  body?: string,
  windowMs: number = 2000
): Promise<boolean> {
  const key: RequestKey = {
    userId,
    endpoint,
    method,
  };

  // Hash body for POST/PUT/PATCH to detect identical payloads
  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    key.bodyHash = await hashRequestBody(body);
  }

  const requestId = generateRequestId(key);
  const now = Date.now();
  const existing = pendingRequests.get(requestId);

  // Check if duplicate within window
  if (existing && existing.expiresAt > now) {
    console.warn('[Request Dedup] Duplicate request blocked:', {
      userId,
      endpoint,
      method,
      age: now - existing.timestamp,
      windowMs,
    });
    return true;
  }

  // Mark as pending
  pendingRequests.set(requestId, {
    timestamp: now,
    expiresAt: now + windowMs,
  });

  ensureCleanupTimer();
  return false;
}

/**
 * Clear a pending request (call after request completes)
 */
export function clearPendingRequest(
  userId: string,
  endpoint: string,
  method: string
): void {
  const key: RequestKey = { userId, endpoint, method };
  const requestId = generateRequestId(key);
  pendingRequests.delete(requestId);
}

/**
 * Get stats about pending requests (for debugging)
 */
export function getDeduplicationStats() {
  return {
    pendingCount: pendingRequests.size,
    oldestRequest: Array.from(pendingRequests.values()).reduce(
      (oldest, req) => Math.min(oldest, req.timestamp),
      Date.now()
    ),
  };
}
