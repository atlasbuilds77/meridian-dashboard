/**
 * SnapTrade Client - Lazy-loaded singleton
 * 
 * Wraps snaptrade-typescript-sdk with convenience functions
 * for user registration, broker connection, account listing,
 * position fetching, and order placement.
 * 
 * Does NOT crash on missing env vars — returns null client
 * so the app can still boot without SnapTrade configured.
 */

import { Snaptrade } from 'snaptrade-typescript-sdk';

let _client: Snaptrade | null = null;
let _initAttempted = false;

function getClient(): Snaptrade {
  if (!_initAttempted) {
    _initAttempted = true;
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;

    if (clientId && consumerKey) {
      _client = new Snaptrade({
        clientId,
        consumerKey,
      });
    } else {
      console.warn(
        '[SnapTrade] Missing SNAPTRADE_CLIENT_ID or SNAPTRADE_CONSUMER_KEY — client disabled'
      );
    }
  }

  if (!_client) {
    throw new Error('SnapTrade client not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.');
  }

  return _client;
}

// ─── User Registration ─────────────────────────────────────────────
export async function deleteUser(userId: string) {
  const client = getClient();
  return client.authentication.deleteSnapTradeUser({ userId });
}

export async function registerUser(userId: string) {
  const client = getClient();
  const response = await client.authentication.registerSnapTradeUser({
    userId,
  });
  return response.data; // { userId, userSecret }
}

// ─── Connection Portal URL ─────────────────────────────────────────
export async function getConnectionUrl(
  userId: string,
  userSecret: string,
  customRedirect?: string
) {
  const client = getClient();
  const response = await client.authentication.loginSnapTradeUser({
    userId,
    userSecret,
    connectionType: 'trade',   // REQUIRED: request trading permissions (not read-only)
    ...(customRedirect ? { customRedirect } : {}),
  });
  return response.data; // { redirectURI, ... }
}

// ─── List Accounts ─────────────────────────────────────────────────
export async function listAccounts(userId: string, userSecret: string) {
  const client = getClient();
  const response = await client.accountInformation.listUserAccounts({
    userId,
    userSecret,
  });
  return response.data; // Account[]
}

// ─── Get Positions ─────────────────────────────────────────────────
export async function getPositions(
  userId: string,
  userSecret: string,
  accountId: string
) {
  const client = getClient();
  const response = await client.accountInformation.getUserAccountPositions({
    userId,
    userSecret,
    accountId,
  });
  return response.data; // Position[]
}

// ─── Place Order (force — skip impact check) ───────────────────────
export type PlaceOrderParams = {
  userId: string;
  userSecret: string;
  accountId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'BUY_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_OPEN' | 'SELL_TO_CLOSE';
  quantity: number;
  orderType?: 'Market' | 'Limit' | 'Stop' | 'StopLimit';
  timeInForce?: 'Day' | 'GTC' | 'FOK' | 'IOC';
  price?: number;
};

export async function placeOrder(params: PlaceOrderParams) {
  const client = getClient();
  const response = await client.trading.placeForceOrder({
    userId: params.userId,
    userSecret: params.userSecret,
    account_id: params.accountId,
    symbol: params.symbol,
    action: params.action,
    order_type: (params.orderType || 'Market') as 'Market' | 'Limit' | 'Stop' | 'StopLimit',
    time_in_force: (params.timeInForce || 'Day') as 'Day' | 'GTC' | 'FOK' | 'IOC',
    units: params.quantity,
    ...(params.price != null ? { price: params.price } : {}),
  });
  return response.data; // AccountOrderRecord
}

// ─── Healthcheck ────────────────────────────────────────────────────
export function isConfigured(): boolean {
  return !!(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY);
}
