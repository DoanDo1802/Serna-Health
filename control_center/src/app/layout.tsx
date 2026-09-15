import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/base/providers/theme-provider"
import { SessionDataProvider } from "@/components/base/providers/data-provider"
import { AuthProvider } from "@/components/base/providers/auth-provider"
import { Toaster } from "@/components/base/ui/toaster"
import "../styles/globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "NOVAMED Control Center - Hệ Thống Quản Trị & Bệnh Án Điện Tử",
  description: "Hệ thống quản trị y tế, quản lý khám bệnh và hồ sơ bệnh án điện tử NOVAMED",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className="bg-background" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider defaultTheme="light" storageKey="medadmin-theme">
          <AuthProvider>
            <SessionDataProvider>{children}</SessionDataProvider>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
