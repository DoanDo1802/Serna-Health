'use client'

import React from 'react'

export const LandingFeatures: React.FC = () => {
  return (
    <section id="giải pháp" className="w-full bg-[#0a0a0a] px-6 py-24 border-t border-[#222]">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Intro */}
        <p className="text-3xl font-medium text-justify tracking-tight leading-snug text-white sm:text-4xl lg:text-[42px] lg:leading-snug mb-16 w-full" style={{ textAlign: 'justify', textJustify: 'inter-word' }}>
          <span className="opacity-50">Hiện đại hóa trải nghiệm khám bệnh. </span>Hệ thống y tế số giúp bệnh viện đồng bộ hóa mọi điểm chạm của bệnh nhân, kết hợp <span className="text-[#a8d946] font-serif italic">chuyên môn y khoa</span> với năng lực tự động hóa.
        </p>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">
          
          {/* Card 1: SlotHold (Neon Green) */}
          <div className="group bg-[#a8d946] rounded-[2rem] p-8 pb-0 overflow-hidden min-h-[400px] md:row-span-2 flex flex-col transition-transform hover:scale-[1.01]">
            <div className="relative z-10 text-center mb-6">
              <h3 className="text-2xl md:text-4xl font-medium text-black leading-tight mb-3">
                SlotHold Capacity-Safe
              </h3>
              <p className="text-black/80 text-sm max-w-xs mx-auto">
                Tự động khóa chỗ 5 phút, đảm bảo không bao giờ quá tải lịch khám.
              </p>
            </div>
            
            <div className="flex-1 flex justify-center items-end mt-4">
              <div className="relative bg-white shadow-2xl overflow-hidden z-10 w-56 md:w-64 h-72 rounded-t-[2rem] border-4 border-black/10 border-b-0 p-5">
                <h4 className="text-3xl font-medium text-black leading-none tracking-tight mt-4">Lịch khám của bạn</h4>
                <h4 className="text-3xl font-medium text-black leading-none tracking-tight mb-4">đã sẵn sàng!</h4>
                <p className="text-sm text-neutral-500 leading-snug mb-8">Thanh toán cọc ngay để xác nhận.</p>
                <div className="w-full h-12 bg-black text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md">
                  Xác nhận cọc
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Real-time Queue (Dark) */}
          <div className="group bg-[#111] rounded-[2rem] p-8 overflow-hidden min-h-[300px] relative flex flex-col md:flex-row items-center border border-[#222]">
            <div className="relative z-10 md:max-w-[50%] flex flex-col h-full justify-center">
              <h3 className="text-xl md:text-2xl font-medium text-white leading-tight mb-3">
                Hàng chờ thời gian thực
              </h3>
              <p className="text-[#a3a3a3] text-sm">
                Theo dõi số thứ tự trực tiếp trên điện thoại. Không cần xếp hàng chờ đợi tại viện.
              </p>
            </div>

            <div className="relative md:absolute mt-8 md:mt-0 md:right-12 md:top-1/2 md:-translate-y-1/2 flex items-center justify-center self-center md:self-auto">
               <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                 <div className="absolute size-56 border border-[#a8d946]/30 rounded-full"></div>
                 <div className="absolute size-72 border border-[#a8d946]/20 rounded-full"></div>
               </div>
               <div className="relative bg-[#0a0a0a] shadow-2xl overflow-hidden z-10 w-44 h-56 rounded-3xl border-2 border-[#222] flex flex-col items-center justify-center">
                  <div className="text-[#a8d946] font-bold text-6xl">#12</div>
                  <div className="text-white/60 text-sm mt-2">Phòng Khám 102</div>
               </div>
            </div>
          </div>

          {/* Card 3: Metrics (Dark) */}
          <div className="group bg-[#111] rounded-[2rem] p-6 md:p-8 flex flex-col min-h-[250px] border border-[#222]">
            <div className="mb-auto">
              <h3 className="text-xl md:text-2xl font-medium text-white leading-tight mb-2">
                Hạ tầng chuyên biệt
              </h3>
              <p className="text-[#a3a3a3] text-sm">
                Sẵn sàng phục vụ cho quy mô bệnh viện lớn
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-6">
              <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#222] rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚀</span>
                  <span className="text-white font-medium text-sm">10,000+ Lượt khám</span>
                </div>
                <span className="text-[#a8d946] text-xs font-medium bg-[#a8d946]/10 px-2 py-1 rounded">Hàng ngày</span>
              </div>
              <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#222] rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-white font-medium text-sm">99.9% Uptime</span>
                </div>
                <span className="text-[#a8d946] text-xs font-medium bg-[#a8d946]/10 px-2 py-1 rounded">+0.2%</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
