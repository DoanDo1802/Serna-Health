'use client';

import React from 'react';
import Link from 'next/link';

const SPECIALTY_LINKS = [
  { name: 'Tim Mạch Can Thiệp', link: '#cardiology' },
  { name: 'Phẫu Thuật Robot', link: '#surgery' },
  { name: 'Ung Bướu & Xạ Trị', link: '#oncology' },
  { name: 'Thần Kinh & Cột Sống', link: '#neurology' },
  { name: 'Nhi Khoa & Sơ Sinh', link: '#pediatrics' },
  { name: 'Sản Phụ Khoa & IVF', link: '#ivf' },
  { name: 'Chấn Thương Chỉnh Hình', link: '#orthopedics' },
  { name: 'Cấp Cứu 24/7 & ICU', link: '#emergency' },
  { name: 'Chẩn Đoán Hình Ảnh MRI', link: '#radiology' },
  { name: 'Tiêu Hóa & Gan Mật', link: '#gastro' },
  { name: 'Phục Hồi Chức Năng', link: '#rehab' },
];

const NAV_LINKS = [
  { label: 'Giới Thiệu', href: '#about', isExternal: false },
  { label: 'Chuyên Khoa', href: '#specialties', isExternal: false },
  { label: 'Bác Sĩ', href: '#doctors', isExternal: false },
  { label: 'Dịch Vụ Y Tế', href: '#services', isExternal: false },
  { label: 'Đặt Lịch Khám', href: '#booking', isExternal: false },
  { label: 'Liên Hệ & Cấp Cứu', href: '#contact', isExternal: false },
];

export function Footer() {
  return (
    <footer className="bg-neutral-950 text-white pt-12 pb-8 border-t border-white/10">
      <div className="container max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-12 flex flex-col gap-12 sm:gap-16">
        {/* Section 1: Specialty Directory Links */}
        <div className="pb-10 border-b border-white/10">
          <p className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-5">
            Danh Mục Chuyên Khoa Mũi Nhọn
          </p>
          <ul className="flex flex-wrap items-center gap-x-6 sm:gap-x-8 gap-y-3 list-none m-0 p-0 text-sm">
            {SPECIALTY_LINKS.map((spec) => (
              <li key={spec.name}>
                <Link
                  href={spec.link}
                  className="text-neutral-400 hover:text-white transition-colors duration-200 inline-flex items-center gap-1 group font-medium"
                >
                  <span>{spec.name}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs">
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Section 2: Logo + Large Menu + Medical Mission & Hotlines */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left Column: Logo & Large Navigation */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            <Link href="/" className="inline-flex items-center gap-2 text-white hover:opacity-85 transition-opacity" aria-label="International Hospital">
              <span className="font-bold text-lg sm:text-xl tracking-[0.16em] uppercase text-white">
                INTERNATIONAL HOSPITAL
              </span>
            </Link>

            <nav>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 list-none m-0 p-0">
                {NAV_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xl sm:text-2xl font-bold tracking-tight text-white hover:text-neutral-300 transition-colors inline-flex items-center gap-2 group"
                    >
                      <span>{link.label}</span>
                      <span className="text-sm opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                        {link.isExternal ? '↗' : '→'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Right Column: Mission Paragraph & Monochrome Buttons */}
          <div className="lg:col-span-5 flex flex-col gap-6 lg:border-l lg:border-white/10 lg:pl-12">
            <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
              Hệ thống Bệnh viện Quốc tế cam kết mang đến dịch vụ y tế chuẩn mực cao nhất, an toàn, chuẩn xác và ấm áp như gia đình, ứng dụng kỹ thuật cao trong chẩn đoán và điều trị vì sự sống của người bệnh.
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <a
                href="tel:19006868"
                className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white border border-white/20 hover:border-white px-4 py-2 rounded-full transition-all duration-200 inline-flex items-center gap-2"
              >
                <span>Cấp Cứu: 1900 6868</span>
                <span>↗</span>
              </a>
              <a
                href="#booking"
                className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white border border-white/20 hover:border-white px-4 py-2 rounded-full transition-all duration-200 inline-flex items-center gap-2"
              >
                <span>Tư Vấn Khám Bệnh</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>

        {/* Section 3: Bottom Copyright & Legal Links */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-400">
          <p className="m-0">
            © {new Date().getFullYear()} International Hospital. All rights reserved.
          </p>

          <ul className="flex items-center gap-6 list-none m-0 p-0">
            <li>
              <a
                href="#privacy"
                className="hover:text-white transition-colors"
              >
                Bảo Mật Bệnh Án
              </a>
            </li>
            <li>
              <a
                href="#terms"
                className="hover:text-white transition-colors"
              >
                Điều Khoản Sử Dụng
              </a>
            </li>
            <li>
              <a
                href="#regulation"
                className="hover:text-white transition-colors"
              >
                Quy Định Khám Bệnh
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
