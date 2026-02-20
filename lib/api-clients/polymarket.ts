/**
 * Polymarket API Client (READ-ONLY)
 * Fetches market positions and bet history
 * https://docs.polymarket.com/
 */

const POLYMARKET_API_BASE = 'https://gamma-api.polymarket.com';
const POLYMARKET_CLOB_BASE = 'https://clob.polymarket.com';

export interface PolymarketPosition {
  market: string;
  question: string;
  outcome: string;
  size: number; // Number of shares
  price: number; // Average entry price
  current_price: number;
  value: number; // Current value (size * current_price)
  pnl: number;
  pnl_percent: number;
}

export interface PolymarketBalance {
  total_balance: number; // USDC balance
  available_balance: number;
  locked_in_positions: number;
}

export class PolymarketClient {
  private apiKey: string;
  private apiSecret?: string;
  
  constructor(apiKey: string, apiSecret?: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }
  
  private async fetch<T>(endpoint: string, base = POLYMARKET_API_BASE): Promise<T> {
    const url = `${base}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    // If API key provided, add auth
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Polymarket API error (${response.status}): ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Get user balance
   */
  async getBalance(address: string): Promise<PolymarketBalance> {
    // Polymarket uses wallet address as identifier
    const data = await this.fetch<{ balance: string }>(`/balance/${address}`);
    
    const balance = parseFloat(data.balance) / 1e6; // Convert from USDC smallest unit
    
    return {
      total_balance: balance,
      available_balance: balance, // TODO: Calculate from positions
      locked_in_positions: 0, // TODO: Calculate from open positions
    };
  }
  
  /**
   * Get user's open positions
   */
  async getPositions(address: string): Promise<PolymarketPosition[]> {
    // This endpoint might require authentication
    const data = await this.fetch<any[]>(`/positions/${address}`);
    
    return data.map((pos: any) => ({
      market: pos.market_slug || pos.market,
      question: pos.question || 'Unknown',
      outcome: pos.outcome,
      size: parseFloat(pos.size || 0),
      price: parseFloat(pos.price || 0),
      current_price: parseFloat(pos.current_price || 0),
      value: parseFloat(pos.value || 0),
      pnl: parseFloat(pos.pnl || 0),
      pnl_percent: parseFloat(pos.pnl_percent || 0),
    }));
  }
  
  /**
   * Get user's trade history
   */
  async getTradeHistory(address: string, limit = 100): Promise<any[]> {
    return this.fetch(`/trades/${address}?limit=${limit}`);
  }
}

/**
 * Verify Polymarket credentials
 * Note: Polymarket uses wallet address, not traditional API keys
 */
export async function verifyPolymarketAddress(address: string): Promise<{
  valid: boolean;
  balance?: number;
  error?: string;
}> {
  try {
    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return {
        valid: false,
        error: 'Invalid Ethereum address format',
      };
    }
    
    const client = new PolymarketClient(address);
    const balance = await client.getBalance(address);
    
    return {
      valid: true,
      balance: balance.total_balance,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid address or API error',
    };
  }
}
