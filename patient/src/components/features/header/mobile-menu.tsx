'use client';

import React from 'react';
import { useAppStore } from '@/store/use-app-store';
import { NAV_ITEMS } from '@/constants/navigation';
import { BaseButton } from '@/components/base/base-button';
import { BaseIcon } from '@/components/base/base-icon';

export function MobileMenu() {
  const { isMobileMenuOpen, setMobileMenuOpen } = useAppStore();

  if (!isMobileMenuOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-6 pt-24 animate-fade-in md:hidden">
      <nav className="flex flex-col gap-6">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className="text-3xl font-bold text-white hover:text-neutral-300 flex items-center justify-between border-b border-white/10 pb-4"
          >
            <span>{item.label}</span>
            {item.isExternal ? (
              <BaseIcon name="external" className="w-5 h-5 opacity-70" />
            ) : (
              <span className="text-xl">→</span>
            )}
          </a>
        ))}
      </nav>

      <div className="pt-6 border-t border-white/10 flex flex-col gap-4">
        <BaseButton
          href="https://investors.wolverineworldwide.com/"
          variant="glass"
          size="lg"
          isExternal
          className="w-full justify-between"
        >
          Investor Relations
        </BaseButton>
        <p className="text-xs text-neutral-500 text-center">
          © {new Date().getFullYear()} Wolverine Worldwide. All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
