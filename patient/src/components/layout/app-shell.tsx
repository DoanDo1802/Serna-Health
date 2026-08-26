'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AppProvider } from '@/providers/app-provider';
import { ToastProvider } from '@/components/base/toast';
import { Header } from '@/components/features/header/header';
import { Footer } from '@/components/features/footer/footer';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalonePage =
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/signup');

  return (
    <AppProvider>
      <ToastProvider>
        {!isStandalonePage && <Header />}
        <main>{children}</main>
        {!isStandalonePage && <Footer />}
      </ToastProvider>
    </AppProvider>
  );
}
