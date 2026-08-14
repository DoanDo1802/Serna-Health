'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  FileText,
  CheckCircle2
} from 'lucide-react'
import { BaseCard } from '@/components/base/BaseCard'
import { BaseBadge } from '@/components/base/BaseBadge'
import { BaseButton } from '@/components/base/BaseButton'

export default function AppointmentsPage() {
  const appointments = [
    {
      id: 'apt-1',
      code: 'MC-20260815-001',
      doctorName: 'BS. CKII. Trần Thị Bình',
      department: 'Khoa Tim Mạch',
      date: '2026-08-15',
      timeSlot: 'Ca 1 (08:00 - 09:30)',
      room: 'Phòng 204',
      status: 'CONFIRMED',
      statusLabel: 'Đã xác nhận (Đã cọc)',
      queueNumber: 12,
      currentCalling: 8
    },
    {
      id: 'apt-2',
      code: 'MC-20260802-088',
      doctorName: 'ThS. BS. Lê Văn Cường',
      department: 'Khoa Nội Tổng Hợp',
      date: '2026-08-02',
      timeSlot: 'Ca 3 (13:30 - 15:00)',
      room: 'Phòng 102',
      status: 'FULFILLED',
      statusLabel: 'Đã hoàn thành khám'
    }
  ]

  return (
    <div className="min-h-screen pb-20">


      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="font-bold text-xl">Danh sách lịch hẹn & Hàng chờ</h1>
          <Link href="/booking">
            <BaseButton size="sm">+ Đặt lịch mới</BaseButton>
          </Link>
        </div>

        <div className="space-y-4">
          {appointments.map((apt) => (
            <BaseCard key={apt.id} className="space-y-4">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <span className="font-mono font-bold text-xs bg-[var(--secondary)] px-2.5 py-1 rounded border border-[var(--border)]">
                  {apt.code}
                </span>
                <BaseBadge variant={apt.status === 'CONFIRMED' ? 'success' : 'info'}>
                  {apt.statusLabel}
                </BaseBadge>
              </div>

              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-sm">{apt.doctorName}</h3>
                <p className="text-[var(--muted-foreground)]">{apt.department} • {apt.room}</p>
                <div className="flex gap-4 pt-1">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    {apt.date}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    {apt.timeSlot}
                  </span>
                </div>
              </div>

              {apt.queueNumber && (
                <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs space-y-2">
                  <div className="flex justify-between font-semibold">
                    <span>Hàng chờ thời gian thực:</span>
                    <span className="text-amber-800 font-mono font-bold">
                      Số của bạn: #{apt.queueNumber} — Đang gọi: #{apt.currentCalling}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--secondary)] overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(apt.currentCalling! / apt.queueNumber!) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </BaseCard>
          ))}
        </div>
      </main>
    </div>
  )
}
