import { headers } from 'next/headers';

function normalizeOrigin(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function buildOriginFromForwardedHeaders(
  forwardedHost: string | null,
  forwardedProto: string | null
): string | null {
  if (!forwardedHost) {
    return null;
  }

  const host = forwardedHost.split(',')[0]?.trim();
  if (!host) {
    return null;
  }

  const proto = (forwardedProto || 'https').split(',')[0]?.trim() || 'https';
  return `${proto}://${host}`;
}

function getEnvOrigin(): string | null {
  const configured =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (!configured) {
    return null;
  }

  return normalizeOrigin(configured);
}

export async function getPublicOrigin(request: Request): Promise<string> {
  const envOrigin = getEnvOrigin();
  if (envOrigin) {
    return envOrigin;
  }

  const requestHeaders = await headers();
  const forwardedOrigin = buildOriginFromForwardedHeaders(
    requestHeaders.get('x-forwarded-host'),
    requestHeaders.get('x-forwarded-proto')
  );

  if (forwardedOrigin) {
    return forwardedOrigin;
  }

  return new URL(request.url).origin;
}
