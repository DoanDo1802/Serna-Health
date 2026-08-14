'use client'

import React from 'react'
import Link from 'next/link'

export const LandingHero: React.FC = () => {
  return (
    <section className="relative pt-40 pb-32 overflow-hidden flex flex-col items-center justify-center text-center px-4 mt-0 md:mt-2 mx-0 md:mx-4 lg:mx-8 rounded-t-[2.5rem] md:rounded-t-[3rem] border-x border-t border-black/5">
      
      {/* Background Video */}
      <video
        src="/0702.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
      />

      {/* Black Overlay */}
      <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />

      {/* Subtle Grainy Mesh Simulation (Very Light) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 mix-blend-multiply z-0" 
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 50%, rgba(168, 217, 70, 0.15), transparent 25%),
            radial-gradient(circle at 85% 30%, rgba(74, 227, 181, 0.1), transparent 25%)
          `
        }}
      />
      
      {/* Noise overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02] z-0"
        style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }}
      />

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center mt-12">
        
        {/* Availability Badge */}
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-white text-xs font-semibold uppercase tracking-wider mb-8 shadow-sm">
          Phiên bản Mới <span className="text-[#a8d946] text-sm">✦</span>
        </div>

        {/* Massive Typography Title */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.05] text-white mb-6 w-full drop-shadow-lg font-[family-name:var(--font-jakarta)]">
          <span className="block">Khám Bệnh</span>
          <span className="block mt-2">
            Nhanh Hơn <span className="text-[#a8d946] font-semibold tracking-normal pr-2">Bao Giờ Hết</span>
          </span>
        </h1>

        <p className="text-lg md:text-xl text-neutral-300 mb-10 max-w-2xl leading-relaxed font-medium drop-shadow-md">
          Nền tảng y tế số giúp bệnh nhân đặt lịch, khóa chỗ và quản lý bệnh án thông minh mà không cần chờ đợi.
        </p>

        {/* CTA Button Group */}
        <div className="flex items-center justify-center gap-0">
          <Link
            href="/auth?mode=register"
            className="h-14 px-8 bg-white text-black rounded-l-2xl font-medium text-base hover:bg-neutral-200 transition-colors flex items-center justify-center shadow-lg"
          >
            Bắt đầu ngay
          </Link>
          <Link
            href="/auth?mode=register"
            className="h-14 w-14 bg-[#a8d946] text-black rounded-r-2xl hover:bg-[#96c43d] transition-colors flex items-center justify-center group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right w-5 h-5 transition-transform duration-300 group-hover:translate-x-1">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        </div>

      </div>


      {/* Dashboard Mockup Integration */}
      <div className="relative z-10 w-full max-w-5xl mx-auto mt-24">
         <div className="relative rounded-2xl overflow-hidden border border-neutral-200 shadow-2xl bg-[#111] p-4 h-[400px] mask-gradient-bottom">
            {/* Mocking the dashboard UI inside */}
            <div className="w-full h-full border border-[#333] rounded-xl bg-[#0a0a0a] flex items-center justify-center text-white/20">
               Dashboard Mockup Area
            </div>
         </div>
      </div>

    </section>
  )
}

