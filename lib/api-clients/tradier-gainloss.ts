/**
 * Tradier Gain/Loss API Client
 * 
 * Uses Tradier's /gainloss endpoint to get ACTUAL P&L from closed positions.
 * This is the source of truth for all P&L calculations.
 * 
 * https://documentation.tradier.com/brokerage-api/accounts/get-account-gainloss
 */

const TRADIER_API_BASE = 'https://api.tradier.com/v1';

export interface TradierClosedPosition {
  close_date: string;      // "2018-10-31T00:00:00.000Z"
  cost: number;            // Total cost of the position
  gain_loss: number;       // Actual P&L from Tradier
  gain_loss_percent: number; // P&L as percentage
  open_date: string;       // "2018-06-19T00:00:00.000Z"
  proceeds: number;        // Total amount received
  quantity: number;        // Number of shares/contracts
  symbol: string;          // "GE" or "SPY180625C00276000"
  term: number;            // Days position was held
}

export interface TradierGainLossResponse {
  gainloss: {
    closed_position: TradierClosedPosition | TradierClosedPosition[] | null;
  } | null;
}

/**
 * Parse option symbol to extract underlying, expiry, type, and strike
 * Format: SPY180625C00276000 = SPY, 2018-06-25, CALL, $276.00
 */
export function parseOptionSymbol(symbol: string): {
  underlying: string;
  expiry: string;
  type: 'CALL' | 'PUT';
  strike: number;
} | null {
  // Option symbols: UNDERLYING + YYMMDD + C/P + 8-digit strike (price * 1000)
  // Example: QQQ260224C00607000 = QQQ, 2026-02-24, CALL, $607.00
  const match = symbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
  if (!match) return null;

  const [, underlying, dateStr, typeChar, strikeStr] = match;
  
  // Parse date: YYMMDD
  const year = 2000 + parseInt(dateStr.slice(0, 2), 10);
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  const expiry = `${year}-${month}-${day}`;

  // Parse strike: 8 digits = price * 1000
  const strike = parseInt(strikeStr, 10) / 1000;

  return {
    underlying,
    expiry,
    type: typeChar === 'C' ? 'CALL' : 'PUT',
    strike,
  };
}

/**
 * Determine if a symbol is an option
 */
export function isOptionSymbol(symbol: string): boolean {
  return /^[A-Z]+\d{6}[CP]\d{8}$/.test(symbol);
}

/**
 * Fetch gain/loss data from Tradier API
 */
export async function fetchTradierGainLoss(
  accountNumber: string,
  accessToken: string,
  options?: {
    page?: number;
    limit?: number;
    sortBy?: 'closeDate' | 'openDate';
    sort?: 'asc' | 'desc';
    start?: string; // YYYY-MM-DD
    end?: string;   // YYYY-MM-DD
  }
): Promise<TradierClosedPosition[]> {
  const params = new URLSearchParams();
  
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.sortBy) params.set('sortBy', options.sortBy);
  if (options?.sort) params.set('sort', options.sort);
  if (options?.start) params.set('start', options.start);
  if (options?.end) params.set('end', options.end);

  const url = `${TRADIER_API_BASE}/accounts/${accountNumber}/gainloss${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tradier API error (${response.status}): ${errorText}`);
  }

  const data: TradierGainLossResponse = await response.json();

  // Handle empty response
  if (!data.gainloss || !data.gainloss.closed_position) {
    return [];
  }

  // Normalize to array (Tradier returns single object if only one position)
  const positions = data.gainloss.closed_position;
  return Array.isArray(positions) ? positions : [positions];
}

/**
 * Fetch ALL gain/loss records (handles pagination)
 */
export async function fetchAllTradierGainLoss(
  accountNumber: string,
  accessToken: string,
  options?: {
    start?: string;
    end?: string;
  }
): Promise<TradierClosedPosition[]> {
  const allPositions: TradierClosedPosition[] = [];
  let page = 1;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const positions = await fetchTradierGainLoss(accountNumber, accessToken, {
      page,
      limit,
      sortBy: 'closeDate',
      sort: 'desc',
      start: options?.start,
      end: options?.end,
    });

    allPositions.push(...positions);

    // If we got fewer than limit, we're done
    if (positions.length < limit) {
      hasMore = false;
    } else {
      page++;
    }

    // Safety limit to prevent infinite loops
    if (page > 100) {
      console.warn('[TradierGainLoss] Hit pagination safety limit (10,000 records)');
      break;
    }
  }

  return allPositions;
}

/**
 * Create a unique ID for a closed position (for deduplication)
 */
export function createPositionId(position: TradierClosedPosition, accountNumber: string): string {
  // Use account + symbol + open date + close date + quantity for uniqueness
  return `${accountNumber}_${position.symbol}_${position.open_date}_${position.close_date}_${position.quantity}`;
}

/**
 * Convert Tradier closed position to database trade format
 */
export function positionToTrade(
  position: TradierClosedPosition,
  userId: number,
  accountNumber: string
): {
  user_id: number;
  tradier_position_id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'CALL' | 'PUT';
  asset_type: 'stock' | 'option';
  strike: number | null;
  expiry: string | null;
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_date: Date;
  exit_date: Date;
  pnl: number;
  pnl_percent: number;
  status: 'closed';
  notes: string;
} {
  const isOption = isOptionSymbol(position.symbol);
  const optionDetails = isOption ? parseOptionSymbol(position.symbol) : null;

  // Calculate per-share/contract prices from totals
  const entryPrice = position.cost / position.quantity;
  const exitPrice = position.proceeds / position.quantity;

  // For options, determine direction from symbol (C=CALL, P=PUT)
  // For stocks, determine from P&L relationship to price movement
  let direction: 'LONG' | 'SHORT' | 'CALL' | 'PUT';
  if (optionDetails) {
    direction = optionDetails.type;
  } else {
    // For stocks: if we made money when price went up, we were LONG
    // This is a simplification - Tradier P&L is already calculated correctly
    direction = position.gain_loss >= 0 ? 'LONG' : 'LONG'; // Default to LONG for stocks
  }

  return {
    user_id: userId,
    tradier_position_id: createPositionId(position, accountNumber),
    symbol: position.symbol,
    direction,
    asset_type: isOption ? 'option' : 'stock',
    strike: optionDetails?.strike ?? null,
    expiry: optionDetails?.expiry ?? null,
    entry_price: entryPrice,
    exit_price: exitPrice,
    quantity: position.quantity,
    entry_date: new Date(position.open_date),
    exit_date: new Date(position.close_date),
    pnl: position.gain_loss,           // DIRECTLY FROM TRADIER - source of truth
    pnl_percent: position.gain_loss_percent,
    status: 'closed',
    notes: `Synced from Tradier gainloss | Cost: $${position.cost.toFixed(2)} | Proceeds: $${position.proceeds.toFixed(2)} | Term: ${position.term} days`,
  };
}

/**
 * Validate that a trade's P&L makes sense
 * Returns null if valid, error message if invalid
 */
export function validateTradePnl(trade: {
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  direction: string;
  asset_type: string;
}): string | null {
  // For options/futures, multiplier is typically 100
  const multiplier = (trade.asset_type === 'option' || trade.asset_type === 'future') ? 100 : 1;
  
  // Calculate expected P&L
  const priceDiff = trade.exit_price - trade.entry_price;
  const isLong = ['LONG', 'CALL'].includes(trade.direction.toUpperCase());
  const expectedPnl = isLong 
    ? priceDiff * trade.quantity * multiplier
    : -priceDiff * trade.quantity * multiplier;

  // Allow 10% tolerance for rounding/fees
  const tolerance = Math.abs(expectedPnl) * 0.1 + 1; // +$1 for small trades
  const diff = Math.abs(trade.pnl - expectedPnl);

  if (diff > tolerance && Math.abs(trade.pnl) > 1) {
    return `P&L mismatch: expected ~$${expectedPnl.toFixed(2)}, got $${trade.pnl.toFixed(2)} (diff: $${diff.toFixed(2)})`;
  }

  return null;
}
