'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { BRAND_PORTFOLIO } from '@/constants/brands';

interface GalaxyItemConfig {
  topPercent: number;
  leftPercent: number;
  width: string;
  parallaxRange: [number, number]; // [startOffset, endOffset] on scroll
  floatDuration: number;
  floatDelay: number;
}

const GALAXY_CONFIGS: GalaxyItemConfig[] = [
  // --- LEFT SIDE ---
  {
    topPercent: 18,
    leftPercent: 8,
    width: 'w-22 sm:w-28 md:w-36',
    parallaxRange: [60, -90],
    floatDuration: 5.2,
    floatDelay: 0,
  },
  {
    topPercent: 44,
    leftPercent: 10,
    width: 'w-20 sm:w-26 md:w-32',
    parallaxRange: [40, -60],
    floatDuration: 6.1,
    floatDelay: 1.2,
  },
  {
    topPercent: 70,
    leftPercent: 8,
    width: 'w-24 sm:w-30 md:w-38',
    parallaxRange: [70, -100],
    floatDuration: 4.8,
    floatDelay: 0.5,
  },

  {
    topPercent: 22,
    leftPercent: 25,
    width: 'w-22 sm:w-28 md:w-34',
    parallaxRange: [50, -80],
    floatDuration: 6.5,
    floatDelay: 0.8,
  },
  {
    topPercent: 50,
    leftPercent: 27,
    width: 'w-20 sm:w-26 md:w-30',
    parallaxRange: [30, -50],
    floatDuration: 5.0,
    floatDelay: 2.1,
  },
  {
    topPercent: 76,
    leftPercent: 24,
    width: 'w-22 sm:w-28 md:w-36',
    parallaxRange: [80, -110],
    floatDuration: 5.9,
    floatDelay: 1.4,
  },

  // --- CENTER ACCENTS (Top & Bottom) ---
  {
    topPercent: 12,
    leftPercent: 50,
    width: 'w-22 sm:w-28 md:w-36',
    parallaxRange: [40, -70],
    floatDuration: 6.8,
    floatDelay: 0.3,
  },
  {
    topPercent: 84,
    leftPercent: 50,
    width: 'w-22 sm:w-28 md:w-34',
    parallaxRange: [60, -90],
    floatDuration: 5.4,
    floatDelay: 1.6,
  },

  // --- RIGHT SIDE ---
  {
    topPercent: 20,
    leftPercent: 75,
    width: 'w-22 sm:w-28 md:w-36',
    parallaxRange: [50, -80],
    floatDuration: 5.6,
    floatDelay: 1.0,
  },
  {
    topPercent: 48,
    leftPercent: 73,
    width: 'w-20 sm:w-26 md:w-30',
    parallaxRange: [30, -60],
    floatDuration: 6.3,
    floatDelay: 0.6,
  },
  {
    topPercent: 74,
    leftPercent: 76,
    width: 'w-24 sm:w-30 md:w-38',
    parallaxRange: [70, -100],
    floatDuration: 4.9,
    floatDelay: 1.9,
  },

  {
    topPercent: 16,
    leftPercent: 91,
    width: 'w-20 sm:w-26 md:w-32',
    parallaxRange: [60, -90],
    floatDuration: 6.0,
    floatDelay: 0.4,
  },
  {
    topPercent: 42,
    leftPercent: 90,
    width: 'w-24 sm:w-30 md:w-38',
    parallaxRange: [40, -70],
    floatDuration: 5.3,
    floatDelay: 1.5,
  },
  {
    topPercent: 68,
    leftPercent: 92,
    width: 'w-22 sm:w-28 md:w-34',
    parallaxRange: [80, -110],
    floatDuration: 6.7,
    floatDelay: 0.9,
  },
  {
    topPercent: 86,
    leftPercent: 86,
    width: 'w-20 sm:w-24 md:w-30',
    parallaxRange: [50, -80],
    floatDuration: 5.8,
    floatDelay: 1.1,
  },
];

function ParallaxBrandItem({
  brand,
  config,
  scrollYProgress,
}: {
  brand: (typeof BRAND_PORTFOLIO)[0];
  config: GalaxyItemConfig;
  scrollYProgress: any;
}) {
  const yParallax = useTransform(scrollYProgress, [0.1, 0.5], config.parallaxRange);

  return (
    <motion.div
      className="absolute pointer-events-auto will-change-transform"
      style={{
        position: 'absolute',
        top: `${config.topPercent}%`,
        left: `${config.leftPercent}%`,
        y: yParallax,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="animate-floating-item"
        style={{
          animationDuration: `${config.floatDuration}s`,
          animationDelay: `${config.floatDelay}s`,
        }}
      >
        <a
          href={brand.link}
          className={`block ${config.width} aspect-square rounded-2xl md:rounded-3xl overflow-hidden shadow-lg border border-black/10 bg-white group cursor-pointer relative hover:scale-110 hover:shadow-2xl transition-all duration-300`}
        >
          <img
            src={brand.image}
            alt={brand.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3 text-center">
            <span className="text-xs sm:text-sm font-bold text-white leading-tight">
              {brand.name}
              <span className="block text-[10px] text-white/75 font-mono mt-0.5">Khám Phá ↗</span>
            </span>
          </div>
        </a>
      </div>
    </motion.div>
  );
}

export function BrandGalaxy() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();

  return (
    <div className="relative w-full">
      <section
        ref={containerRef}
        className="relative min-h-[850px] md:min-h-[1000px] w-full flex items-center justify-center mt-8 md:mt-14 mb-16 md:mb-28 select-none bg-transparent"
        style={{ position: 'relative' }}
      >
        {/* Background Radial Atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.02)_0%,transparent_70%)] pointer-events-none" />

        {/* Floating Specialty Cards Layer */}
        <div className="absolute inset-0 pointer-events-none" style={{ position: 'absolute' }}>
          {BRAND_PORTFOLIO.map((brand, i) => {
            const config = GALAXY_CONFIGS[i % GALAXY_CONFIGS.length];
            return (
              <ParallaxBrandItem
                key={brand.id}
                brand={brand}
                config={config}
                scrollYProgress={scrollYProgress}
              />
            );
          })}
        </div>

        {/* Central Headline & CTA */}
        <div className="relative z-30 text-center flex flex-col items-center justify-center gap-8 max-w-3xl px-6 pointer-events-auto">
          <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-neutral-900 leading-[0.95] text-center">
            Hệ thống
            <br />
            chuyên khoa
            <br />
            toàn diện.
          </h2>

          <div>
            <a
              href="#specialties"
              className="inline-flex items-center justify-center gap-3 bg-neutral-200/80 hover:bg-neutral-950 text-neutral-900 hover:text-white font-medium text-xs sm:text-sm px-6 py-3 rounded-full transition-all duration-300 shadow-md hover:shadow-xl hover:scale-105 group border border-neutral-300/50 backdrop-blur-md"
            >
              <span>Khám Phá Các Chuyên Khoa</span>
              <span className="group-hover:translate-x-1 transition-transform duration-200 text-xs">→</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
