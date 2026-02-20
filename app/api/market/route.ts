import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TRADIER_TOKEN = process.env.TRADIER_TOKEN || 'jj8L3RuSVG5MUwUpz2XHrjXjAFrq';
const TRADIER_BASE_URL = 'https://api.tradier.com';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'QQQ';

  try {
    // Fetch current quote
    const quoteResponse = await fetch(
      `${TRADIER_BASE_URL}/v1/markets/quotes?symbols=${symbol}`,
      {
        headers: {
          'Authorization': `Bearer ${TRADIER_TOKEN}`,
          'Accept': 'application/json'
        },
        next: { revalidate: 0 }
      }
    );

    if (!quoteResponse.ok) {
      throw new Error(`Tradier API error: ${quoteResponse.status}`);
    }

    const quoteData = await quoteResponse.json();
    const quote = quoteData.quotes?.quote;

    if (!quote) {
      throw new Error('No quote data available');
    }

    const price = quote.last || quote.close || 0;
    const change = quote.change || 0;
    const changePercent = quote.change_percentage || 0;
    const volume = quote.volume || 0;
    const open = quote.open || price;
    const high = quote.high || price;
    const low = quote.low || price;

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      price,
      change,
      changePercent,
      volume,
      open,
      high,
      low,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Market data error:', error);
    
    // Return mock data if API fails
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      price: 608.50,
      change: 2.15,
      changePercent: 0.35,
      volume: 45678900,
      open: 606.35,
      high: 610.25,
      low: 605.80,
      timestamp: new Date().toISOString(),
      error: 'Live data unavailable - using fallback'
    });
  }
}
