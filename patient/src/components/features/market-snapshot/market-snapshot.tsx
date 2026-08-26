'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { damping: 25, stiffness: 60 });
  const formatted = useTransform(springVal, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    if (isInView) {
      motionVal.set(value);
    }
  }, [isInView, motionVal, value]);

  useEffect(() => {
    return formatted.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = latest;
      }
    });
  }, [formatted]);

  return <span ref={ref}>0</span>;
}

export function MarketSnapshot() {
  return (
    <section className="container my-20 md:my-32 border-t border-neutral-200 pt-16 md:pt-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
        {/* Left Side Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
              Năng Lực Y Tế Sẵn Sàng
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-neutral-100 text-neutral-800 border border-neutral-300">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
              Trực 24/7/365
            </span>
          </div>

          <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-neutral-900 mb-2">
            Hệ Thống Bệnh Viện Quốc Tế
          </h3>
          <p className="text-neutral-500 text-sm">
            Hạ tầng y tế kỹ thuật cao · Sẵn sàng tiếp nhận cấp cứu và điều trị nội trú
          </p>

          <div className="mt-6">
            <a
              href="#booking"
              className="c-button -ghost text-black"
              style={{ color: 'var(--color-black)', border: '1px solid #e5e5e5' }}
            >
              <div className="c-button_inner">
                <span className="text-xs font-mono uppercase tracking-wider">Tổng Đài Cấp Cứu 1900 6868</span>
                <span className="c-icon"><svg className="svg-external"><use xlinkHref="/sprite.svg#external" /></svg></span>
              </div>
            </a>
          </div>
        </motion.div>

        {/* Right Side Live Ticker Numbers */}
        <motion.div
          className="flex flex-col gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="flex items-baseline gap-4">
            <span className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight text-neutral-900 leading-none">
              <AnimatedNumber value={1500} />
            </span>
            <span className="text-sm font-mono uppercase tracking-widest text-neutral-400">
              Giường Bệnh
            </span>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-neutral-200">
            <div>
              <dt className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Phòng Mổ Hybrid
              </dt>
              <dd className="text-base font-bold text-neutral-900 mt-1">32 Phòng</dd>
            </div>
            <div>
              <dt className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Máy MRI & CT 768
              </dt>
              <dd className="text-base font-bold text-neutral-900 mt-1">100% Sẵn Sàng</dd>
            </div>
            <div>
              <dt className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Hồi Sức Cấp Cứu ICU
              </dt>
              <dd className="text-base font-bold text-neutral-900 mt-1">120 Giường</dd>
            </div>
            <div>
              <dt className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Chuẩn Chất Lượng
              </dt>
              <dd className="text-base font-bold text-neutral-900 mt-1">JCI Hoa Kỳ</dd>
            </div>
          </dl>
        </motion.div>
      </div>
    </section>
  );
}
