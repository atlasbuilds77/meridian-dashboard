import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TRADIER_BASE_URL = 'https://api.tradier.com';
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.\-]{0,15}$/;

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'market_quote',
    limit: 120,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'market_quote');
  }

  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  const tradierToken = process.env.TRADIER_TOKEN;
  if (!tradierToken) {
    return NextResponse.json({ error: 'Tradier token is not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const rawSymbol = (searchParams.get('symbol') || 'QQQ').trim().toUpperCase();
  const symbol = SYMBOL_PATTERN.test(rawSymbol) ? rawSymbol : 'QQQ';

  try {
    const quoteResponse = await fetch(
      `${TRADIER_BASE_URL}/v1/markets/quotes?symbols=${encodeURIComponent(symbol)}`,
      {
        headers: {
          Authorization: `Bearer ${tradierToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      }
    );

    if (!quoteResponse.ok) {
      return NextResponse.json(
        { error: `Tradier API request failed with status ${quoteResponse.status}` },
        { status: 502 }
      );
    }

    const quoteData = (await quoteResponse.json()) as {
      quotes?: {
        quote?: {
          last?: number;
          close?: number;
          change?: number;
          change_percentage?: number;
          volume?: number;
          open?: number;
          high?: number;
          low?: number;
        };
      };
    };

    const quote = quoteData.quotes?.quote;
    if (!quote) {
      return NextResponse.json({ error: 'No quote data available' }, { status: 502 });
    }

    const price = quote.last || quote.close || 0;

    return NextResponse.json({
      symbol,
      price,
      change: quote.change || 0,
      changePercent: quote.change_percentage || 0,
      volume: quote.volume || 0,
      open: quote.open || price,
      high: quote.high || price,
      low: quote.low || price,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Market data fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 503 });
  }
}
