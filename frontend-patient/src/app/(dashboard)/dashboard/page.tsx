'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  FileText,
  Heart,
  ChevronRight,
  Users,
  ArrowUpRight
} from 'lucide-react'
import { BaseButton } from '@/components/base/BaseButton'
import { BaseBadge } from '@/components/base/BaseBadge'
import { useAuth } from '@/hooks/useAuth'
import { Doctor } from '@/types'
import { CatalogService } from '@/services/catalog.service'
import { formatCurrency } from '@/utils'
import { MESSAGES } from '@/constants'

export default function DashboardPage() {
  const { dependents } = useAuth()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await CatalogService.listPractitioners()
        setDoctors(res.data)
      } catch (err) {
        console.error('Failed to fetch doctors', err)
      } finally {
        setLoadingDoctors(false)
      }
    }
    fetchDoctors()
  }, [])

  return (
    <>
      {/* Stat Metrics Grid (4 Top Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            title: 'Lịch Khám Sắp Tới',
            value: '1 Lịch',
            subtitle: 'Phòng 204 • 15/08',
            desc: 'So với tháng trước',
            badge: '↗ +100%',
            badgeType: 'positive'
          },
          {
            title: 'Hàng Chờ Realtime',
            value: '#12',
            subtitle: 'Đang gọi #8 (Còn 4)',
            desc: 'Cập nhật thời gian thực',
            badge: 'LIVE',
            badgeType: 'neutral'
          },
          {
            title: 'Người Phụ Thuộc',
            value: `${dependents.length}`,
            subtitle: 'Bản thân & gia đình',
            desc: 'Tài khoản liên kết',
            badge: 'TIER 0-2',
            badgeType: 'neutral'
          },
          {
            title: 'Bệnh Án Điện Tử',
            value: '2 Hồ Sơ',
            subtitle: 'DRAFT → FINALIZED',
            desc: 'Đồng bộ hệ thống HIS',
            badge: 'SYNCED',
            badgeType: 'positive'
          }
        ].map((stat, i) => {
          return (
            <div
              key={i}
              className="p-5 rounded-2xl bg-[#0a0a0a] border border-[#222] space-y-4 shadow-xs hover:border-[var(--accent)] transition-all"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[#a3a3a3]">
                  {stat.title}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${stat.badgeType === 'positive' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[#111] text-[#a3a3a3]'}`}>
                   {stat.badge}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-3xl tracking-tight text-white">
                  {stat.value}
                </h3>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-[#e5e5e5] font-medium flex items-center gap-1">
                  {stat.subtitle} <ArrowUpRight className="w-3 h-3 text-[#737373]" />
                </p>
                <p className="text-[10px] text-[#737373]">
                  {stat.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Active Appointment Live Tracker Banner */}
      <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-[#222] space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222] pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Lịch Khám Sắp Tới — Mã MC-20260815-001
            </span>
          </div>
          <BaseBadge variant="success">Đã Xác Nhận (Đã Cọc 100.000đ)</BaseBadge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 flex gap-4 items-start">
            {!loadingDoctors && doctors.length > 0 ? (
              <>
                <img
                  src={doctors[0]!.avatar}
                  alt={doctors[0]!.name}
                  className="w-16 h-16 rounded-2xl object-cover ring-1 ring-[#333] shrink-0"
                />
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-white">
                    {doctors[0]!.name}
                  </h3>
                  <p className="text-xs text-[#a3a3a3]">{doctors[0]!.title} • Khoa Tim Mạch</p>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs font-medium text-white">
                    <span>📅 Thứ Bảy, 15/08/2026</span>
                    <span>⏱️ Ca 1 (08:00 - 09:30)</span>
                    <span>📍 Phòng 204 - Tầng 2</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="animate-pulse flex gap-4 w-full">
                <div className="w-16 h-16 bg-[#222] rounded-2xl"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-[#222] rounded w-1/3"></div>
                  <div className="h-3 bg-[#222] rounded w-1/4"></div>
                </div>
              </div>
            )}
          </div>

          {/* Live Queue Progress Bar Widget */}
          <div className="lg:col-span-4 p-4 rounded-2xl bg-[#111] border border-[#222] space-y-2 text-xs text-white">
            <div className="flex justify-between items-center">
              <span className="font-bold">Hàng chờ phòng 204:</span>
              <span className="font-mono text-xs font-bold text-[var(--accent)]">
                Số của bạn: #12
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#222] overflow-hidden border border-[#333]">
              <div className="h-full bg-[var(--accent)] rounded-full w-[65%]" />
            </div>
            <div className="flex justify-between text-[11px] text-[#a3a3a3]">
              <span>Đang gọi: #8</span>
              <span>Còn khoảng 20 phút</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[#222] flex flex-wrap gap-3 justify-end">
          <Link href="/appointments">
            <BaseButton size="sm">
              Theo dõi số thứ tự
            </BaseButton>
          </Link>
          <Link href="/booking">
            <BaseButton variant="outline" size="sm">
              Đổi lịch khám
            </BaseButton>
          </Link>
        </div>
      </div>

      {/* Full Width Area Chart (SaaS Style) */}
      <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-[#222] shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h3 className="font-bold text-base text-white">
              Tần Suất Khám & Biến Thiên Sức Khỏe
            </h3>
            <p className="text-[11px] text-[#a3a3a3]">Thống kê cho 6 tháng gần nhất</p>
          </div>
          
          <div className="flex bg-[#111] border border-[#222] p-1 rounded-lg text-xs">
            <button className="px-3 py-1.5 rounded bg-[#222] text-white font-medium shadow-xs">
              6 tháng qua
            </button>
            <button className="px-3 py-1.5 rounded text-[#a3a3a3] hover:text-white transition-colors">
              30 ngày qua
            </button>
            <button className="px-3 py-1.5 rounded text-[#a3a3a3] hover:text-white transition-colors">
              7 ngày qua
            </button>
          </div>
        </div>

        {/* SVG Spline Area Chart */}
        <div className="w-full h-64 relative">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
            <defs>
              <linearGradient id="gradient-primary" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradient-secondary" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines (horizontal) */}
            <path d="M 0 50 L 1000 50" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M 0 100 L 1000 100" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M 0 150 L 1000 150" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M 0 200 L 1000 200" stroke="#222" strokeWidth="1" />

            {/* Secondary Spline (White-ish) */}
            <path
              d="M 0 150 C 200 150, 300 80, 500 80 C 700 80, 800 180, 1000 120"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeOpacity="0.4"
            />
            <path
              d="M 0 150 C 200 150, 300 80, 500 80 C 700 80, 800 180, 1000 120 L 1000 200 L 0 200 Z"
              fill="url(#gradient-secondary)"
            />

            {/* Primary Spline (Lime Green) */}
            <path
              d="M 0 180 C 150 180, 250 100, 450 120 C 650 140, 750 40, 1000 60"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <path
              d="M 0 180 C 150 180, 250 100, 450 120 C 650 140, 750 40, 1000 60 L 1000 200 L 0 200 Z"
              fill="url(#gradient-primary)"
            />
          </svg>

          {/* X-axis labels */}
          <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2 text-[10px] text-[#737373] font-mono">
            <span>T1</span>
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
          </div>
        </div>
      </div>

      {/* Recommended Doctor Carousel Grid */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-white">
            Bác Sĩ Khám Đặt Lịch Nhanh
          </h3>
          <Link href="/booking" className="text-xs font-semibold text-[#a8d946] hover:underline flex items-center gap-1">
            <span>Xem tất cả ca khám</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {loadingDoctors ? (
            Array(3).fill(null).map((_, i) => (
              <div key={i} className="p-5 rounded-2xl bg-[#0a0a0a] border border-[#222] h-[130px] animate-pulse">
                 <div className="h-full bg-[#222] rounded-xl opacity-20"></div>
              </div>
            ))
          ) : (
            doctors.map((doc) => (
              <div
                key={doc.id}
                className="p-5 rounded-2xl bg-[#0a0a0a] border border-[#222] space-y-4 hover:border-[#444] transition-all flex flex-col justify-between"
              >
                <div className="flex gap-4 items-start">
                  <img
                    src={doc.avatar}
                    alt={doc.name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0 ring-1 ring-[#333]"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-white">{doc.name}</h4>
                    <p className="text-xs text-[#a3a3a3]">{doc.title}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[#111] text-white">
                      {doc.department}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#222] flex justify-between items-center">
                  <span className="text-xs font-bold text-white">
                    {formatCurrency(doc.price)}
                  </span>
                  <Link href="/booking">
                    <BaseButton size="sm">
                      <span>{MESSAGES.DASHBOARD.BTN_CHOOSE_SLOT}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                    </BaseButton>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

