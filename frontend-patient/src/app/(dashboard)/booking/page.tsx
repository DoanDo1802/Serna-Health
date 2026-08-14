'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Stethoscope,
  ArrowLeft,
  Clock,
  QrCode,
  CheckCircle2,
  Calendar,
  User,
  ShieldCheck
} from 'lucide-react'
import { BaseCard } from '@/components/base/BaseCard'
import { BaseButton } from '@/components/base/BaseButton'
import { BaseBadge } from '@/components/base/BaseBadge'
import { useBooking } from '@/hooks/useBooking'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatSecondsToTimer } from '@/utils'
import { MESSAGES } from '@/constants'

export default function BookingPage() {
  const {
    currentStep,
    setStep,
    selectedDoctor,
    setSelectedDoctor,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    selectedPatientId,
    setSelectedPatientId
  } = useBooking()

  const { dependents } = useAuth()
  const [timerSeconds, setTimerSeconds] = useState(300)
  const [paymentMethod, setPaymentMethod] = useState<'vietqr' | 'cash'>('vietqr')

  const mockDoctors = [
    {
      id: 'doc-01',
      name: 'BS. CKII. Trần Thị Bình',
      title: 'Phó Trưởng Khoa Tim Mạch',
      specialty: 'Tim Mạch Can Thiệp',
      department: 'Khoa Tim Mạch',
      rating: 4.9,
      price: 200000,
      avatar: 'https://images.unsplash.com/photo-1594824813566-82823d5afe4a?auto=format&fit=crop&q=80&w=256'
    },
    {
      id: 'doc-02',
      name: 'ThS. BS. Lê Văn Cường',
      title: 'Bác sĩ Điều trị Hàng đầu',
      specialty: 'Nội Tĩnh Mạch & Tiêu Hóa',
      department: 'Khoa Nội Tổng Hợp',
      rating: 4.8,
      price: 150000,
      avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=256'
    }
  ]

  return (
    <div className="min-h-screen pb-20">


      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Stepper */}
        <BaseCard className="p-4">
          <div className="flex justify-between items-center text-xs font-semibold">
            {[
              { num: 1, label: 'Bác sĩ' },
              { num: 2, label: 'Ca khám' },
              { num: 3, label: 'Đặt cọc' },
              { num: 4, label: 'Xác nhận' }
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    currentStep === s.num
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : currentStep > s.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {s.num}
                </div>
                <span className={currentStep === s.num ? 'font-bold' : 'text-[var(--muted-foreground)]'}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </BaseCard>

        {/* Step 1: Select Doctor */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg">Bước 1: Chọn Bác sĩ chuyên khoa</h2>
            <div className="grid gap-4">
              {mockDoctors.map((doc) => (
                <BaseCard key={doc.id} hoverable className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <img src={doc.avatar} alt={doc.name} className="w-14 h-14 rounded-xl object-cover" />
                    <div>
                      <h3 className="font-semibold text-sm">{doc.name}</h3>
                      <p className="text-xs text-[var(--muted-foreground)]">{doc.title} • {doc.department}</p>
                      <span className="text-xs font-bold text-emerald-800 mt-1 block">
                        Phí: {formatCurrency(doc.price)}
                      </span>
                    </div>
                  </div>
                  <BaseButton
                    onClick={() => {
                      setSelectedDoctor(doc as any)
                      setStep(2)
                    }}
                  >
                    {MESSAGES.DASHBOARD.BTN_CHOOSE_SLOT}
                  </BaseButton>
                </BaseCard>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Session */}
        {currentStep === 2 && selectedDoctor && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg">Bước 2: Chọn ngày & ca khám (Capacity Safe)</h2>
            <BaseCard className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2">Người đăng ký khám:</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm font-medium"
                >
                  {dependents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} [{d.tier}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2">Chọn ca khám khả dụng:</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: 'Ca 1 (08:00 - 09:30)', cap: 3 },
                    { name: 'Ca 3 (13:30 - 15:00)', cap: 5 }
                  ].map((sl, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedSlot({
                          id: `slot-${i}`,
                          doctorId: selectedDoctor.id,
                          date: selectedDate,
                          sessionName: sl.name,
                          timeRange: sl.name,
                          capacity: 10,
                          bookedCount: 10 - sl.cap,
                          available: true,
                          price: selectedDoctor.price
                        })
                        setStep(3)
                      }}
                      className="p-3.5 rounded-xl border border-[var(--border)] text-left hover:border-[var(--ring)] transition-all bg-[var(--background)] space-y-1"
                    >
                      <span className="font-bold text-xs block">{sl.name}</span>
                      <BaseBadge variant="success">Còn {sl.cap} chỗ</BaseBadge>
                    </button>
                  ))}
                </div>
              </div>
            </BaseCard>
          </div>
        )}

        {/* Step 3: Deposit */}
        {currentStep === 3 && selectedDoctor && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 animate-pulse" />
                <span>Đang giữ chỗ SlotHold: <strong className="font-mono text-sm">{formatSecondsToTimer(timerSeconds)}</strong></span>
              </div>
              <BaseBadge variant="warning">5 Phút Tối Đa</BaseBadge>
            </div>

            <BaseCard className="space-y-4">
              <h3 className="font-bold text-sm">Xác nhận cọc min(100.000 VNĐ)</h3>
              <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs space-y-1">
                <p>Bác sĩ: <strong>{selectedDoctor.name}</strong></p>
                <p>Ca khám: <strong>{selectedSlot?.sessionName}</strong></p>
                <p>Tiền cọc quy định: <strong className="text-emerald-800 font-bold">100.000 VNĐ</strong></p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold block">Phương thức cọc:</span>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] flex items-center gap-4">
                  <QrCode className="w-12 h-12 text-[var(--primary)]" />
                  <div className="text-xs">
                    <p className="font-bold">Quét VietQR Tự Động</p>
                    <p className="text-[var(--muted-foreground)]">Nội dung: MEDICORE SLOTHOLD 100K</p>
                  </div>
                </div>
              </div>

              <BaseButton
                onClick={() => setStep(4)}
                className="w-full py-3"
              >
                Xác nhận đã chuyển cọc 100.000đ
              </BaseButton>
            </BaseCard>
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === 4 && (
          <BaseCard className="text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold">Đặt Lịch Khám Thành Công!</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Mã lịch hẹn <strong>MC-20260815-001</strong> đã được tạo. Vui lòng xuất trình mã khi đến quầy check-in.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link href="/appointments">
                <BaseButton>Xem danh sách lịch khám</BaseButton>
              </Link>
            </div>
          </BaseCard>
        )}
      </main>
    </div>
  )
}
