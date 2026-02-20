'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface User {
  id: number;
  discord_id: string;
  username: string;
  created_at: string;
  last_login: string;
  trading_enabled: boolean | null;
  size_pct: number | null;
  max_position_size: number | null;
  max_loss_pct: number | null;
  platform: string | null;
  verification_status: string | null;
  account_number: string | null;
  last_verified: string | null;
  total_trades: number;
  total_pnl: number;
  wins: number;
  losses: number;
  win_rate: number;
  last_trade: string | null;
}

interface Stats {
  total_users: number;
  active_traders: number;
  verified_accounts: number;
  platform_total_pnl: number;
  platform_total_trades: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);
  const [editingSizePct, setEditingSizePct] = useState<{ [key: number]: string }>({});

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        setError('Access denied. Admin only.');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data.users);
      setStats(data.stats);
    } catch (err) {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleTrading = async (userId: number, enabled: boolean) => {
    setUpdating(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, trading_enabled: enabled }),
      });
      if (res.ok) fetchUsers();
    } catch { }
    setUpdating(null);
  };

  const updateSizePct = async (userId: number) => {
    const val = parseFloat(editingSizePct[userId]);
    if (isNaN(val) || val < 0 || val > 1) return;
    setUpdating(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, size_pct: val }),
      });
      if (res.ok) {
        setEditingSizePct(prev => { const n = { ...prev }; delete n[userId]; return n; });
        fetchUsers();
      }
    } catch { }
    setUpdating(null);
  };

  const formatPnl = (pnl: number) => {
    const formatted = `$${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (pnl > 0) return <span className="text-profit">+{formatted}</span>;
    if (pnl < 0) return <span className="text-loss">-{formatted}</span>;
    return <span className="text-muted-foreground">{formatted}</span>;
  };

  if (loading) return <div className="min-h-screen p-8 flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (error) return <div className="min-h-screen p-8 flex items-center justify-center text-loss">{error}</div>;

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Meridian multi-tenant trading management</p>
        </div>

        {/* System Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Users', value: stats.total_users },
              { label: 'Active Traders', value: stats.active_traders },
              { label: 'Verified Accounts', value: stats.verified_accounts },
              { label: 'Total P&L', value: formatPnl(Number(stats.platform_total_pnl)) },
              { label: 'Total Trades', value: stats.platform_total_trades },
            ].map(({ label, value }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Users Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Singularity Users</CardTitle>
            <CardDescription>{users.length} registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left text-muted-foreground">
                    <th className="p-3">User</th>
                    <th className="p-3">Trading</th>
                    <th className="p-3">Size %</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Trades</th>
                    <th className="p-3">P&L</th>
                    <th className="p-3">Win Rate</th>
                    <th className="p-3">Last Trade</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/10 hover:bg-secondary/20">
                      <td className="p-3">
                        <div>
                          <span className="font-medium text-foreground">{user.username}</span>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          user.trading_enabled
                            ? 'bg-profit/20 text-profit'
                            : 'bg-secondary/50 text-muted-foreground'
                        }`}>
                          {user.trading_enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="p-3">
                        {editingSizePct[user.id] !== undefined ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={editingSizePct[user.id]}
                              onChange={(e) => setEditingSizePct(prev => ({ ...prev, [user.id]: e.target.value }))}
                              className="w-20 h-7 text-xs"
                            />
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                              onClick={() => updateSizePct(user.id)}
                              disabled={updating === user.id}>✓</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                              onClick={() => setEditingSizePct(prev => { const n = { ...prev }; delete n[user.id]; return n; })}>✕</Button>
                          </div>
                        ) : (
                          <button
                            className="text-foreground hover:text-profit transition-colors"
                            onClick={() => setEditingSizePct(prev => ({ ...prev, [user.id]: String(user.size_pct ?? 1.0) }))}
                          >
                            {((user.size_pct ?? 1.0) * 100).toFixed(0)}%
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        {user.account_number ? (
                          <span className="text-xs font-mono text-foreground">{user.account_number}</span>
                        ) : user.verification_status === 'verified' ? (
                          <span className="text-xs text-yellow-500">No acct #</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {user.verification_status || 'No key'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-foreground">{user.total_trades}</td>
                      <td className="p-3">{formatPnl(Number(user.total_pnl))}</td>
                      <td className="p-3 text-foreground">{Number(user.win_rate).toFixed(0)}%</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {user.last_trade ? new Date(user.last_trade).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant={user.trading_enabled ? 'destructive' : 'default'}
                          className="h-7 text-xs"
                          disabled={updating === user.id || !user.verification_status || user.verification_status !== 'verified'}
                          onClick={() => toggleTrading(user.id, !user.trading_enabled)}
                        >
                          {updating === user.id ? '...' : user.trading_enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        No users registered yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Hardcoded Accounts Info */}
        <Card className="border-border/50 bg-secondary/20">
          <CardContent className="p-6">
            <h4 className="font-semibold text-foreground mb-2">⚡ Hardcoded Accounts (Fallback)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              These accounts run automatically when no DB accounts are available.
              They are NOT shown above and cannot be disabled from this dashboard.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-background/50 rounded">
                <span className="font-medium">Aman</span> — 6YB71689 — 100% size
              </div>
              <div className="p-3 bg-background/50 rounded">
                <span className="font-medium">Carlos</span> — 6YB71747 — 25% size
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
