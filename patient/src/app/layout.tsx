import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/providers/app-provider';
import { Header } from '@/components/features/header/header';
import { Footer } from '@/components/features/footer/footer';


export const metadata: Metadata = {
  title: 'Home | Wolverine Worldwide',
  description:
    'The story of a company that was founded on the simple desire to create good products for good people, whose own footprint can be found in approximately 200 countries and territories throughout the world.',
  openGraph: {
    title: 'Home | Wolverine Worldwide',
    description:
      'The story of a company that was founded on the simple desire to create good products for good people.',
    url: 'https://wolverineworldwide.com/',
    siteName: 'Wolverine Worldwide',
    images: [
      {
        url: 'https://d3ql15awrosklt.cloudfront.net/medias/_transforms/_1200x627_crop_center-center_none/wolverinemeta01.jpg',
        width: 1200,
        height: 627,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

import { AppShell } from '@/components/layout/app-shell';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="is-first-loaded">
      <head>
        <link rel="stylesheet" href="/css/main-2.css" />
      </head>
      <body>
        <div id="swup">
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
