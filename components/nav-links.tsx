'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLiveData } from '@/hooks/use-live-data';

function navLinkClass(isActive: boolean): string {
  if (isActive) {
    return 'rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_20px_rgba(217,70,239,0.25)]';
  }

  return 'rounded-full border border-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-primary';
}

export function NavLinks() {
  const pathname = usePathname();
  const { data: heliosAccess } = useLiveData<{ hasAccess: boolean }>('/api/helios/access', 300_000);
  const showHelios = heliosAccess?.hasAccess ?? false;

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link href="/" className={navLinkClass(pathname === '/')}>Dashboard</Link>
      <Link href="/trades" className={navLinkClass(pathname === '/trades')}>Trades</Link>
      {showHelios && (
        <Link href="/helios" className={navLinkClass(pathname === '/helios')}>Helios</Link>
      )}
      <Link href="/prediction-markets" className={navLinkClass(pathname === '/prediction-markets')}>Predictions</Link>
      <Link href="/billing" className={navLinkClass(pathname === '/billing')}>Billing</Link>
      <Link href="/analytics" className={navLinkClass(pathname === '/analytics')}>Analytics</Link>
      <Link href="/settings" className={navLinkClass(pathname === '/settings')}>Settings</Link>
    </div>
  );
}
