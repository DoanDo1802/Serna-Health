'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Doctor } from '@/types'
import { CatalogService } from '@/services/catalog.service'
import { formatCurrency } from '@/utils'

export const LandingDoctors: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await CatalogService.listPractitioners()
        setDoctors(res.data.slice(0, 3))
      } catch (err) {
        console.error('Failed to fetch doctors', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDoctors()
  }, [])

  return (
    <section id="đội ngũ" className="py-24 sm:py-32 bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-6 space-y-16">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="max-w-xl space-y-4">
            <span className="text-sm font-semibold tracking-widest text-[#a3a3a3] uppercase">
              Chuyên Gia Y Tế
            </span>
            <h2 className="text-4xl sm:text-5xl font-medium text-white leading-tight">
              Đội ngũ bác sĩ tiêu biểu.
            </h2>
          </div>

          <Link 
            href="/auth?mode=login"
            className="px-6 py-3 rounded-xl border border-[#333] text-white font-medium hover:bg-white/5 transition-colors"
          >
            Xem tất cả bác sĩ
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-6 h-6 border-2 border-[#a8d946] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {doctors.map((doc) => (
              <div
                key={doc.id}
                className="group p-6 sm:p-8 rounded-[2rem] bg-[#111] border border-[#222] flex flex-col justify-between hover:border-[#a8d946]/50 hover:shadow-2xl hover:shadow-[#a8d946]/10 transition-all duration-300"
              >
                <div className="space-y-6">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#333] group-hover:border-[#a8d946] transition-colors">
                    <img
                      src={doc.avatar}
                      alt={doc.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <h3 className="font-bold text-xl text-white">{doc.name}</h3>
                    <p className="text-sm text-[#a3a3a3] mt-1">{doc.title}</p>
                    <div className="mt-3 inline-flex items-center px-2.5 py-1 rounded-md bg-[#222] text-[#fafafa] text-xs font-medium uppercase tracking-wider">
                      {doc.department}
                    </div>
                  </div>

                  <p className="text-sm text-[#a3a3a3] leading-relaxed font-light line-clamp-3">
                    {doc.bio}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-[#222] flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#a3a3a3] uppercase tracking-wider">Giá khám</span>
                    <span className="font-semibold text-lg text-white">
                      {formatCurrency(doc.price)}
                    </span>
                  </div>
                  <Link 
                    href="/auth?mode=login"
                    className="w-full bg-white text-black py-3 rounded-xl font-medium hover:bg-[#a8d946] hover:text-black transition-colors flex items-center justify-center gap-2"
                  >
                    Đặt lịch khám
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  )
}

