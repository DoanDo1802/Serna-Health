'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Clock,
  User,
  FileText,
  Bell,
  LogOut,
  Search,
  Plus,
  Users
} from 'lucide-react'
import { BaseButton } from '@/components/base/BaseButton'
import { useAuth } from '@/hooks/useAuth'
import { MESSAGES } from '@/constants'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  // Helper function to check active state
  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true
    if (href !== '/dashboard' && pathname.startsWith(href)) return true
    return false
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside className="w-64 bg-[#0a0a0a] border-r border-[#222] flex flex-col justify-between hidden md:flex shrink-0 sticky top-0 h-screen p-6">
        <div className="space-y-8">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg">
              M
            </div>
            <div>
              <span className="text-xl font-bold block leading-tight text-white tracking-tight">
                MediCore
              </span>
              <span className="text-[10px] text-[#a3a3a3] font-mono uppercase tracking-wider">
                PATIENT PORTAL
              </span>
            </div>
          </Link>

          {/* Navigation Links Grouped */}
          <nav className="space-y-6 text-xs font-medium">
            {[
              {
                title: 'HOME',
                items: [
                  { id: 'overview', label: MESSAGES.NAV.OVERVIEW, icon: LayoutDashboard, href: '/dashboard' }
                ]
              },
              {
                title: 'MEDICAL',
                items: [
                  { id: 'booking', label: MESSAGES.NAV.BOOKING, icon: Calendar, href: '/booking' },
                  { id: 'queue', label: MESSAGES.NAV.QUEUE, icon: Clock, href: '/appointments' }
                ]
              },
              {
                title: 'RECORDS',
                items: [
                  { id: 'dependents', label: MESSAGES.NAV.DEPENDENTS, icon: Users, href: '/profile' },
                  { id: 'records', label: MESSAGES.NAV.RECORDS, icon: FileText, href: '/records' }
                ]
              }
            ].map((section, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="px-3.5 text-[10px] font-bold text-[#555] uppercase tracking-wider">
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <Link key={item.id} href={item.href}>
                        <div
                          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                            active
                              ? 'bg-white/10 text-white font-semibold'
                              : 'text-[#a3a3a3] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 ${active ? 'text-[var(--accent)]' : ''}`} />
                            <span>{item.label}</span>
                          </div>
                          {(item as any).badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-mono font-bold">
                              {(item as any).badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="pt-4 border-t border-[#222] space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
              alt={user?.fullName || 'User'}
              className="w-9 h-9 rounded-xl object-cover ring-1 ring-[#333]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.fullName || 'Nguyễn Văn An'}</p>
              <p className="text-[10px] text-[#a3a3a3] truncate">CCCD Verified</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-[#222] text-[#a3a3a3] hover:text-white"
              title={MESSAGES.NAV.LOGOUT}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#222] px-6 sm:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg text-white">
              {MESSAGES.DASHBOARD.TITLE}
            </h1>
            <p className="text-[11px] text-[#a3a3a3] hidden sm:block">
              {MESSAGES.DASHBOARD.SUBTITLE}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Search input */}
            <div className="relative hidden md:block w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
              <input
                type="text"
                placeholder={MESSAGES.DASHBOARD.SEARCH_PLACEHOLDER}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#111] border border-[#222] text-xs text-white focus:outline-none focus:border-[#444] transition-all"
              />
            </div>

            <Link href="/booking">
              <button className="h-8 px-3.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-xs flex items-center hover:opacity-90 shadow-sm transition-all">
                <Plus className="w-3.5 h-3.5 mr-1" />
                {MESSAGES.DASHBOARD.BTN_NEW_BOOKING}
              </button>
            </Link>
          </div>
        </header>

        {/* Dashboard Main Workspace for Children */}
        <main className="p-6 sm:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
