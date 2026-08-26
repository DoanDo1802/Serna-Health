'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { useApp } from '@/providers/app-provider';

export function Header() {
  const {
    isScrolled,
    isScrollingDown,
    hasPassedFold,
    dropdownOpen,
    setDropdownOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useApp();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 200);
  };

  const isHidden = isScrollingDown && hasPassedFold && !dropdownOpen && !mobileMenuOpen;

  return (
    <header
      className={`fixed top-3 inset-x-0 z-50 flex justify-center px-4 sm:px-6 pointer-events-none transition-transform duration-300 ease-out ${
        isHidden ? '-translate-y-24' : 'translate-y-0'
      }`}
    >
      <div
        className={`pointer-events-auto flex items-center justify-between w-full max-w-[1360px] px-6 sm:px-8 py-3 text-white relative rounded-full border shadow-2xl transition-colors duration-300 ${
          isScrolled
            ? 'bg-black/80 backdrop-blur-2xl border-white/20'
            : 'bg-black/50 backdrop-blur-xl border-white/15'
        }`}
      >
        {/* Hospital English Brand Logo in Clean Monochrome */}
        <Link
          href="/"
          className="flex items-center gap-2 text-white hover:opacity-85 transition-opacity"
          aria-label="International Hospital"
        >
          <span className="font-bold text-sm sm:text-base tracking-[0.18em] uppercase text-white">
            INTERNATIONAL HOSPITAL
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center">
          <ul className="flex items-center gap-7 lg:gap-8 list-none m-0 p-0">
            <li>
              <a
                href="#about"
                className="text-white/85 hover:text-white text-sm font-medium transition-colors"
              >
                Giới Thiệu
              </a>
            </li>
            <li>
              <a
                href="#specialties"
                className="text-white/85 hover:text-white text-sm font-medium transition-colors"
              >
                Chuyên Khoa
              </a>
            </li>
            <li>
              <a
                href="#careers"
                className="text-white/85 hover:text-white text-sm font-medium transition-colors"
              >
                Tuyển Dụng
              </a>
            </li>
            <li
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className="text-white/85 hover:text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors bg-transparent border-none cursor-pointer p-0"
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span>Dịch Vụ Y Tế</span>
                <span className="inline-flex items-center">
                  <svg
                    className={`w-2.5 h-2.5 fill-current transition-transform duration-200 ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  >
                    <use xlinkHref="/sprite.svg#chevron-down" />
                  </svg>
                </span>
              </button>
            </li>
            <li>
              <a
                href="/auth"
                className="text-white/85 hover:text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-1.5 rounded-full"
              >
                <span>Tài Khoản</span>
                <span className="inline-flex items-center opacity-70">
                  <svg className="w-3 h-3 fill-current">
                    <use xlinkHref="/sprite.svg#external" />
                  </svg>
                </span>
              </a>
            </li>
          </ul>
        </nav>

        {/* Mobile Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-white font-semibold text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 px-2 py-1"
          aria-label="Mở Menu"
        >
          <span>{mobileMenuOpen ? 'Đóng' : 'Menu'}</span>
          <span aria-hidden="true">{mobileMenuOpen ? '✕' : '+'}</span>
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-3 p-4 bg-neutral-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl grid grid-cols-1 sm:grid-cols-4 gap-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <p className="text-base font-bold text-white mb-2">Dịch Vụ Y Tế</p>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Đồng hành chăm sóc sức khỏe toàn diện với tiêu chuẩn quốc tế và sự tận tâm hàng đầu.
                </p>
              </div>
              <a
                href="#services"
                className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-2 rounded-full w-fit mt-4 transition-all"
              >
                <span>Xem Dịch Vụ</span>
                <span>→</span>
              </a>
            </div>

            <a
              href="#purpose"
              className="relative group rounded-2xl overflow-hidden min-h-[170px] flex flex-col justify-end p-4 border border-white/10"
            >
              <img
                src="https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=600&auto=format&fit=crop"
                alt="Khám Lâm Sàng"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <span className="relative z-10 text-sm font-bold text-white">Khám Lâm Sàng →</span>
            </a>

            <a
              href="#planet"
              className="relative group rounded-2xl overflow-hidden min-h-[170px] flex flex-col justify-end p-4 border border-white/10"
            >
              <img
                src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=600&auto=format&fit=crop"
                alt="Phẫu Thuật Kỹ Thuật Cao"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <span className="relative z-10 text-sm font-bold text-white">Phẫu Thuật Kỹ Thuật Cao →</span>
            </a>

            <a
              href="#product"
              className="relative group rounded-2xl overflow-hidden min-h-[170px] flex flex-col justify-end p-4 border border-white/10"
            >
              <img
                src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop"
                alt="Chẩn Đoán Hình Ảnh"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <span className="relative z-10 text-sm font-bold text-white">Chẩn Đoán Hình Ảnh →</span>
            </a>
          </div>
        )}
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-4 top-16 bg-neutral-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 z-50 pointer-events-auto md:hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="flex flex-col gap-4 list-none m-0 p-0 text-lg font-semibold text-white">
            <li>
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-neutral-300 block py-1"
              >
                Giới Thiệu
              </a>
            </li>
            <li>
              <a
                href="#specialties"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-neutral-300 block py-1"
              >
                Chuyên Khoa
              </a>
            </li>
            <li>
              <a
                href="#careers"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-neutral-300 block py-1"
              >
                Tuyển Dụng
              </a>
            </li>
            <li>
              <a
                href="#services"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-neutral-300 block py-1"
              >
                Dịch Vụ Y Tế
              </a>
            </li>
            <li>
              <a
                href="#booking"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-neutral-300 block py-1 inline-flex items-center gap-1.5"
              >
                <span>Đặt Lịch Khám</span>
                <span className="opacity-70">↗</span>
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
