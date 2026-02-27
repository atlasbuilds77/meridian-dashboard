'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Share2,
  Loader2,
  Sparkles,
  Twitter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShareCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  mode?: 'user' | 'combined';
}

type Edition = 'black' | 'ruby' | 'emerald' | 'sapphire' | 'diamond';

interface CardData {
  image: string;
  edition: Edition;
  stats: {
    totalProfit: number;
    returnPercent: number;
    winRate: number;
    totalTrades: number;
  };
}

const editionInfo: Record<Edition, { name: string; color: string; description: string }> = {
  black: {
    name: 'Limited Edition',
    color: 'text-white',
    description: 'Welcome to Meridian',
  },
  ruby: {
    name: 'Ruby Edition',
    color: 'text-red-500',
    description: '26+ Trades Unlocked',
  },
  emerald: {
    name: 'Emerald Edition',
    color: 'text-emerald-500',
    description: '50+ Trades Unlocked',
  },
  sapphire: {
    name: 'Sapphire Edition',
    color: 'text-blue-500',
    description: '75+ Trades Unlocked',
  },
  diamond: {
    name: 'Diamond Edition',
    color: 'text-purple-400',
    description: '100+ Trades & 90%+ Win Rate - Elite Status',
  },
};

const editionOrder: Edition[] = ['black', 'ruby', 'emerald', 'sapphire', 'diamond'];

export function ShareCardModal({ open, onOpenChange, userId, mode = 'user' }: ShareCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<Edition | null>(null);

  const generateCard = async (editionOverride?: Edition) => {
    setLoading(true);
    setError(null);

    try {
      const edition = editionOverride ?? undefined;
      const response = await fetch('/api/share/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, edition, mode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate card');
      }

      const data = await response.json();
      setCardData(data);
      setSelectedEdition(data.edition);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate card');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!cardData) return;

    const link = document.createElement('a');
    link.href = cardData.image;
    link.download = `meridian-pnl-${mode}-${cardData.edition}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToPhotos = async () => {
    if (!cardData) return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const imageResponse = await fetch(cardData.image);
        const blob = await imageResponse.blob();
        const file = new File([blob], `meridian-pnl-${mode}-${cardData.edition}.png`, { type: 'image/png' });

        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Meridian P&L Card',
            text: 'Save this card to your photos',
          });
          return;
        }
      }
    } catch (err) {
      console.error('Native photo save failed, falling back to download', err);
    }

    handleDownload();
  };

  const handleCopyImage = async () => {
    if (!cardData) return;

    try {
      // Convert base64 to blob
      const base64Response = await fetch(cardData.image);
      const blob = await base64Response.blob();

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image:', err);
      // Fallback: just show message
      alert('Image ready! Use Cmd+C to copy or click Download.');
    }
  };

  const handleShareTwitter = () => {
    if (!cardData) return;

    const text = `Just hit ${cardData.stats.totalProfit >= 0 ? '+' : ''}$${cardData.stats.totalProfit.toFixed(0)} P&L with a ${cardData.stats.winRate}% win rate on Meridian! 🚀\n\nAutomated options trading at meridian.zerogtrading.com`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const cycleEdition = (direction: 'prev' | 'next') => {
    if (!cardData && !selectedEdition) return;
    const currentEdition = selectedEdition ?? cardData?.edition ?? 'black';
    const currentIndex = editionOrder.indexOf(currentEdition);
    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % editionOrder.length
        : (currentIndex - 1 + editionOrder.length) % editionOrder.length;
    const nextEdition = editionOrder[nextIndex];
    setSelectedEdition(nextEdition);
    generateCard(nextEdition);
  };

  // Auto-generate when modal opens or userId changes
  useEffect(() => {
    if (open) {
      // Reset card data when userId changes (admin panel switching users)
      setCardData(null);
      setError(null);
      setSelectedEdition(null);
      generateCard();
    }
  }, [open, userId, mode]);

  const editionMeta = cardData ? editionInfo[cardData.edition] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Share Your P&L
          </DialogTitle>
          <DialogDescription>
            Generate a beautiful share card to show off your trading performance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Generating your share card...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-loss/40 bg-loss/10 p-4 text-sm text-loss">
              {error}
            </div>
          )}

          {cardData && (
            <div className="space-y-4">
              {/* Edition Badge */}
              <div className="rounded-lg border border-border/40 bg-secondary/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={cn('text-lg font-semibold', editionMeta?.color)}>
                      {editionMeta?.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{editionMeta?.description}</p>
                  </div>
                  <Sparkles className={cn('h-8 w-8', editionMeta?.color)} />
                </div>
              </div>

              {/* Card Preview */}
              <div className="flex justify-center rounded-lg border border-border/40 bg-black p-6">
                <img
                  src={cardData.image}
                  alt="Share Card"
                  className="max-w-full rounded-lg shadow-2xl"
                  style={{ maxHeight: '600px' }}
                />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Button
                  onClick={handleDownload}
                  className="w-full"
                  variant="default"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PNG
                </Button>

                <Button
                  onClick={handleSaveToPhotos}
                  className="w-full"
                  variant="outline"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Save to Photos
                </Button>

                <Button
                  onClick={handleCopyImage}
                  className="w-full"
                  variant="outline"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy Image'}
                </Button>

                <Button
                  onClick={handleShareTwitter}
                  className="w-full sm:col-span-1 col-span-2"
                  variant="outline"
                >
                  <Twitter className="mr-2 h-4 w-4" />
                  Share on X
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => cycleEdition('prev')} variant="outline" disabled={loading}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Prev Theme
                </Button>
                <Button onClick={() => cycleEdition('next')} variant="outline" disabled={loading}>
                  Next Theme
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Tips */}
              <div className="rounded-lg border border-border/40 bg-secondary/10 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Share Tips:</p>
                <ul className="mt-2 space-y-1">
                  <li>• Best for Twitter/X, Discord, and Telegram</li>
                  <li>• High-resolution PNG optimized for Retina displays</li>
                  <li>
                    • Your edition tier is based on: {cardData.stats.totalTrades} trades,{' '}
                    {cardData.stats.winRate}% win rate
                  </li>
                </ul>
              </div>
            </div>
          )}

          {!loading && !cardData && !error && (
            <div className="flex justify-center py-8">
              <Button onClick={generateCard} size="lg">
                <Share2 className="mr-2 h-4 w-4" />
                Generate Share Card
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
