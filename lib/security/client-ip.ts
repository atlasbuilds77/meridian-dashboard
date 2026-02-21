import { isIP } from 'node:net';

function normalizeIpCandidate(raw: string): string | undefined {
  let candidate = raw.trim();
  if (!candidate) {
    return undefined;
  }

  candidate = candidate.replace(/^for=/i, '').replace(/^"|"$/g, '').trim();

  // Forwarded header values can include brackets for IPv6: [2001:db8::1]:1234
  if (candidate.startsWith('[')) {
    const endBracket = candidate.indexOf(']');
    if (endBracket > 1) {
      candidate = candidate.slice(1, endBracket);
    }
  } else if (candidate.includes(':') && candidate.includes('.')) {
    // Strip optional port from IPv4 host:port values.
    const [host, maybePort] = candidate.split(':');
    if (host && maybePort && /^\d+$/.test(maybePort)) {
      candidate = host;
    }
  }

  // Strip IPv6 zone index if present (e.g. fe80::1%en0).
  candidate = candidate.split('%')[0]?.trim() || '';

  return isIP(candidate) ? candidate : undefined;
}

function parseForwardedHeader(value: string): string | undefined {
  // RFC 7239: Forwarded: for=203.0.113.43, for="[2001:db8:cafe::17]"
  const tokens = value.split(',');
  for (const token of tokens) {
    const forPart = token
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.toLowerCase().startsWith('for='));

    if (!forPart) {
      continue;
    }

    const normalized = normalizeIpCandidate(forPart);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function parseHeaderValue(value: string): string | undefined {
  const parts = value.split(',');
  for (const part of parts) {
    const normalized = normalizeIpCandidate(part);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

/**
 * Extract a single validated client IP suitable for DB inet columns.
 * Returns undefined when no valid IP is found.
 */
export function extractClientIp(request: Request): string | undefined {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    const parsed = parseHeaderValue(cfIp);
    if (parsed) {
      return parsed;
    }
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const parsed = parseHeaderValue(forwardedFor);
    if (parsed) {
      return parsed;
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    const parsed = parseHeaderValue(realIp);
    if (parsed) {
      return parsed;
    }
  }

  const forwarded = request.headers.get('forwarded');
  if (forwarded) {
    const parsed = parseForwardedHeader(forwarded);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}
