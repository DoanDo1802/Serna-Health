'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

export const LandingNavbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className="fixed top-0 md:top-2.5 left-1/2 -translate-x-1/2 w-full max-w-[900px] px-2 md:px-0 z-[60] transition-all duration-300">
      <div 
        className={`flex items-center justify-between px-6 h-[72px] md:h-20 rounded-b-3xl md:rounded-[2.5rem] transition-all duration-500 bg-[#0a0a0a] text-white ${
          scrolled ? 'bg-[#0a0a0a]/90 backdrop-blur-xl shadow-2xl' : ''
        }`}
      >
        <Link href="/" className="flex items-center gap-2">

          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-black font-bold text-xs">
            M
          </div>
          <span className="text-lg font-semibold leading-none hidden md:inline">
            MediCore
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {['Giải pháp', 'Quy trình', 'Bảng giá'].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase().replace(' ', '-')}`}
              className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-full transition-colors"
            >
              {item}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link 
            href="/auth?mode=login"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            Đăng nhập
          </Link>
          
          {/* CTA Group from Template */}
          <Link 
            href="/auth?mode=register"
            className="group relative inline-flex items-center"
          >
            <span className="absolute right-0 inset-y-0 w-[calc(100%-1.5rem)] rounded-xl bg-[#a8d946]"></span>
            <span className="relative z-10 px-5 py-3 rounded-xl bg-white text-black text-sm font-medium">
              Dùng thử ngay
            </span>
            <span className="relative -left-px z-10 w-10 h-10 rounded-xl flex items-center justify-center text-black bg-transparent">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-down-right w-4 h-4 transition-transform duration-300 group-hover:-rotate-45">
                <path d="m7 7 10 10"></path>
                <path d="M17 7v10H7"></path>
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

