'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface UserSession {
  authenticated: boolean;
  isAdmin?: boolean;
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
      .then((res) => res.json())
      .then((data) => {
        // Construct full avatar URL if it's just a hash
        if (data.authenticated && data.user && data.user.avatar) {
          const avatarHash = data.user.avatar;
          const discordId = data.user.discordId;
          data.user.avatar = avatarHash.startsWith('http')
            ? avatarHash
            : `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`;
        }
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
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/35 bg-primary/15">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  const { user } = session;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="h-10 w-10 overflow-hidden rounded-full border-2 border-primary/40 transition-all hover:scale-105 hover:border-primary/70"
      >
        {user.avatar ? (
          <Image src={user.avatar} alt={user.username} width={40} height={40} className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/20">
            <span className="text-sm font-bold text-primary">{user.username.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />

          <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-primary/30 bg-[rgba(19,19,28,0.9)] shadow-[0_20px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="border-b border-primary/20 p-4">
              <div className="flex items-center gap-3">
                {user.avatar ? (
                  <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-primary/35">
                    <Image src={user.avatar} alt={user.username} width={48} height={48} className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/35 bg-primary/20">
                    <span className="text-lg font-bold text-primary">{user.username.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
                  <p className="text-xs text-muted-foreground">Discord User</p>
                </div>
              </div>
            </div>

            <div className="p-2">
              <button
                onClick={() => {
                  router.push('/settings');
                  setShowMenu(false);
                }}
                className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                <span>Settings</span>
              </button>

              {session.isAdmin && (
                <button
                  onClick={() => {
                    router.push('/admin');
                    setShowMenu(false);
                  }}
                  className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary transition-all hover:bg-primary/15 hover:text-primary"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Admin Dashboard</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
