'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { CULTURE_STATS } from '@/constants/stats';

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { damping: 30, stiffness: 80 });
  const rounded = useTransform(springVal, (latest) => Math.round(latest));

  useEffect(() => {
    if (isInView) {
      motionVal.set(value);
    }
  }, [isInView, motionVal, value]);

  useEffect(() => {
    return rounded.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${latest}%`;
      }
    });
  }, [rounded]);

  return <span ref={ref}>0%</span>;
}

export function CultureStats() {
  return (
    <section className="container my-20 md:my-32 border-t border-neutral-200 pt-16 md:pt-24">
      {/* 2-Column Heading & Mission Text */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 mb-20">
        <motion.h2
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 leading-[1.05]"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          Đa chuyên khoa,
          <br />
          chung một y đức,
          <br />
          tận tâm vì sự sống.
        </motion.h2>

        <motion.div
          className="flex flex-col items-start gap-6 text-neutral-600 text-lg md:text-xl leading-relaxed"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <p>
            Môi trường y khoa chuẩn mực nuôi dưỡng tinh thần trách nhiệm, chuyên môn sâu và sự thấu cảm. Đội ngũ y bác sĩ, điều dưỡng và kỹ thuật viên luôn nỗ lực vì sự an toàn và sức khỏe tốt nhất của từng người bệnh.
          </p>
          <a
            href="#careers"
            className="inline-flex items-center gap-2 text-sm font-bold text-neutral-900 border-b-2 border-neutral-900 pb-0.5 hover:opacity-70 transition-opacity"
          >
            <span>Cơ Hội Nghề Nghiệp Y Khoa</span>
            <span className="c-icon"><svg className="w-3.5 h-3.5 fill-current"><use xlinkHref="/sprite.svg#external" /></svg></span>
          </a>
        </motion.div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 border-t border-neutral-100 pt-12">
        {CULTURE_STATS.map((stat, index) => (
          <motion.div
            key={stat.id}
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: index * 0.15 }}
          >
            <span className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight text-neutral-900 leading-none">
              <AnimatedCounter value={stat.percentage} />
            </span>
            <p className="text-neutral-600 text-base md:text-lg leading-relaxed max-w-sm">
              {stat.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
