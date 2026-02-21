import { NextResponse } from 'next/server';
import { extractClientIp } from '@/lib/security/client-ip';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  reason?: string;
}

interface RateLimitOptions {
  request: Request;
  name: string;
  limit: number;
  windowMs: number;
  userId?: number | string;
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function buildWindowKey(name: string, identifier: string, windowMs: number): { key: string; resetAt: number } {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  return {
    key: `ratelimit:${name}:${identifier}:${windowStart}`,
    resetAt,
  };
}

async function redisCall(path: string): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return null;
  }

  const response = await fetch(`${REDIS_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Upstash REST error (${response.status})`);
  }

  const data = (await response.json()) as { result?: unknown };
  return data.result;
}

async function incrementCounter(key: string, windowMs: number): Promise<number> {
  const incrementResult = await redisCall(`/incr/${encodeURIComponent(key)}`);
  const counter = Number(incrementResult ?? 0);

  if (counter === 1) {
    await redisCall(`/pexpire/${encodeURIComponent(key)}/${windowMs}`);
  }

  return counter;
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { request, name, limit, windowMs, userId } = options;

  const now = Date.now();
  const defaultResetAt = now + windowMs;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: defaultResetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      reason: 'rate_limit_not_configured',
    };
  }

  const identifier = userId ? `user:${userId}` : `ip:${extractClientIp(request) || 'unknown'}`;
  const { key, resetAt } = buildWindowKey(name, identifier, windowMs);

  try {
    const counter = await incrementCounter(key, windowMs);
    const remaining = Math.max(0, limit - counter);
    const allowed = counter <= limit;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    return {
      allowed,
      limit,
      remaining,
      resetAt,
      retryAfterSeconds,
    };
  } catch (error) {
    console.error('Rate limiter unavailable:', error);
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: defaultResetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      reason: 'rate_limit_error',
    };
  }
}

export function rateLimitExceededResponse(result: RateLimitResult, scope: string): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Too many requests',
      scope,
      retryAfterSeconds: result.retryAfterSeconds,
      resetAt: new Date(result.resetAt).toISOString(),
    },
    { status: 429 }
  );

  response.headers.set('Retry-After', String(result.retryAfterSeconds));
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));

  return response;
}
