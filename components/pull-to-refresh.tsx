'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80; // Distance needed to trigger refresh

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull if at top of scroll
      if (container.scrollTop === 0) {
        setCanPull(true);
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPull || isRefreshing) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;

      // Only pull down, and add resistance
      if (distance > 0) {
        const pullAmount = Math.min(distance * 0.5, THRESHOLD * 1.5);
        setPullDistance(pullAmount);

        // Prevent default scroll if pulling
        if (pullAmount > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!canPull) return;

      setCanPull(false);

      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 500);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canPull, isRefreshing, pullDistance, onRefresh]);

  const opacity = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = (pullDistance / THRESHOLD) * 360;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {/* Pull indicator */}
      <div
        className="fixed left-0 right-0 top-16 z-40 flex justify-center pointer-events-none"
        style={{
          transform: `translateY(${Math.min(pullDistance - 20, 60)}px)`,
          opacity: isRefreshing ? 1 : opacity,
          transition: isRefreshing || pullDistance === 0 ? 'all 0.3s ease-out' : 'none',
        }}
      >
        <div className="rounded-full bg-background/95 backdrop-blur-sm border border-primary/30 p-3 shadow-lg">
          <RefreshCw
            className="h-5 w-5 text-primary"
            style={{
              transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
              animation: isRefreshing ? 'spin 1s linear infinite' : undefined,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: isRefreshing ? undefined : `translateY(${Math.min(pullDistance * 0.3, 30)}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
