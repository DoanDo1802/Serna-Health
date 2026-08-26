'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AppContextType {
  isScrolled: boolean;
  isScrollingDown: boolean;
  hasPassedFold: boolean;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType>({
  isScrolled: false,
  isScrollingDown: false,
  hasPassedFold: false,
  dropdownOpen: false,
  setDropdownOpen: () => {},
  mobileMenuOpen: false,
  setMobileMenuOpen: () => {},
});

export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [hasPassedFold, setHasPassedFold] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync state with HTML classes for CSS selectors
  useEffect(() => {
    const root = document.documentElement;

    const handleResize = () => {
      root.style.setProperty('--vw', `${window.innerWidth * 0.01}px`);
      root.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };

    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrolled = currentScrollY > 40;
      const passedFold = currentScrollY > window.innerHeight * 0.85;
      const scrollingDown = currentScrollY > lastScrollY && currentScrollY > 120;

      setIsScrolled(scrolled);
      setHasPassedFold(passedFold);
      setIsScrollingDown(scrollingDown);

      if (scrolled) {
        root.classList.add('has-scrolled');
      } else {
        root.classList.remove('has-scrolled');
      }

      if (passedFold) {
        root.classList.add('has-passed-fold');
      } else {
        root.classList.remove('has-passed-fold');
      }

      if (scrollingDown) {
        root.classList.add('is-scrolling-down');
        root.classList.remove('is-scrolling-up');
      } else {
        root.classList.add('is-scrolling-up');
        root.classList.remove('is-scrolling-down');
      }

      lastScrollY = currentScrollY;
    };

    handleResize();
    handleScroll();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (dropdownOpen) {
      root.classList.add('has-dropdown-opened');
    } else {
      root.classList.remove('has-dropdown-opened');
    }
  }, [dropdownOpen]);

  useEffect(() => {
    const root = document.documentElement;
    if (mobileMenuOpen) {
      root.classList.add('has-mobile-menu-open');
    } else {
      root.classList.remove('has-mobile-menu-open');
    }
  }, [mobileMenuOpen]);

  return (
    <AppContext.Provider
      value={{
        isScrolled,
        isScrollingDown,
        hasPassedFold,
        dropdownOpen,
        setDropdownOpen,
        mobileMenuOpen,
        setMobileMenuOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
