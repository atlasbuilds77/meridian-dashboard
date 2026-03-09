'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LineChart, Receipt, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/trades', label: 'Trades', icon: LineChart },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-primary/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ 
        paddingBottom: 'var(--safe-area-inset-bottom)',
        paddingLeft: 'var(--safe-area-inset-left)',
        paddingRight: 'var(--safe-area-inset-right)'
      }}
    >
      <div className="flex items-center justify-around min-h-[64px] px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-lg transition-colors min-w-[64px] min-h-[56px]',
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Icon className={cn('h-6 w-6', isActive && 'text-primary')} />
              <span className={cn('text-xs font-medium', isActive && 'text-primary')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
