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
 * Verify Tradier API key works and fetch account details
 * Tries both production and sandbox endpoints automatically
 */
export async function verifyTradierKey(apiKey: string, useSandbox = false): Promise<{
  valid: boolean;
  accountNumber?: string;
  balance?: number;
  buyingPower?: number;
  cashAvailable?: number;
  settledCash?: number;
  error?: string;
  environment?: 'production' | 'sandbox';
}> {
  // Try the specified environment first
  try {
    const client = new TradierClient(apiKey, useSandbox);
    const profile = await client.getProfile();
    
    if (!profile.profile?.account?.account_number) {
      // No account in profile - try the OTHER environment
      console.log(`[Tradier] No account in ${useSandbox ? 'sandbox' : 'production'}, trying ${useSandbox ? 'production' : 'sandbox'}...`);
      
      const otherClient = new TradierClient(apiKey, !useSandbox);
      const otherProfile = await otherClient.getProfile();
      
      if (!otherProfile.profile?.account?.account_number) {
        return {
          valid: false,
          error: 'No account found in profile. Please verify your Tradier account is fully set up and approved.',
        };
      }
      
      // Found account in OTHER environment - use that
      const accountNumber = otherProfile.profile.account.account_number;
      let balances: TradierBalance | null = null;
      
      try {
        balances = await otherClient.getBalances(accountNumber);
      } catch (balanceError) {
        console.warn('[Tradier] Could not fetch balances:', balanceError);
      }
      
      console.log(`[Tradier] ✅ Found account in ${!useSandbox ? 'sandbox' : 'production'} (auto-detected)`);
      
      return {
        valid: true,
        accountNumber,
        balance: balances?.total_equity,
        buyingPower: balances?.buying_power,
        cashAvailable: balances?.cash_available,
        settledCash: balances?.total_cash,
        environment: !useSandbox ? 'sandbox' : 'production',
      };
    }
    
    const accountNumber = profile.profile.account.account_number;
    
    // Fetch balances to get buying power and cash info
    let balances: TradierBalance | null = null;
    try {
      balances = await client.getBalances(accountNumber);
    } catch (balanceError) {
      console.warn('[Tradier] Could not fetch balances:', balanceError);
      // Still return valid if profile check passed
    }
    
    return {
      valid: true,
      accountNumber,
      balance: balances?.total_equity,
      buyingPower: balances?.buying_power,
      cashAvailable: balances?.cash_available,
      settledCash: balances?.total_cash,
      environment: useSandbox ? 'sandbox' : 'production',
    };
  } catch (error: any) {
    // First environment failed - try the other
    try {
      console.log(`[Tradier] ${useSandbox ? 'Sandbox' : 'Production'} failed (${error.message}), trying ${useSandbox ? 'production' : 'sandbox'}...`);
      
      const otherClient = new TradierClient(apiKey, !useSandbox);
      const otherProfile = await otherClient.getProfile();
      
      if (!otherProfile.profile?.account?.account_number) {
        return {
          valid: false,
          error: 'No account found in profile. Please verify your Tradier account is fully set up and approved.',
        };
      }
      
      const accountNumber = otherProfile.profile.account.account_number;
      let balances: TradierBalance | null = null;
      
      try {
        balances = await otherClient.getBalances(accountNumber);
      } catch (balanceError) {
        console.warn('[Tradier] Could not fetch balances:', balanceError);
      }
      
      console.log(`[Tradier] ✅ Found account in ${!useSandbox ? 'sandbox' : 'production'} (fallback)`);
      
      return {
        valid: true,
        accountNumber,
        balance: balances?.total_equity,
        buyingPower: balances?.buying_power,
        cashAvailable: balances?.cash_available,
        settledCash: balances?.total_cash,
        environment: !useSandbox ? 'sandbox' : 'production',
      };
    } catch (otherError: any) {
      return {
        valid: false,
        error: error.message || 'Invalid API key or no Tradier account found',
      };
    }
  }
}
