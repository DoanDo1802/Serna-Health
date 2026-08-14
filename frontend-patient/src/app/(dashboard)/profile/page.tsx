'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  ShieldCheck,
  Heart,
  FileText
} from 'lucide-react'
import { BaseCard } from '@/components/base/BaseCard'
import { BaseBadge } from '@/components/base/BaseBadge'
import { useAuth } from '@/hooks/useAuth'

export default function ProfilePage() {
  const { user, dependents } = useAuth()

  return (
    <div className="min-h-screen pb-20">


      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* User Card */}
        <BaseCard className="space-y-4">
          <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center font-bold text-xl">
              {user?.fullName.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-lg">{user?.fullName}</h2>
              <p className="text-xs text-[var(--muted-foreground)]">{user?.email} • {user?.phone}</p>
              <BaseBadge variant="success" className="mt-1">
                <ShieldCheck className="w-3 h-3 mr-1" />
                CCCD MANUALLY_VERIFIED
              </BaseBadge>
            </div>
          </div>

          {/* Dependents list */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider">Người phụ thuộc (PatientAccountLink):</h3>
            <div className="grid gap-2">
              {dependents.map((dep) => (
                <div key={dep.id} className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold block">{dep.fullName}</span>
                    <span className="text-[var(--muted-foreground)]">Ngày sinh: {dep.dateOfBirth}</span>
                  </div>
                  <BaseBadge variant="info">{dep.tier}</BaseBadge>
                </div>
              ))}
            </div>
          </div>
        </BaseCard>

        {/* Health Baseline Card */}
        <BaseCard className="space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-600" />
            <span>Thông tin sức khỏe nền (HealthBaseline)</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)] block">Nhóm máu:</span>
              <strong className="text-sm font-bold text-red-700">A Rh+</strong>
            </div>
            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)] block">Bệnh mạn tính:</span>
              <strong className="text-xs font-semibold">Tăng huyết áp độ 1</strong>
            </div>
            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] col-span-2">
              <span className="text-[var(--muted-foreground)] block">Dị ứng thuốc đã ghi nhận:</span>
              <strong className="text-xs font-semibold text-amber-900">Penicillin & Nhóm B-Lactam</strong>
            </div>
          </div>
        </BaseCard>
      </main>
    </div>
  )
}
