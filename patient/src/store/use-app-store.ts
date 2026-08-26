import { create } from 'zustand';

interface AppState {
  isMobileMenuOpen: boolean;
  activeDropdownId: string | null;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setActiveDropdown: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isMobileMenuOpen: false,
  activeDropdownId: null,
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setActiveDropdown: (id) => set({ activeDropdownId: id }),
}));
