'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ShareStatus = 'idle' | 'shared' | 'copied' | 'error';

interface PnLShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'default';
}

export function PnLShareButton({ title, text, url, className, size = 'xs' }: PnLShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>('idle');

  const resolvedUrl = useMemo(() => {
    if (url) return url;
    if (typeof window !== 'undefined') return window.location.href;
    return undefined;
  }, [url]);

  async function handleShare() {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title,
          text,
          ...(resolvedUrl ? { url: resolvedUrl } : {}),
        });
        setStatus('shared');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        const payload = resolvedUrl ? `${text}\n${resolvedUrl}` : text;
        await navigator.clipboard.writeText(payload);
        setStatus('copied');
      } else {
        throw new Error('Share not supported');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setStatus('error');
    } finally {
      window.setTimeout(() => setStatus('idle'), 2200);
    }
  }

  const label = status === 'shared' ? 'Shared' : status === 'copied' ? 'Copied' : status === 'error' ? 'Retry' : 'Share';
  const Icon = status === 'shared' ? Check : status === 'copied' ? Copy : Share2;

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={handleShare}
      className={cn(
        'border-primary/35 bg-primary/10 text-foreground hover:border-primary/60 hover:bg-primary/20',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
