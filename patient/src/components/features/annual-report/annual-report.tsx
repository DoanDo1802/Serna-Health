'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function AnnualReport() {
  return (
    <section className="container my-24 md:my-36">
      <motion.div
        className="rounded-[32px] overflow-hidden bg-black text-white grid grid-cols-1 lg:grid-cols-2 p-2 sm:p-3 gap-6 shadow-2xl border border-neutral-800"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        {/* Left Side Image */}
        <div className="relative aspect-[4/3] lg:aspect-auto rounded-[24px] overflow-hidden min-h-[340px] lg:min-h-[520px]">
          <img
            src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1000&auto=format&fit=crop"
            alt="Báo Cáo Chất Lượng Y Khoa 2025"
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
        </div>

        {/* Right Side Content */}
        <div className="p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-400 block mb-3">
              Ấn Phẩm Y Khoa Thường Niên
            </span>
            <h3 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-none mb-6">
              2025
              <br />
              Báo Cáo Y Khoa
            </h3>
            <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-md">
              Báo cáo thường niên 2025 tổng hợp các kết quả lâm sàng, ứng dụng kỹ thuật cao, tỷ lệ phẫu thuật thành công và cam kết an toàn người bệnh đạt chuẩn quốc tế.
            </p>
          </div>

          <div className="mt-8">
            <a
              href="#report"
              className="inline-flex items-center justify-between gap-6 bg-white/10 hover:bg-white/20 border border-white/15 p-5 rounded-2xl transition-all duration-300 group min-w-[280px]"
            >
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">
                  Tài Liệu (.PDF)
                </span>
                <span className="text-base font-bold text-white">Xem Báo Cáo Chất Lượng</span>
              </div>
              <span className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-110 transition-transform">
                ↗
              </span>
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
