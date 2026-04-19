'use client';

import { useEffect } from 'react';

export default function PredictionMarketsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PredictionMarkets] Page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <h2 className="text-lg font-semibold text-foreground">Failed to load Trading Bots</h2>
        <p className="text-sm text-muted-foreground font-mono bg-zinc-900 rounded p-3 text-left break-all">
          {error.message || 'Unknown error'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
