'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getToasts, removeToast, subscribe } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function ToastContainer() {
  const [toasts, setToasts] = useState(getToasts());

  useEffect(() => {
    return subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center justify-between gap-4 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm',
            {
              'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300': toast.type === 'success',
              'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300': toast.type === 'error',
              'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300': toast.type === 'info',
            }
          )}
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}