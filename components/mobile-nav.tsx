'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LineChart, Radio, Receipt, Settings, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveData } from '@/hooks/use-live-data';

const baseNavItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/trades', label: 'Trades', icon: LineChart },
  { href: '/prediction-markets', label: 'Predict', icon: Zap },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const signalsItem = { href: '/helios', label: 'Helios', icon: Radio };

export function MobileNav() {
  const pathname = usePathname();
  const { data: heliosAccess } = useLiveData<{ hasAccess: boolean }>('/api/helios/access', 300_000);
  const showHelios = heliosAccess?.hasAccess ?? false;

  const navItems = showHelios
    ? [baseNavItems[0], baseNavItems[1], signalsItem, ...baseNavItems.slice(2)]
    : baseNavItems;

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background"
      style={{ 
        paddingBottom: 'var(--safe-area-inset-bottom)',
        paddingLeft: 'var(--safe-area-inset-left)',
        paddingRight: 'var(--safe-area-inset-right)'
      }}
    >
      <div className="flex items-center justify-around min-h-[52px] px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-2 transition-colors min-w-[56px] min-h-[48px]',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className={cn(
                'text-[10px] font-medium uppercase tracking-wide',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
