'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Share2 } from 'lucide-react';
import { ShareCardModal } from '@/components/share-card-modal';
import { PnLShareButton } from '@/components/pnl-share-button';
import { useCsrfToken } from '@/hooks/use-csrf-token';

interface User {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  created_at: string;
  last_login: string;
}

interface UserAccount {
  user_id: string;
  account_number: string;
  platform: string;
  verified: boolean;
  trading_enabled: boolean;
  size_pct: number;
}

interface UserStats {
  user: User;
  account: UserAccount | null;
  trades_count: number;
  total_pnl: number;
  win_rate: number;
}

function formatSignedUsd(value: number): string {
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}`;
}

function buildClientShareText(stats: UserStats): string {
  const winRateText =
    stats.trades_count > 0 ? `${stats.win_rate.toFixed(1)}% win rate` : 'no closed trades yet';
  return `Meridian client update: ${stats.user.discord_username} is ${formatSignedUsd(stats.total_pnl)} across ${stats.trades_count} trades (${winRateText}).`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUserId, setShareUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 401) {
        router.push('/login?error=session_expired');
        return;
      }
      if (res.status === 403) {
        setError('Access denied. Admin only.');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch users');

      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleTrading(userId: string, enabled: boolean) {
    if (!csrfToken) {
      alert('CSRF token not ready. Please refresh.');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ user_id: parseInt(userId, 10), trading_enabled: enabled }),
      });

      if (!res.ok) throw new Error('Failed to update');
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function updateSizePct(userId: string, sizePct: number) {
    if (!csrfToken) {
      alert('CSRF token not ready. Please refresh.');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ user_id: parseInt(userId, 10), size_pct: sizePct }),
      });

      if (!res.ok) throw new Error('Failed to update');
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-primary">Loading admin panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-loss">{error}</div>
      </div>
    );
  }

  const totalUsers = users.length;
  const activeTraders = users.filter((u) => u.account?.trading_enabled).length;
  const totalPnL = users.reduce((sum, u) => sum + u.total_pnl, 0);
  const totalTrades = users.reduce((sum, u) => sum + u.trades_count, 0);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight nebula-gradient-text sm:text-4xl">Admin Dashboard</h1>
          <p className="text-muted-foreground">Multi-user trading system control</p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="nebula-panel rounded-xl p-5">
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">Total Users</div>
            <div className="text-3xl font-bold text-primary">{totalUsers}</div>
          </div>
          <div className="nebula-panel rounded-xl p-5">
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">Active Traders</div>
            <div className="text-3xl font-bold text-primary">{activeTraders}</div>
          </div>
          <div className="nebula-panel rounded-xl p-5">
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">Total Trades</div>
            <div className="text-3xl font-bold text-foreground">{totalTrades}</div>
          </div>
          <div className="nebula-panel rounded-xl p-5">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <span>Combined P&amp;L</span>
              <PnLShareButton
                title="Meridian Combined P&L"
                text={`Meridian combined client P&L: ${formatSignedUsd(totalPnL)} across ${totalTrades} trades.`}
              />
            </div>
            <div className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
          </div>
        </div>

        {users.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-xl font-bold text-primary">Client P&amp;L Cards</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {users.map((stats) => (
                <div
                  key={`pnl-card-${stats.user.id}`}
                  className={`nebula-panel rounded-xl border p-5 ${stats.total_pnl >= 0 ? 'border-profit/30' : 'border-loss/30'}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-foreground">{stats.user.discord_username}</div>
                      <div className="text-xs text-muted-foreground">{stats.account?.account_number || 'No tradier account'}</div>
                    </div>
                    <PnLShareButton
                      title={`Client P&L: ${stats.user.discord_username}`}
                      text={buildClientShareText(stats)}
                    />
                  </div>

                  <div className={`mb-4 text-3xl font-bold ${stats.total_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatSignedUsd(stats.total_pnl)}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-muted-foreground">
                      Trades: <span className="text-foreground">{stats.trades_count}</span>
                    </span>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-muted-foreground">
                      Win Rate:{' '}
                      <span className="text-foreground">{stats.trades_count > 0 ? `${stats.win_rate.toFixed(1)}%` : '—'}</span>
                    </span>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-muted-foreground">
                      Trading:{' '}
                      <span className={stats.account?.trading_enabled ? 'text-profit' : 'text-muted-foreground'}>
                        {stats.account?.trading_enabled ? 'ON' : 'OFF'}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="nebula-panel overflow-hidden rounded-xl">
          <div className="border-b border-primary/25 p-6">
            <h2 className="text-xl font-bold text-primary">Singularity Users</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-primary/8">
                <tr className="text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="p-4">User</th>
                  <th className="p-4">Tradier</th>
                  <th className="p-4">Trading</th>
                  <th className="p-4">Size %</th>
                  <th className="p-4">Trades</th>
                  <th className="p-4">P&amp;L</th>
                  <th className="p-4">Win Rate</th>
                  <th className="p-4">Last Login</th>
                  <th className="p-4">Share</th>
                </tr>
              </thead>
              <tbody>
                {users.map((stats) => (
                  <tr key={stats.user.id} className="border-t border-primary/15 hover:bg-primary/8">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {stats.user.discord_avatar ? (
                          <img
                            src={
                              stats.user.discord_avatar.startsWith('http')
                                ? stats.user.discord_avatar
                                : `https://cdn.discordapp.com/avatars/${stats.user.discord_id}/${stats.user.discord_avatar}.png`
                            }
                            alt=""
                            className="h-10 w-10 rounded-full border border-primary/30"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                            {stats.user.discord_username[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <Link 
                            href={`/admin/users/${stats.user.id}`}
                            className="font-medium hover:text-primary transition-colors cursor-pointer"
                          >
                            {stats.user.discord_username}
                          </Link>
                          <div className="text-xs text-muted-foreground">{stats.user.discord_id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      {stats.account ? (
                        <div>
                          <div className="font-mono text-sm text-primary">{stats.account.account_number}</div>
                          <div className="text-xs text-muted-foreground">{stats.account.verified ? 'Verified' : 'Pending'}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Not connected</div>
                      )}
                    </td>

                    <td className="p-4">
                      {stats.account ? (
                        <button
                          onClick={() => toggleTrading(stats.user.id, !stats.account!.trading_enabled)}
                          className={`rounded px-3 py-1 text-sm font-medium ${
                            stats.account.trading_enabled
                              ? 'bg-primary text-white'
                              : 'border border-primary/30 bg-primary/10 text-muted-foreground'
                          }`}
                        >
                          {stats.account.trading_enabled ? 'ON' : 'OFF'}
                        </button>
                      ) : (
                        <div className="text-muted-foreground">—</div>
                      )}
                    </td>

                    <td className="p-4">
                      {stats.account ? (
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={stats.account.size_pct}
                          onChange={(e) => updateSizePct(stats.user.id, parseInt(e.target.value))}
                          className="w-16 rounded border border-primary/35 bg-background px-2 py-1 text-sm"
                        />
                      ) : (
                        <div className="text-muted-foreground">—</div>
                      )}
                    </td>

                    <td className="p-4 font-mono">{stats.trades_count}</td>

                    <td className="p-4">
                      <div className={`font-mono font-medium ${stats.total_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl.toFixed(2)}
                      </div>
                    </td>

                    <td className="p-4">
                      {stats.trades_count > 0 ? (
                        <div className="font-mono">{stats.win_rate.toFixed(1)}%</div>
                      ) : (
                        <div className="text-muted-foreground">—</div>
                      )}
                    </td>

                    <td className="p-4 text-sm text-muted-foreground">{new Date(stats.user.last_login).toLocaleDateString()}</td>

                    <td className="p-4">
                      {stats.trades_count > 0 ? (
                        <button
                          onClick={() => {
                            setShareUserId(stats.user.id);
                            setShareModalOpen(true);
                          }}
                          className="flex items-center gap-2 rounded border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Share
                        </button>
                      ) : (
                        <div className="text-muted-foreground text-xs">No trades</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              No users yet. Waiting for first Singularity member to log in.
            </div>
          )}
        </div>

        {/* Share Card Modal */}
        <ShareCardModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          userId={shareUserId}
        />
      </div>
    </div>
  );
}
