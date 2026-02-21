import { NextResponse } from 'next/server';

function buildCspHeader(): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.network"
    : "script-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network";

  const connectSrc = [
    "connect-src 'self'",
    'https://discord.com',
    'https://api.stripe.com',
    'https://r.stripe.com',
    'https://m.stripe.com',
    'https://m.stripe.network',
    'https://q.stripe.com',
    'https://errors.stripe.com',
    'https://merchant-ui-api.stripe.com',
    'https://api.tradier.com',
    'https://helios-px7f.onrender.com',
    'https://nebula.zerogtrading.com',
    process.env.UPSTASH_REDIS_REST_URL || '',
  ]
    .filter(Boolean)
    .join(' ');

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.discordapp.com https://*.stripe.com",
    connectSrc,
    "font-src 'self' data:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', buildCspHeader());

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}
