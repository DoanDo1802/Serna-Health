'use client'

import React from 'react'

export const LandingSteps: React.FC = () => {
  return (
    <section id="quy trình" className="py-24 sm:py-32 bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-6">
        
        <div className="mb-16">
          <span className="text-sm font-semibold tracking-widest text-[#a3a3a3] uppercase">
            Luồng Hoạt Động
          </span>
          <h2 className="text-4xl sm:text-5xl font-medium text-white leading-tight mt-4">
            Quy trình được thiết kế <br className="hidden sm:block" />
            <span className="text-[#a8d946] italic font-serif">tối ưu hóa.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#333] to-transparent -translate-y-1/2 -z-10" />

          {/* Step 1 */}
          <div className="group relative bg-[#111] border border-[#222] rounded-[2rem] p-8 hover:border-[#a8d946]/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-[#333] flex items-center justify-center text-white font-bold text-lg mb-6 group-hover:bg-[#a8d946] group-hover:text-black group-hover:border-[#a8d946] transition-all">
              1
            </div>
            <h3 className="font-semibold text-2xl text-white mb-3">
              Khám phá & Chọn lọc
            </h3>
            <p className="text-sm text-[#a3a3a3] leading-relaxed">
              Tìm kiếm bác sĩ theo chuyên khoa, đọc đánh giá và chọn khung giờ phù hợp nhất với lịch trình của bạn.
            </p>
          </div>

          {/* Step 2 */}
          <div className="group relative bg-[#111] border border-[#222] rounded-[2rem] p-8 hover:border-[#a8d946]/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-[#333] flex items-center justify-center text-white font-bold text-lg mb-6 group-hover:bg-[#a8d946] group-hover:text-black group-hover:border-[#a8d946] transition-all">
              2
            </div>
            <h3 className="font-semibold text-2xl text-white mb-3">
              SlotHold & Thanh Toán
            </h3>
            <p className="text-sm text-[#a3a3a3] leading-relaxed">
              Hệ thống tự động khóa chỗ trong 5 phút. Thanh toán cọc nhanh chóng qua VietQR để xác nhận lịch.
            </p>
          </div>

          {/* Step 3 */}
          <div className="group relative bg-[#111] border border-[#222] rounded-[2rem] p-8 hover:border-[#a8d946]/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-[#333] flex items-center justify-center text-white font-bold text-lg mb-6 group-hover:bg-[#a8d946] group-hover:text-black group-hover:border-[#a8d946] transition-all">
              3
            </div>
            <h3 className="font-semibold text-2xl text-white mb-3">
              Khám Bệnh Dễ Dàng
            </h3>
            <p className="text-sm text-[#a3a3a3] leading-relaxed">
              Nhận thông báo cập nhật hàng chờ theo thời gian thực và trải nghiệm quy trình khám bệnh không ma sát.
            </p>
          </div>

        </div>

      </div>
    </section>
  )
}
