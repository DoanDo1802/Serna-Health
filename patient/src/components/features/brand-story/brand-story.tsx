'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const HEADLINE_TEXT =
  'Hành trình của một bệnh viện được thành lập với sứ mệnh mang đến dịch vụ y tế chuẩn mực và tận tâm cho mọi người.';

function ScrollWord({
  word,
  index,
  total,
  scrollYProgress,
}: {
  word: string;
  index: number;
  total: number;
  scrollYProgress: any;
}) {
  const start = index / total;
  const end = Math.min(1, (index + 1.2) / total);
  const opacity = useTransform(scrollYProgress, [start, end], [0.18, 1]);

  return (
    <motion.span
      style={{ opacity }}
      className="inline-block mr-[0.24em] transition-opacity text-neutral-900"
    >
      {word}
    </motion.span>
  );
}

export function BrandStory() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll progress through this section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.85', 'center 0.45'],
  });

  const rightColOpacity = useTransform(scrollYProgress, [0.3, 0.8], [0.3, 1]);
  const rightColY = useTransform(scrollYProgress, [0.3, 0.8], [20, 0]);

  const words = HEADLINE_TEXT.split(' ');

  return (
    <section
      ref={containerRef}
      className="container mt-40 md:mt-60 mb-20 md:mb-28 pt-12 md:pt-20 relative"
      style={{ position: 'relative' }}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 items-start">
        {/* Left Column: Word-by-Word Scroll Reveal Headline */}
        <div className="md:col-span-6">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] select-none">
            {words.map((word, idx) => (
              <ScrollWord
                key={`${word}-${idx}`}
                word={word}
                index={idx}
                total={words.length}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </h2>
        </div>

        {/* Right Column: Paragraph narrative lighting up on scroll */}
        <motion.div
          className="md:col-span-6 md:col-start-7 flex flex-col gap-6 text-neutral-600 text-lg md:text-xl leading-relaxed"
          style={{
            opacity: rightColOpacity,
            y: rightColY,
          }}
        >
          <p>
            Từ những ngày đầu thành lập, chúng tôi luôn kiên định với sứ mệnh lấy người bệnh làm trung tâm, không ngừng đầu tư vào đội ngũ chuyên gia đầu ngành cùng hệ thống trang thiết bị y khoa hiện đại bậc nhất.
          </p>
          <p>
            Hôm nay, bệnh viện phục vụ hàng triệu lượt khám chữa bệnh mỗi năm, đồng hành cùng các gia đình Việt Nam và quốc tế bằng chất lượng điều trị chuẩn xác, an toàn và đầy lòng nhân ái.
          </p>
          <div>
            <a
              href="#about"
              className="inline-flex items-center gap-2 text-sm font-bold text-neutral-900 border-b-2 border-neutral-900 pb-0.5 hover:opacity-70 transition-opacity"
            >
              <span>Lịch Sử & Tầm Nhìn Y Khoa</span>
              <span className="c-icon">
                <svg className="w-3.5 h-3.5 fill-current">
                  <use xlinkHref="/sprite.svg#external" />
                </svg>
              </span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
