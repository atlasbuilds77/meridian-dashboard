import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import { UserMenu } from "@/components/user-menu";
import { OnboardingGate } from "@/components/onboarding-gate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meridian Dashboard",
  description: "Professional trading analytics dashboard",
};

function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-6 md:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center gap-4 group">
              <div className="relative h-14 w-14 transition-transform group-hover:scale-110">
                <Image 
                  src="/meridian-logo.png" 
                  alt="Meridian" 
                  fill 
                  className="object-contain drop-shadow-[0_0_12px_rgba(0,255,136,0.4)] brightness-110"
                />
              </div>
              <span className="font-bold text-2xl tracking-tight bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
                MERIDIAN
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <Link 
                href="/" 
                className="px-4 py-2 text-sm font-medium text-foreground hover:text-profit rounded-lg hover:bg-secondary/50 transition-all"
              >
                Dashboard
              </Link>
              <Link 
                href="/trades" 
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-all"
              >
                Trades
              </Link>
              <Link 
                href="/analytics" 
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-all"
              >
                Analytics
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}>
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  'use client';
  
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname?.startsWith('/api/auth');
  const isOnboardingPage = pathname === '/onboarding';
  
  if (isAuthPage) {
    return <main>{children}</main>;
  }
  
  if (isOnboardingPage) {
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
