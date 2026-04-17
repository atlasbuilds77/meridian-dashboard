'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLiveData } from '@/hooks/use-live-data';

function navLinkClass(isActive: boolean): string {
  if (isActive) {
    return 'rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_20px_rgba(217,70,239,0.25)] transition-all duration-200';
  }

  return 'rounded-full border border-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-primary transition-all duration-200';
}

// Pages Helios-only users cannot access
const MERIDIAN_ONLY_PATHS = ['/', '/trades', '/prediction-markets', '/billing', '/analytics'];

export function NavLinks() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: heliosAccess, loading } = useLiveData<{ hasAccess: boolean; singularityOnly?: boolean }>('/api/helios/access', 300_000);
  const { data: singularityAccess } = useLiveData<{ hasAccess: boolean }>('/api/singularity/access', 300_000);

  const isHeliosOnly = (heliosAccess?.hasAccess && !singularityAccess?.hasAccess) ?? false;

  // Redirect Helios-only users away from Meridian pages
  useEffect(() => {
    if (!loading && isHeliosOnly && MERIDIAN_ONLY_PATHS.includes(pathname)) {
      router.replace('/helios');
    }
  }, [isHeliosOnly, pathname, loading, router]);

  if (isHeliosOnly) {
    return (
      <div className="hidden items-center gap-2 md:flex">
        <Link href="/helios" className={navLinkClass(pathname === '/helios' && !pathname.startsWith('/helios/setup'))}>Dashboard</Link>
        <Link href="/helios/setup" className={navLinkClass(pathname.startsWith('/helios/setup'))}>Setup</Link>
        <Link href="/settings" className={navLinkClass(pathname === '/settings')}>Settings</Link>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link href="/" className={navLinkClass(pathname === '/')}>Dashboard</Link>
      <Link href="/trades" className={navLinkClass(pathname === '/trades')}>Trades</Link>
      {heliosAccess?.hasAccess && (
        <Link href="/helios" className={navLinkClass(pathname === '/helios')}>Helios</Link>
      )}
      <Link href="/prediction-markets" className={navLinkClass(pathname === '/prediction-markets')}>Predictions</Link>
      <Link href="/billing" className={navLinkClass(pathname === '/billing')}>Billing</Link>
      <Link href="/analytics" className={navLinkClass(pathname === '/analytics')}>Analytics</Link>
      <Link href="/settings" className={navLinkClass(pathname === '/settings')}>Settings</Link>
    </div>
  );
}
