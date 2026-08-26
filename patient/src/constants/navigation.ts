import { DropdownTile, NavItem } from '@/types/navigation';

export const NAV_ITEMS: NavItem[] = [
  { id: 'about', label: 'About', href: 'https://wolverineworldwide.com/about-us' },
  { id: 'brands', label: 'Brands', href: 'https://wolverineworldwide.com/brands' },
  { id: 'careers', label: 'Careers', href: 'https://wolverineworldwide.com/careers' },
  { id: 'responsibility', label: 'Responsibility', href: 'https://wolverineworldwide.com/responsibility', hasDropdown: true },
  { id: 'investors', label: 'Investors', href: 'https://investors.wolverineworldwide.com/', isExternal: true },
];

export const RESPONSIBILITY_TILES: DropdownTile[] = [
  {
    title: 'Responsibility',
    description: 'Together we will build a better future from the ground up',
    href: 'https://wolverineworldwide.com/responsibility',
    ctaText: 'View',
  },
  {
    title: 'Purpose',
    image: 'https://d3ql15awrosklt.cloudfront.net/medias/_transforms/main-menu/responsibility/_600x400_crop_center-center_none/100/menu-reponsibility-1.webp',
    href: 'https://wolverineworldwide.com/responsibility#purpose',
    ctaText: 'Purpose',
  },
  {
    title: 'Planet',
    image: 'https://d3ql15awrosklt.cloudfront.net/medias/_transforms/main-menu/responsibility/_600x400_crop_center-center_none/103/menu-reponsibility-2.webp',
    href: 'https://wolverineworldwide.com/responsibility#planet',
    ctaText: 'Planet',
  },
  {
    title: 'Product',
    image: 'https://d3ql15awrosklt.cloudfront.net/medias/_transforms/main-menu/responsibility/_600x400_crop_center-center_none/104/menu-reponsibility-3.webp',
    href: 'https://wolverineworldwide.com/responsibility#product',
    ctaText: 'Product',
  },
];
