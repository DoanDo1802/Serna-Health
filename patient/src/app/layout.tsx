import type { Metadata } from 'next';
import './globals.css';
import '@/styles/antigravity.css';
import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'NOVAMED',
  description:
    'Trải nghiệm nền tảng y tế thế hệ mới NOVAMED. Trợ lý y tế AI, đặt lịch khám, hồ sơ bệnh án số và công nghệ chăm sóc toàn diện.',
  openGraph: {
    title: 'NOVAMED',
    description:
      'Trải nghiệm nền tảng y tế thế hệ mới NOVAMED. Trợ lý y tế AI, đặt lịch khám, hồ sơ bệnh án số và công nghệ chăm sóc toàn diện.',
    siteName: 'NOVAMED',
    locale: 'vi_VN',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,slnt,wdth,wght,ROND@8..144,-10..0,25..150,400..700,0..100&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,400..700;1,400..700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Symbols:opsz,wght,FILL,GRAD,ROND@20..48,100..700,0..1,-50..200,0..100&display=block"
        />
        <link
          rel="modulepreload"
          href="/_astro/MainParticlesComponent.astro_astro_type_script_index_0_lang.Dox42TL8.js"
        />
        <link rel="modulepreload" href="/_astro/Mouse.ZrlRGzn3.js" />
      </head>
      <body className="antialiased selection:bg-primary selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
