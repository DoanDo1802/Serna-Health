export interface NavItem {
  id: string;
  label: string;
  href: string;
  isExternal?: boolean;
  hasDropdown?: boolean;
}

export interface DropdownTile {
  title: string;
  description?: string;
  image?: string;
  href: string;
  ctaText?: string;
}
