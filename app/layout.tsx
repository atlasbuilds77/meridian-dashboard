import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { UserMenu } from '@/components/user-menu';
import { NavLinks } from '@/components/nav-links';
import { LayoutContentInner } from '@/components/layout-content';
import { MobileNav } from '@/components/mobile-nav';

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
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Meridian',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  themeColor: '#8b5cf6',
};

function Navigation() {
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

          <NavLinks />
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
        <Navigation />
        <LayoutContentInner>
          <div className="pb-20 md:pb-0">{children}</div>
        </LayoutContentInner>
        <MobileNav />
      </body>
    </html>
  );
}
