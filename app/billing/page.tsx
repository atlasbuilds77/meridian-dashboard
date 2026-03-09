'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { WeeklyBillingView } from '@/components/weekly-billing-view';
import { PaymentMethodManager } from '@/components/payment-method-form';

export default function BillingPage() {
  const [userSession, setUserSession] = useState<{ username: string; avatar: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          const avatarHash = data.user.avatar;
          const discordId = data.user.discordId;
          const fullAvatarUrl = avatarHash 
            ? (avatarHash.startsWith('http') 
                ? avatarHash 
                : `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`)
            : null;
          setUserSession({ username: data.user.username, avatar: fullAvatarUrl });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto max-w-[1400px] space-y-8">
        {/* Header */}
        <header className="flex items-center gap-4">
          {userSession?.avatar && (
            <Image
              src={userSession.avatar}
              alt={userSession.username}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full border-2 border-primary/40"
              priority
            />
          )}
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {userSession ? `${userSession.username}'s` : 'Your'} Account
            </p>
            <h1 className="text-3xl font-bold tracking-tight nebula-gradient-text">Weekly Billing</h1>
          </div>
        </header>

        {/* Weekly Billing View */}
        <WeeklyBillingView />

        {/* Payment Methods */}
        <div className="pt-4">
          <PaymentMethodManager />
        </div>
      </div>
    </div>
  );
}
