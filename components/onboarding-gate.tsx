'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const checkedRef = useRef(false);
  
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/legal/');

  useEffect(() => {
    // Skip checks for public routes
    if (pathname === '/onboarding' || isPublicRoute) {
      setChecking(false);
      setHasCompleted(true);
      return;
    }

    // Only check once per session, not on every render
    if (checkedRef.current && hasCompleted !== null) {
      setChecking(false);
      return;
    }

    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch('/api/onboarding/status');

        if (response.status === 401) {
          setHasCompleted(false);
          router.push('/login');
          return;
        }

        const data = await response.json();
        
        setHasCompleted(data.hasCompleted);
        checkedRef.current = true;
        
        if (!data.hasCompleted && pathname !== '/onboarding') {
          router.push('/onboarding');
        }
      } catch (error) {
        console.error('Onboarding check error:', error);
        setHasCompleted(false);
        if (pathname !== '/onboarding') {
          router.push('/onboarding');
        }
      } finally {
        setChecking(false);
      }
    };

    void checkOnboardingStatus();
  }, [pathname, isPublicRoute, router, hasCompleted]);
  
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-profit border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (hasCompleted === false && pathname !== '/onboarding') {
    return null; // Will redirect
  }
  
  return <>{children}</>;
}
