'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'not_in_server':
        return 'You must be a member of the trading Discord server.';
      case 'no_singularity_role':
        return 'Access denied. Singularity tier required.';
      case 'unauthorized':
        return 'You are not authorized to access this dashboard.';
      case 'expired':
        return 'Your session has expired. Please log in again.';
      case 'invalid_state':
        return 'Login session expired or invalid. Please try again.';
      case 'auth_failed':
        return 'Authentication failed. Please try again.';
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage(error);

  const handleDiscordLogin = () => {
    setLoading(true);
    window.location.href = '/api/auth/discord/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/35 bg-[rgba(19,19,28,0.82)] backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <CardContent className="p-8">
          <div className="mb-8 flex flex-col items-center">
            <div className="relative mb-4 h-24 w-24">
              <Image
                src="/meridian-logo.png"
                alt="Meridian"
                fill
                className="object-contain drop-shadow-[0_0_20px_rgba(217,70,239,0.45)]"
              />
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight nebula-gradient-text">MERIDIAN</h1>
            <p className="text-center text-sm text-muted-foreground">Professional Trading Analytics Dashboard</p>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-loss/35 bg-loss/10 p-3">
              <p className="text-center text-sm font-medium text-loss">{errorMessage}</p>
            </div>
          )}

          <button
            onClick={handleDiscordLogin}
            disabled={loading}
            className="group flex w-full items-center justify-center gap-3 rounded-lg border border-primary/35 bg-gradient-to-r from-[#9333ea] to-[#c026d3] px-6 py-3 font-semibold text-white shadow-[0_14px_34px_rgba(147,51,234,0.35)] transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                <span>Login with Discord</span>
              </>
            )}
          </button>

          <div className="mt-6 rounded-lg border border-primary/25 bg-primary/8 p-4">
            <p className="text-center text-xs text-muted-foreground">
              <span className="font-semibold text-primary">Singularity Tier Only</span>
              <br />
              Access requires Discord authentication with Singularity role.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span>Secure • Encrypted • Live Data</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
