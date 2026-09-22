'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SlideData {
  index: number;
  title: string;
  image: string;
  youtubeUrl: string;
  copyTitle: string;
  copyDesc: string;
  linkText: string;
  linkHref: string;
}

const SLIDES: SlideData[] = [
  {
    index: 0,
    title: 'Bệnh nhân & Gia đình',
    image: '/assets/image/landing/landing-thumbnail-fullstack.jpg',
    youtubeUrl: 'https://www.youtube.com/embed/htV29JrMXmA',
    copyTitle: 'Bệnh nhân & Gia đình',
    copyDesc: 'Dịch vụ y tế chu đáo, khám nhanh cùng đội ngũ chuyên gia.',
    linkText: 'Đặt lịch khám',
    linkHref: '/dashboard/booking',
  },
  {
    index: 1,
    title: 'Khách hàng Doanh nghiệp',
    image: '/assets/image/landing/landing-thumbnail-enterprise.jpg',
    youtubeUrl: 'https://www.youtube.com/embed/B4do6xuIgD4',
    copyTitle: 'Khách hàng Doanh nghiệp',
    copyDesc: 'Khám sức khỏe định kỳ doanh nghiệp tối ưu chi phí & thời gian.',
    linkText: 'Đặt lịch khám',
    linkHref: '/dashboard/booking',
  },
  {
    index: 2,
    title: 'Mẹ bầu & Trẻ em',
    image: '/assets/image/landing/landing-thumbnail-frontend.jpg',
    youtubeUrl: 'https://www.youtube.com/embed/yiHKlPuZ73c',
    copyTitle: 'Mẹ bầu & Trẻ em',
    copyDesc: 'Gói thai sản & nhi khoa tiêu chuẩn quốc tế an toàn cho mẹ và bé.',
    linkText: 'Đặt lịch khám',
    linkHref: '/dashboard/booking',
  },
];

export function LandingUseCases() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sliderWidth, setSliderWidth] = useState(0);
  const [hoveredSlide, setHoveredSlide] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [activeModalUrl, setActiveModalUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const targetPosRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });

  // Update slider container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setSliderWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Smooth lerp loop for the custom slide cursor
  useEffect(() => {
    const loop = () => {
      currentPosRef.current.x += (targetPosRef.current.x - currentPosRef.current.x) * 0.25;
      currentPosRef.current.y += (targetPosRef.current.y - currentPosRef.current.y) * 0.25;
      setCursorPos({ x: currentPosRef.current.x, y: currentPosRef.current.y });
      animFrameRef.current = requestAnimationFrame(loop);
    };

    if (hoveredSlide !== null) {
      animFrameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [hoveredSlide]);

  const handlePrev = () => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => Math.min(SLIDES.length - 1, prev + 1));
  };

  const handleSlidePointerEnter = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPosRef.current = { x, y };
    targetPosRef.current = { x, y };
    setHoveredSlide(idx);
  };

  const handleSlidePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    targetPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleSlidePointerLeave = () => {
    setHoveredSlide(null);
  };

  const handleSlideClick = (url: string) => {
    setActiveModalUrl(`${url}?autoplay=1`);
  };

  const gap = 24;
  const trackOffset = activeIndex * (sliderWidth + gap);

  return (
    <section className="landing-use-case-section astro-gk6ge62r" data-use-case-section="">
      {/* Video Modal */}
      {activeModalUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
          }}
          onClick={() => setActiveModalUrl(null)}
        >
          <div
            style={{ position: 'relative', width: '90%', maxWidth: '1000px', aspectRatio: '16/9' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModalUrl(null)}
              style={{
                position: 'absolute',
                top: '-48px',
                right: 0,
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                color: '#fff',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}
            >
              ✕
            </button>
            <iframe
              src={activeModalUrl}
              title="Use Case Video"
              style={{ width: '100%', height: '100%', borderRadius: '16px', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <div className="grid-container landing-use-case-header astro-gk6ge62r">
        <div className="grid-row astro-gk6ge62r">
          <div className="grid-col col-sm-6 col-md-6 astro-gk6ge62r">
            <div className="use-case-header-main astro-gk6ge62r">
              <h2 className="heading-4 astro-gk6ge62r">
                <span className="astro-gk6ge62r">Đồng hành cùng sức khỏe</span>
                <span className="astro-gk6ge62r">cho mọi gia đình</span>
              </h2>
            </div>
          </div>
          <div className="grid-col col-md-4 col-md-offset-8 astro-gk6ge62r">
            <p className="body astro-gk6ge62r">
              MediCore mang đến dịch vụ y tế chuẩn mực, tận tâm cho cá nhân, gia đình và doanh nghiệp.
            </p>
          </div>
        </div>
      </div>

      <div className="landing-use-case-list astro-gk6ge62r">
        <div className="grid-container astro-gk6ge62r">
          <div className="grid-row astro-gk6ge62r">
            {/* Left Column: Carousel Tracks */}
            <div className="grid-col col-xs-4 col-sm-8 col-md-8 astro-gk6ge62r">
              <div
                ref={containerRef}
                className="slider-container usecases-slider astro-gk6ge62r astro-kb4uamjl"
                data-active-index={activeIndex}
                data-item-count={SLIDES.length}
                data-slider=""
                id="slider"
                style={{ overflow: 'hidden' }}
              >
                <div
                  ref={trackRef}
                  className="slider-track astro-kb4uamjl"
                  data-track=""
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${SLIDES.length}, ${sliderWidth > 0 ? `${sliderWidth}px` : '100%'})`,
                    gap: `${gap}px`,
                    transform: `translate3d(-${trackOffset}px, 0, 0)`,
                    transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                    width: '100%',
                    willChange: 'transform',
                  }}
                >
                  {SLIDES.map((slide) => {
                    const isHovered = hoveredSlide === slide.index;
                    return (
                      <div
                        key={slide.index}
                        className="slide-image astro-gk6ge62r"
                        data-slide-index={slide.index}
                        style={{ position: 'relative', cursor: isHovered ? 'none' : 'pointer' }}
                        onPointerEnter={(e) => handleSlidePointerEnter(e, slide.index)}
                        onPointerMove={handleSlidePointerMove}
                        onPointerLeave={handleSlidePointerLeave}
                        onClick={() => handleSlideClick(slide.youtubeUrl)}
                      >
                        <div className="slide-image-wrapper astro-gk6ge62r">
                          <img alt={slide.title} className="list-image astro-gk6ge62r" src={slide.image} />
                        </div>
                        <div className="slide-image-overlay astro-gk6ge62r">
                          <span
                            className="typed-container heading-4 astro-gk6ge62r astro-inbjnz4i"
                            data-cursor-persists="true"
                            data-typed-header=""
                          >
                            <span className="typed-content astro-inbjnz4i">{slide.title}</span>
                          </span>

                          <div className="video-control-button symbol astro-gk6ge62r" translate="no">
                            play_arrow
                          </div>

                          {/* Custom Magnetic Cursor inside Slide */}
                          <div
                            className="custom-cursor astro-paliblhy"
                            data-cursor=""
                            style={{
                              pointerEvents: 'none',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              zIndex: 100,
                              transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0) translate(-50%, -50%) scale(${isHovered ? 1 : 0})`,
                              opacity: isHovered ? 1 : 0,
                              transition: 'opacity 0.2s, transform 0.1s ease-out',
                              willChange: 'transform, opacity',
                            }}
                          >
                            <div className="cursor-content astro-paliblhy">
                              <span className="symbol astro-paliblhy" translate="no">
                                play_arrow
                              </span>
                              <span className="call-to-action astro-paliblhy">Xem chi tiết</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Copy & Interactive Controls */}
            <div className="slider-copy-wrapper astro-gk6ge62r" data-copy-wrapper="">
              {SLIDES.map((slide) => {
                const isActive = activeIndex === slide.index;
                return (
                  <div
                    key={slide.index}
                    className={`slider-copy astro-gk6ge62r ${isActive ? 'is-active' : ''}`}
                    data-copy-index={slide.index}
                    style={{
                      display: isActive ? 'block' : 'none',
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0)' : 'translateY(12px)',
                      transition: 'opacity 0.4s ease, transform 0.4s ease',
                    }}
                  >
                    <strong className="call-to-action astro-gk6ge62r">{slide.copyTitle}</strong>
                    <p className="body astro-gk6ge62r">{slide.copyDesc}</p>
                    <a className="call-to-action arrow-link astro-gk6ge62r" href={slide.linkHref}>
                      {slide.linkText}
                    </a>
                  </div>
                );
              })}

              {/* Slider Next / Prev Controls */}
              <div className="slider-controls-container astro-gk6ge62r" data-arrow-controls-wrapper="">
                <div className="slider-controls astro-gk6ge62r astro-iormbkgb">
                  <button
                    aria-label="Previous slide"
                    className="slider-control-button symbol astro-iormbkgb"
                    data-arrow-left=""
                    disabled={activeIndex === 0}
                    onClick={handlePrev}
                  >
                    <span className="astro-iormbkgb" translate="no">
                      keyboard_arrow_left
                    </span>
                  </button>
                  <button
                    aria-label="Next slide"
                    className="slider-control-button symbol astro-iormbkgb"
                    data-arrow-right=""
                    disabled={activeIndex === SLIDES.length - 1}
                    onClick={handleNext}
                  >
                    <span className="astro-iormbkgb" translate="no">
                      keyboard_arrow_right
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
