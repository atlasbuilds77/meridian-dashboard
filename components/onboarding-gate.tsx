'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/legal/');

  const checkOnboardingStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/status');

      if (response.status === 401) {
        setHasCompleted(false);
        router.push('/login');
        return;
      }

      const data = await response.json();
      
      setHasCompleted(data.hasCompleted);
      
      if (!data.hasCompleted && pathname !== '/onboarding') {
        // Redirect to onboarding
        router.push('/onboarding');
      }
    } catch (error) {
      console.error('Onboarding check error:', error);
      // Fail closed for protected routes.
      setHasCompleted(false);
      if (pathname !== '/onboarding') {
        router.push('/onboarding');
      }
    } finally {
      setChecking(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    // Skip checks for public routes.
    if (pathname === '/onboarding' || isPublicRoute) {
      setChecking(false);
      setHasCompleted(true); // Allow access to public/onboarding routes
      return;
    }
    
    void checkOnboardingStatus();
  }, [pathname, checkOnboardingStatus, isPublicRoute, router]);
  
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
