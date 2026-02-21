"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
      const res = await fetch("/api/admin/users");
      if (res.status === 401) {
        router.push("/login?error=session_expired");
        return;
      }
      if (res.status === 403) {
        setError("Access denied. Admin only.");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch users");

      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleTrading(userId: string, enabled: boolean) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, trading_enabled: enabled }),
      });

      if (!res.ok) throw new Error("Failed to update");
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function updateSizePct(userId: string, sizePct: number) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, size_pct: sizePct }),
      });

      if (!res.ok) throw new Error("Failed to update");
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#00ff88] text-xl">Loading admin panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#ff3b3b] text-xl">{error}</div>
      </div>
    );
  }

  const totalUsers = users.length;
  const activeTraders = users.filter((u) => u.account?.trading_enabled).length;
  const totalPnL = users.reduce((sum, u) => sum + u.total_pnl, 0);
  const totalTrades = users.reduce((sum, u) => sum + u.trades_count, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#00ff88] mb-2">
            ADMIN DASHBOARD
          </h1>
          <p className="text-gray-400">Multi-user trading system control</p>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">TOTAL USERS</div>
            <div className="text-3xl font-bold text-[#00ff88]">{totalUsers}</div>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">ACTIVE TRADERS</div>
            <div className="text-3xl font-bold text-[#00ff88]">{activeTraders}</div>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">TOTAL TRADES</div>
            <div className="text-3xl font-bold">{totalTrades}</div>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">COMBINED P&L</div>
            <div
              className={`text-3xl font-bold ${
                totalPnL >= 0 ? "text-[#00ff88]" : "text-[#ff3b3b]"
              }`}
            >
              {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div className="p-6 border-b border-[#2a2a2a]">
            <h2 className="text-xl font-bold text-[#00ff88]">
              SINGULARITY USERS
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0f0f0f]">
                <tr className="text-left text-gray-400 text-sm">
                  <th className="p-4">USER</th>
                  <th className="p-4">TRADIER</th>
                  <th className="p-4">TRADING</th>
                  <th className="p-4">SIZE %</th>
                  <th className="p-4">TRADES</th>
                  <th className="p-4">P&L</th>
                  <th className="p-4">WIN RATE</th>
                  <th className="p-4">LAST LOGIN</th>
                </tr>
              </thead>
              <tbody>
                {users.map((stats) => (
                  <tr
                    key={stats.user.id}
                    className="border-t border-[#2a2a2a] hover:bg-[#1f1f1f]"
                  >
                    {/* User */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {stats.user.discord_avatar ? (
                          <img
                            src={`https://cdn.discordapp.com/avatars/${stats.user.discord_id}/${stats.user.discord_avatar}.png`}
                            alt=""
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-500">
                            {stats.user.discord_username[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">
                            {stats.user.discord_username}
                          </div>
                          <div className="text-xs text-gray-500">
                            {stats.user.discord_id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tradier Status */}
                    <td className="p-4">
                      {stats.account ? (
                        <div>
                          <div className="text-[#00ff88] font-mono text-sm">
                            {stats.account.account_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {stats.account.verified ? "✓ Verified" : "⚠ Pending"}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm">Not connected</div>
                      )}
                    </td>

                    {/* Trading Toggle */}
                    <td className="p-4">
                      {stats.account ? (
                        <button
                          onClick={() =>
                            toggleTrading(
                              stats.user.id,
                              !stats.account!.trading_enabled
                            )
                          }
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            stats.account.trading_enabled
                              ? "bg-[#00ff88] text-black"
                              : "bg-[#2a2a2a] text-gray-400"
                          }`}
                        >
                          {stats.account.trading_enabled ? "ON" : "OFF"}
                        </button>
                      ) : (
                        <div className="text-gray-600">—</div>
                      )}
                    </td>

                    {/* Size % */}
                    <td className="p-4">
                      {stats.account ? (
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={stats.account.size_pct}
                          onChange={(e) =>
                            updateSizePct(stats.user.id, parseInt(e.target.value))
                          }
                          className="w-16 bg-[#2a2a2a] border border-[#3a3a3a] rounded px-2 py-1 text-sm"
                        />
                      ) : (
                        <div className="text-gray-600">—</div>
                      )}
                    </td>

                    {/* Trades */}
                    <td className="p-4 font-mono">{stats.trades_count}</td>

                    {/* P&L */}
                    <td className="p-4">
                      <div
                        className={`font-mono font-medium ${
                          stats.total_pnl >= 0
                            ? "text-[#00ff88]"
                            : "text-[#ff3b3b]"
                        }`}
                      >
                        {stats.total_pnl >= 0 ? "+" : ""}$
                        {stats.total_pnl.toFixed(2)}
                      </div>
                    </td>

                    {/* Win Rate */}
                    <td className="p-4">
                      {stats.trades_count > 0 ? (
                        <div className="font-mono">
                          {(stats.win_rate * 100).toFixed(1)}%
                        </div>
                      ) : (
                        <div className="text-gray-600">—</div>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="p-4 text-sm text-gray-400">
                      {new Date(stats.user.last_login).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              No users yet. Waiting for first Singularity member to log in.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
