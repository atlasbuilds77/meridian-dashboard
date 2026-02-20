import { NextResponse } from 'next/server';
import fs from 'fs';

const DATA_PATH = '/Users/atlasbuilds/clawd/meridian-trader/backtest_results.json';

export async function GET() {
  try {
    const data = fs.readFileSync(DATA_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    
    return NextResponse.json({
      trades: parsed.trades || [],
      total: parsed.trades?.length || 0
    });
  } catch (error) {
    console.error('Error reading trades:', error);
    return NextResponse.json({ 
      trades: [], 
      total: 0,
      error: 'Failed to load trades' 
    }, { status: 500 });
  }
}
