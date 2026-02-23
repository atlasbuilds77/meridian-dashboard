'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, trading_enabled: enabled }),
      });

      if (!res.ok) throw new Error('Failed to update');
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function updateSizePct(userId: string, sizePct: number) {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, size_pct: sizePct }),
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
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">Combined P&amp;L</div>
            <div className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
          </div>
        </div>

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
      </div>
    </div>
  );
}
