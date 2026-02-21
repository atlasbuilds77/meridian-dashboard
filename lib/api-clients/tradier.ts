/**
 * Tradier API Client (READ-ONLY)
 * Fetches account balances, positions, and trade history
 * https://documentation.tradier.com/brokerage-api
 */

const TRADIER_API_BASE = 'https://api.tradier.com/v1';
const TRADIER_SANDBOX_BASE = 'https://sandbox.tradier.com/v1';

export interface TradierBalance {
  account_number: string;
  account_type: string; // 'cash', 'margin', 'pdt'
  option_level: number;
  total_equity: number;
  total_cash: number;
  market_value: number; // Current position value
  buying_power: number;
  cash_available: number;
  day_trade_buying_power: number;
  maintenance_excess: number;
  option_buying_power: number;
}

export interface TradierPosition {
  symbol: string;
  quantity: number;
  cost_basis: number;
  date_acquired: string;
  id: number;
}

export interface TradierHistory {
  event: {
    trade?: {
      commission: number;
      description: string;
      price: number;
      quantity: number;
      symbol: string;
      trade_type: 'equity' | 'option';
      date: string;
    };
  }[];
}

export class TradierClient {
  private apiKey: string;
  private useSandbox: boolean;
  
  constructor(apiKey: string, useSandbox = false) {
    this.apiKey = apiKey;
    this.useSandbox = useSandbox;
  }
  
  private getBaseUrl(): string {
    return this.useSandbox ? TRADIER_SANDBOX_BASE : TRADIER_API_BASE;
  }
  
  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tradier API error (${response.status}): ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Get user profile (verify API key works)
   */
  async getProfile(): Promise<{ profile: { id: string; name: string; account: { account_number: string } } }> {
    return this.fetch('/user/profile');
  }
  
  /**
   * Get account balances
   */
  async getBalances(accountNumber: string): Promise<TradierBalance> {
    const data = await this.fetch<{ balances: TradierBalance }>(`/accounts/${accountNumber}/balances`);
    return data.balances;
  }
  
  /**
   * Get current positions
   */
  async getPositions(accountNumber: string): Promise<TradierPosition[]> {
    const data = await this.fetch<{ positions: { position: TradierPosition[] } | null }>(
      `/accounts/${accountNumber}/positions`
    );
    return data.positions?.position || [];
  }
  
  /**
   * Get trade history
   */
  async getHistory(accountNumber: string, limit = 100): Promise<TradierHistory> {
    return this.fetch(`/accounts/${accountNumber}/history?limit=${limit}`);
  }
  
  /**
   * Get account summary (balance + positions)
   */
  async getAccountSummary(accountNumber: string) {
    const [balances, positions] = await Promise.all([
      this.getBalances(accountNumber),
      this.getPositions(accountNumber),
    ]);
    
    return {
      balances,
      positions,
      total_value: balances.total_equity,
      cash: balances.total_cash,
      positions_value: balances.market_value,
    };
  }
}

/**
 * Verify Tradier API key works
 */
export async function verifyTradierKey(apiKey: string, useSandbox = false): Promise<{
  valid: boolean;
  accountNumber?: string;
  error?: string;
}> {
  try {
    const client = new TradierClient(apiKey, useSandbox);
    const response = await client.getProfile();
    
    if (response.profile?.account?.account_number) {
      return {
        valid: true,
        accountNumber: response.profile.account.account_number,
      };
    }
    
    return {
      valid: false,
      error: 'No account found in profile',
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid API key',
    };
  }
}
