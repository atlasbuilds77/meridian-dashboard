'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import NDAModal from './NDAModal';

// Routes that don't require NDA (login, onboarding, legal pages)
const EXEMPT_ROUTES = ['/login', '/onboarding', '/legal', '/api'];

export default function NDAProvider({ children }: { children: React.ReactNode }) {
  const [ndaAccepted, setNdaAccepted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();

  // Check if current route is exempt
  const isExempt = EXEMPT_ROUTES.some(route => pathname?.startsWith(route));

  useEffect(() => {
    // Skip check for exempt routes
    if (isExempt) {
      setChecking(false);
      return;
    }

    fetch('/api/user/nda-acceptance')
      .then((res) => {
        if (res.status === 401) {
          // Not logged in, let auth handle it
          setNdaAccepted(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data !== null) {
          setNdaAccepted(data.accepted);
        }
      })
      .catch(() => {
        // On error, don't block - let them through
        setNdaAccepted(true);
      })
      .finally(() => setChecking(false));
  }, [isExempt]);

  // Show nothing while checking (prevents flash)
  if (checking && !isExempt) {
    return null;
  }

  // Show NDA modal if not accepted
  if (!isExempt && ndaAccepted === false) {
    return (
      <>
        {children}
        <NDAModal onAccept={() => setNdaAccepted(true)} />
      </>
    );
  }

  return <>{children}</>;
}
