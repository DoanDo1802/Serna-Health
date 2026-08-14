'use client'

import React from 'react'

export const LandingFooter: React.FC = () => {
  return (
    <footer className="w-full mt-48 pb-4">
      
      {/* Main Green Footer (Relative Container for CTA) */}
      <div className="relative bg-[#a8d946] pt-64 pb-12 px-6 rounded-t-[3rem] rounded-b-[2rem] mx-0 md:mx-4 lg:mx-8">
        
        {/* Floating CTA Card (Intersecting exactly halfway on the top edge) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-4xl z-20">
          <div className="bg-white rounded-[2rem] p-12 md:p-16 text-center shadow-2xl relative overflow-hidden">
            {/* Subtle Background blur/mesh in CTA */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply" 
              style={{
                backgroundImage: `
                  radial-gradient(circle at 20% 80%, rgba(168, 217, 70, 0.4), transparent 50%),
                  radial-gradient(circle at 80% 20%, rgba(74, 227, 181, 0.3), transparent 50%)
                `
              }}
            />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tighter text-black mb-10 max-w-2xl mx-auto leading-tight">
                Bắt đầu trải nghiệm y tế số tuyệt vời ngay hôm nay
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                <div className="w-full bg-[#111] rounded-2xl flex items-center p-2 pl-4 relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail text-neutral-400 absolute left-4"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                  <input 
                    type="email" 
                    placeholder="Nhập email của bạn" 
                    className="bg-transparent text-white border-none outline-none w-full pl-10 pr-4 text-sm placeholder:text-neutral-500"
                  />
                  <button className="bg-white text-black px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap hover:bg-neutral-200 transition-colors">
                    Đăng ký ngay →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Content */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-24 relative z-10 mt-16 md:mt-24">

          
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                M
              </div>
              <span className="font-bold text-xl block leading-tight text-black tracking-tight">
                MediCore
              </span>
            </div>
          </div>

          <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-xs font-semibold text-black/60 uppercase tracking-wider mb-6">Menu</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-sm text-black font-medium hover:opacity-70 transition-opacity">Khách Hàng</a></li>
                <li><a href="#" className="text-sm text-black font-medium hover:opacity-70 transition-opacity">Tài Nguyên</a></li>
                <li><a href="#" className="text-sm text-black font-medium hover:opacity-70 transition-opacity">Tuyển Dụng</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-black/60 uppercase tracking-wider mb-6">Công Ty</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-sm text-black font-medium hover:opacity-70 transition-opacity">Hỗ Trợ</a></li>
                <li><a href="#" className="text-sm text-black font-medium hover:opacity-70 transition-opacity">Điều Khoản</a></li>
                <li><a href="#" className="text-sm text-black font-medium hover:opacity-70 transition-opacity">Bảo Mật</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-black/60 uppercase tracking-wider mb-6">Mạng Xã Hội</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-sm text-black font-medium hover:opacity-70 transition-opacity">X (Twitter)</a></li>
                <li><a href="#" className="text-sm text-black font-medium hover:opacity-70 transition-opacity">LinkedIn</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-24 text-center text-sm text-black/60 font-medium relative z-10">
          © 2026 MediCore. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
