import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import '@/index.css'
import { AppProvider } from '../providers/AppProvider'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans'
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-jakarta'
})

export const metadata: Metadata = {
  title: 'MediCore — Cổng Bệnh Nhân',
  description: 'Hệ thống đặt lịch khám, thanh toán cọc an toàn & theo dõi bệnh án điện tử MediCore'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`dark ${inter.variable} ${jakarta.variable}`}>
      <body className="antialiased bg-[#0a0a0a] text-white font-sans selection:bg-[#a8d946] selection:text-black">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}
