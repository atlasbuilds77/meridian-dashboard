'use client';

import { usePathname } from 'next/navigation';
import { OnboardingGate } from '@/components/onboarding-gate';
import { ToastContainer } from '@/components/ui/toast';

export function LayoutContentInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname?.startsWith('/api/auth');
  const isOnboardingPage = pathname === '/onboarding';
  const isLegalPage = pathname?.startsWith('/legal');

  if (isAuthPage || isOnboardingPage || isLegalPage) {
    return <main>{children}</main>;
  }

  return (
    <>
      <main className="pt-16">
        <OnboardingGate>{children}</OnboardingGate>
      </main>
      <ToastContainer />
    </>
  );
}
