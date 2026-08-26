'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function CareerPush() {
  return (
    <section className="relative w-full rounded-t-[40px] bg-neutral-950 text-white px-6 py-28 md:py-44 overflow-hidden mt-20">
      {/* Background Image with Zoom & Dark Gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=1920&auto=format&fit=crop"
          alt="Đội Ngũ Y Bác Sĩ Bệnh Viện"
          className="w-full h-full object-cover opacity-35 scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950/40" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center gap-8">
        <motion.span
          className="text-xs font-mono uppercase tracking-widest text-neutral-400"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Cơ Hội Nghề Nghiệp
        </motion.span>

        <motion.h2
          className="text-4xl sm:text-6xl md:text-8xl font-bold tracking-tight text-white leading-[0.9]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          Kiến Tạo Tương Lai Y Tế Cùng Chúng Tôi.
        </motion.h2>

        <motion.p
          className="text-neutral-300 text-lg md:text-xl max-w-2xl leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Dù ở bất kỳ vị trí nào, cánh cửa luôn mở rộng để bạn cống hiến y đức, phát triển chuyên môn sâu và mang lại giá trị bền vững cho sức khỏe cộng đồng.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <a
            href="#careers"
            className="inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-8 py-4 rounded-full hover:bg-neutral-200 transition-all shadow-xl hover:scale-105"
          >
            <span>Gia Nhập Đội Ngũ Y Tế</span>
            <span className="c-icon"><svg className="w-3.5 h-3.5 fill-current"><use xlinkHref="/sprite.svg#external" /></svg></span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
