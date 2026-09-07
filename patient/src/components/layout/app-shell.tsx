'use client';

import React from 'react';
import { ToastProvider } from '@/components/base/toast';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <main>{children}</main>
    </ToastProvider>
  );
}
