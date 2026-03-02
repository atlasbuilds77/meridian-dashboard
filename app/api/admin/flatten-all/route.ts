import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';
import { getApiCredential } from '@/lib/db/api-credentials';

const OPTION_SYMBOL_RE = /^([A-Z]{1,6})\d{6}[CP]\d{8}$/;
const TRADIER_BASE_URL = 'https://api.tradier.com/v1';

type FlattenRequest = {
  confirm?: boolean;
  dryRun?: boolean;
};

type TradierPosition = {
  symbol: string;
  quantity: number;
};

function parsePositions(payload: unknown): TradierPosition[] {
  const data = payload as { positions?: { position?: unknown } | null } | null;
  const node = data?.positions?.position;
  const rows = Array.isArray(node) ? node : node ? [node] : [];

  return rows
    .map((row) => {
      const r = row as { symbol?: unknown; quantity?: unknown };
      return {
        symbol: String(r.symbol || '').trim(),
        quantity: Number(r.quantity || 0),
      };
    })
    .filter((row) => row.symbol.length > 0 && Number.isFinite(row.quantity) && row.quantity !== 0);
}

async function fetchPositions(apiKey: string, accountNumber: string): Promise<TradierPosition[]> {
  const res = await fetch(`${TRADIER_BASE_URL}/accounts/${accountNumber}/positions`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`positions ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  return parsePositions(json);
}

function buildCloseOrderPayload(position: TradierPosition): URLSearchParams {
  const qty = Math.abs(Math.trunc(position.quantity));
  const params = new URLSearchParams();

  const optionMatch = position.symbol.match(OPTION_SYMBOL_RE);
  if (optionMatch) {
    params.set('class', 'option');
    params.set('symbol', optionMatch[1]);
    params.set('option_symbol', position.symbol);
    params.set('side', position.quantity > 0 ? 'sell_to_close' : 'buy_to_close');
  } else {
    params.set('class', 'equity');
    params.set('symbol', position.symbol);
    params.set('side', position.quantity > 0 ? 'sell' : 'buy_to_cover');
  }

  params.set('quantity', String(qty));
  params.set('type', 'market');
  params.set('duration', 'day');
  return params;
}

async function placeCloseOrder(apiKey: string, accountNumber: string, position: TradierPosition) {
  const payload = buildCloseOrderPayload(position);
  const res = await fetch(`${TRADIER_BASE_URL}/accounts/${accountNumber}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`order ${res.status}: ${bodyText}`);
  }

  try {
    const json = JSON.parse(bodyText) as { order?: { id?: string | number } };
    return { ok: true, orderId: json.order?.id ? String(json.order.id) : null };
  } catch {
    return { ok: true, orderId: null };
  }
}

export async function POST(request: NextRequest) {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  let body: FlattenRequest = {};
  try {
    body = (await request.json()) as FlattenRequest;
  } catch {
    // Keep defaults for empty JSON bodies.
  }

  if (!body.confirm) {
    return NextResponse.json(
      { error: 'Confirmation required. Pass { "confirm": true }.' },
      { status: 400 }
    );
  }

  const dryRun = Boolean(body.dryRun);

  try {
    const { rows } = await pool.query<{
      user_id: number;
      username: string;
      account_number: string;
    }>(
      `
      SELECT
        u.id AS user_id,
        u.username,
        ac.account_number
      FROM api_credentials ac
      JOIN users u ON u.id = ac.user_id
      WHERE ac.platform = 'tradier'
        AND ac.is_active = true
        AND ac.verification_status = 'verified'
        AND ac.account_number IS NOT NULL
      ORDER BY u.username
      `
    );

    const accountResults: Array<{
      user: string;
      userId: number;
      account: string;
      positionsFound: number;
      closed: number;
      skipped: number;
      errors: string[];
      orders: Array<{ symbol: string; quantity: number; orderId: string | null }>;
    }> = [];

    for (const row of rows) {
      const accountSummary = {
        user: row.username,
        userId: row.user_id,
        account: row.account_number,
        positionsFound: 0,
        closed: 0,
        skipped: 0,
        errors: [] as string[],
        orders: [] as Array<{ symbol: string; quantity: number; orderId: string | null }>,
      };

      try {
        const credential = await getApiCredential(row.user_id, 'tradier');
        if (!credential?.api_key) {
          accountSummary.errors.push('Missing decrypted API key');
          accountResults.push(accountSummary);
          continue;
        }

        const positions = await fetchPositions(credential.api_key, row.account_number);
        accountSummary.positionsFound = positions.length;

        for (const position of positions) {
          if (dryRun) {
            accountSummary.skipped += 1;
            accountSummary.orders.push({
              symbol: position.symbol,
              quantity: position.quantity,
              orderId: null,
            });
            continue;
          }

          try {
            const result = await placeCloseOrder(credential.api_key, row.account_number, position);
            accountSummary.closed += 1;
            accountSummary.orders.push({
              symbol: position.symbol,
              quantity: position.quantity,
              orderId: result.orderId,
            });
          } catch (error) {
            accountSummary.errors.push(
              `Failed ${position.symbol} (${position.quantity}): ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }
        }
      } catch (error) {
        accountSummary.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }

      accountResults.push(accountSummary);
    }

    const summary = accountResults.reduce(
      (acc, row) => {
        acc.accounts += 1;
        acc.positionsFound += row.positionsFound;
        acc.closed += row.closed;
        acc.skipped += row.skipped;
        acc.errors += row.errors.length;
        return acc;
      },
      { accounts: 0, positionsFound: 0, closed: 0, skipped: 0, errors: 0 }
    );

    return NextResponse.json({
      success: true,
      dryRun,
      summary,
      accounts: accountResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Flatten-all error:', error);
    return NextResponse.json({ error: 'Failed to flatten accounts' }, { status: 500 });
  }
}
