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
    // Trigger exit animation
    setIsTransitioning(true);
    
    // Reset after animation completes
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 50);

    return () => clearTimeout(timer);
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
