'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Wraps page content with subtle fade/slide transitions
 * Triggers on route changes (200-300ms, ease-out)
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Start hidden on route change
    setIsTransitioning(true);
    
    // Use rAF to ensure the hidden state is painted before animating in
    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 30);
      // Store timer for cleanup
      (raf as any)._timer = timer;
    });

    return () => {
      cancelAnimationFrame(raf);
      if ((raf as any)._timer) clearTimeout((raf as any)._timer);
    };
  }, [pathname]);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        isTransitioning
          ? 'opacity-0 translate-y-2'
          : 'opacity-100 translate-y-0'
      }`}
    >
      {children}
    </div>
  );
}
