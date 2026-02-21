import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { UserMenu } from '@/components/user-menu';
import { OnboardingGate } from '@/components/onboarding-gate';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Meridian Dashboard',
  description: 'Professional trading analytics dashboard',
};

function navLinkClass(isActive: boolean): string {
  if (isActive) {
    return 'rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_20px_rgba(217,70,239,0.25)]';
  }

  return 'rounded-full border border-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-primary';
}

function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-primary/25 bg-[rgba(8,8,14,0.85)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-6 lg:gap-10">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative h-11 w-11 transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/meridian-logo.png"
                alt="Meridian"
                fill
                className="object-contain drop-shadow-[0_0_16px_rgba(217,70,239,0.45)]"
              />
            </div>
            <span className="hidden text-lg font-extrabold tracking-tight sm:block nebula-gradient-text">MERIDIAN</span>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Link href="/" className={navLinkClass(pathname === '/')}>Dashboard</Link>
            <Link href="/trades" className={navLinkClass(pathname === '/trades')}>Trades</Link>
            <Link href="/analytics" className={navLinkClass(pathname === '/analytics')}>Analytics</Link>
            <Link href="/settings" className={navLinkClass(pathname === '/settings')}>Settings</Link>
          </div>
        </div>

        <UserMenu />
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <div className="nebula-orb nebula-orb-1" />
        <div className="nebula-orb nebula-orb-2" />
        <div className="nebula-orb nebula-orb-3" />
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname?.startsWith('/api/auth');
  const isOnboardingPage = pathname === '/onboarding';

  if (isAuthPage || isOnboardingPage) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Navigation />
      <main className="pt-16">
        <OnboardingGate>{children}</OnboardingGate>
      </main>
    </>
  );
}

function usePathname() {
  if (typeof window === 'undefined') return null;
  return window.location.pathname;
}
