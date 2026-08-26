'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LATEST_NEWS } from '@/constants/news';

// Duplicate 3 times for a truly seamless infinite loop
const INFINITE_NEWS = [
  ...LATEST_NEWS.map((item, i) => ({ ...item, uniqueKey: `set1-${item.id}-${i}` })),
  ...LATEST_NEWS.map((item, i) => ({ ...item, uniqueKey: `set2-${item.id}-${i}` })),
  ...LATEST_NEWS.map((item, i) => ({ ...item, uniqueKey: `set3-${item.id}-${i}` })),
];

export function NewsCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const isResettingRef = useRef(false);

  // Initialize position at middle set
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const initPosition = () => {
      const cardEl = el.firstElementChild as HTMLElement;
      if (cardEl) {
        const cardWidth = cardEl.offsetWidth + 24;
        const singleSetWidth = cardWidth * LATEST_NEWS.length;
        el.scrollLeft = singleSetWidth;
      }
    };

    // Slight delay to ensure DOM dimensions are calculated
    const timeout = setTimeout(initPosition, 100);
    window.addEventListener('resize', initPosition);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', initPosition);
    };
  }, []);

  // Seamless Infinite Loop Handler
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isResettingRef.current) return;

    const cardEl = el.firstElementChild as HTMLElement;
    if (!cardEl) return;
    const cardWidth = cardEl.offsetWidth + 24;
    const singleSetWidth = cardWidth * LATEST_NEWS.length;

    // If user / auto-play reaches the 3rd set, invisibly shift back by 1 set width
    if (el.scrollLeft >= singleSetWidth * 2) {
      isResettingRef.current = true;
      el.scrollLeft -= singleSetWidth;
      setTimeout(() => {
        isResettingRef.current = false;
      }, 50);
    } else if (el.scrollLeft <= singleSetWidth * 0.2) {
      // If scrolling backwards into the 1st set, invisibly shift forward by 1 set width
      isResettingRef.current = true;
      el.scrollLeft += singleSetWidth;
      setTimeout(() => {
        isResettingRef.current = false;
      }, 50);
    }

    // Circular Progress indicator calculation
    const progress = ((el.scrollLeft % singleSetWidth) / singleSetWidth) * 100;
    setScrollProgress(progress);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Smooth forward auto-play every 3.8 seconds
  useEffect(() => {
    if (isDragging || isHovered) return;

    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;

      const cardEl = el.firstElementChild as HTMLElement;
      const cardWidth = cardEl ? cardEl.offsetWidth + 24 : 420;

      el.scrollBy({
        left: cardWidth,
        behavior: 'smooth',
      });
    }, 3800);

    return () => clearInterval(interval);
  }, [isDragging, isHovered]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const cardEl = el.firstElementChild as HTMLElement;
    const cardWidth = cardEl ? cardEl.offsetWidth + 24 : 420;
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;

    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setHasMoved(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      setHasMoved(true);
    }
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  return (
    <section 
      className="container my-28 md:my-40 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with Title and Prev/Next Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-[#141311] animate-pulse" />
            <span className="text-[11.5px] font-mono font-bold uppercase tracking-[0.2em] text-[#8e897e]">
              LATEST INSIGHTS & CLINICAL BREAKTHROUGHS
            </span>
          </div>
          <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#141311] leading-tight">
            Tin Y Khoa Mới Nhất
          </h3>
        </motion.div>

        {/* Custom Navigation Controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="w-12 h-12 rounded-full border border-[#e3ded3] hover:border-[#141311] flex items-center justify-center text-[#141311] transition-all duration-200 cursor-pointer bg-[#ffffff] hover:bg-[#f1ede3] shadow-sm active:scale-95 group"
            aria-label="Tin trước"
          >
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="w-12 h-12 rounded-full border border-[#e3ded3] hover:border-[#141311] flex items-center justify-center text-[#141311] transition-all duration-200 cursor-pointer bg-[#ffffff] hover:bg-[#f1ede3] shadow-sm active:scale-95 group"
            aria-label="Tin tiếp theo"
          >
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Seamless Infinite Slider Track */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`flex gap-6 overflow-x-auto scroll-smooth pb-8 pt-2 select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {INFINITE_NEWS.map((item, idx) => (
          <div
            key={item.uniqueKey}
            onClick={(e) => {
              if (hasMoved) e.preventDefault();
            }}
            className="flex-none w-[88vw] sm:w-[380px] md:w-[410px] bg-[#ffffff] rounded-[28px] p-6 sm:p-7 flex flex-col justify-between border border-[#e3ded3] hover:border-[#141311]/25 hover:shadow-[0_20px_50px_rgba(40,36,30,0.08)] hover:-translate-y-1.5 transition-all duration-400 group cursor-pointer"
          >
            <div>
              {/* Image Container with Frosted Glass Category Tag */}
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden mb-6 bg-[#f1ede3]">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-3.5 left-3.5 bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10.5px] font-mono font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm">
                  {item.category}
                </div>
              </div>

              {/* Title & Description */}
              <h4 className="text-[19px] sm:text-[21px] font-bold leading-[1.32] text-[#141311] group-hover:text-black mb-3 transition-colors">
                {item.title}
              </h4>
              <p className="text-[13.5px] text-[#6f6a5f] line-clamp-3 leading-relaxed font-normal">
                {item.description}
              </p>
            </div>

            {/* Footer with Date & Interactive Arrow Button */}
            <div className="flex items-center justify-between pt-5 mt-6 border-t border-[#e3ded3]/70">
              <span className="text-xs font-mono font-medium text-[#8e897e] uppercase tracking-wider">
                {item.date}
              </span>
              <span className="w-8 h-8 rounded-full bg-[#f1ede3] group-hover:bg-[#141311] group-hover:text-white text-[#141311] flex items-center justify-center text-sm font-semibold transition-all duration-300 transform group-hover:scale-105">
                ↗
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Line Indicator */}
      <div className="w-full max-w-[200px] h-[2px] bg-[#e3ded3] rounded-full mx-auto mt-2 overflow-hidden">
        <div 
          className="h-full bg-[#141311] rounded-full transition-all duration-300"
          style={{ width: `${Math.max(15, scrollProgress)}%` }}
        />
      </div>
    </section>
  );
}
