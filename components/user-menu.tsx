'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface UserSession {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

export function UserMenu() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        setSession(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading || !session?.authenticated || !session.user) {
    return (
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-profit/20 to-profit/5 border border-profit/30 flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-profit animate-pulse" />
      </div>
    );
  }

  const { user } = session;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="h-10 w-10 rounded-full overflow-hidden border-2 border-profit/30 hover:border-profit/50 transition-all hover:scale-105"
      >
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.username}
            width={40}
            height={40}
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-profit/20 to-profit/5 flex items-center justify-center">
            <span className="text-sm font-bold text-profit">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-12 z-50 w-64 rounded-lg border border-border/50 bg-card/95 backdrop-blur-xl shadow-lg overflow-hidden">
            {/* User Info */}
            <div className="p-4 border-b border-border/30">
              <div className="flex items-center gap-3">
                {user.avatar ? (
                  <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-profit/30">
                    <Image
                      src={user.avatar}
                      alt={user.username}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-profit/20 to-profit/5 flex items-center justify-center border-2 border-profit/30">
                    <span className="text-lg font-bold text-profit">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Discord User
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-all"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
