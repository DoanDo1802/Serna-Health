'use client';

import React, { useEffect, useRef, useState } from 'react';

export function LandingVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const posRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Autoplay muted video with safety
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      videoRef.current.playsInline = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }

    // High performance 60/120fps cursor tracking loop
    const loop = () => {
      posRef.current.x += (posRef.current.targetX - posRef.current.x) * 0.25;
      posRef.current.y += (posRef.current.targetY - posRef.current.y) * 0.25;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0) translate(-50%, -50%) scale(${isHovered ? 1 : 0})`;
        cursorRef.current.style.opacity = isHovered ? '1' : '0';
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isHovered]);

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    posRef.current.x = x;
    posRef.current.y = y;
    posRef.current.targetX = x;
    posRef.current.targetY = y;
    setIsHovered(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    posRef.current.targetX = e.clientX - rect.left;
    posRef.current.targetY = e.clientY - rect.top;
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
  };

  const handleVideoClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <section
      className="landing-video-section astro-lcdefpme astro-4xhi77lm"
      data-youtube-url="https://youtube.com/embed/SVCBA-pBgt0"
      data-youtube-video-section=""
      id="youtube-video-section"
    >
      {/* Video Modal Dialog */}
      {isModalOpen && (
        <div
          className="dialog youtube-dialog astro-mkgfivnz is-open"
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
          onClick={handleCloseModal}
        >
          <div
            className="dialog-inner astro-mkgfivnz"
            style={{ position: 'relative', width: '90%', maxWidth: '1000px', aspectRatio: '16/9' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="dialog-close-button symbol astro-mkgfivnz"
              onClick={handleCloseModal}
              style={{
                position: 'absolute',
                top: '-48px',
                right: '0',
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
              src="https://www.youtube.com/embed/SVCBA-pBgt0?autoplay=1"
              title="MediCore Video"
              style={{ width: '100%', height: '100%', borderRadius: '16px', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <div className="grid-container astro-4xhi77lm">
        <div className="grid-row astro-4xhi77lm">
          <div className="grid-col col-md-12 astro-4xhi77lm">
            <div
              ref={wrapperRef}
              aria-label="Play video"
              className="video-wrapper astro-4xhi77lm"
              data-video-wrapper=""
              style={{ cursor: isHovered ? 'none' : 'pointer' }}
              onPointerEnter={handlePointerEnter}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onClick={handleVideoClick}
            >
              {/* Magnetic Floating Button Cursor */}
              <div
                ref={cursorRef}
                className="custom-cursor astro-4xhi77lm"
                data-cursor=""
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: 100,
                  opacity: 0,
                  transform: 'translate3d(0, 0, 0) translate(-50%, -50%) scale(0)',
                  transition: 'none',
                  willChange: 'transform, opacity',
                }}
              >
                <div className="cursor-content astro-4xhi77lm">
                  <span className="symbol astro-4xhi77lm" translate="no" style={{ fontSize: '20px' }}>
                    play_arrow
                  </span>
                  <span className="call-to-action astro-4xhi77lm" style={{ fontWeight: 500 }}>
                    Xem video
                  </span>
                </div>
              </div>

              {/* Static control button icon for mobile / non-hover */}
              <div className="video-control-button symbol astro-4xhi77lm" translate="no">
                play_arrow
              </div>

              <video
                ref={videoRef}
                autoPlay
                className="landing-video astro-4xhi77lm"
                data-video=""
                height="1080"
                loop
                muted
                playsInline
                width="1920"
                style={{ pointerEvents: 'none', width: '100%', height: 'auto', display: 'block' }}
              >
                <source className="astro-4xhi77lm" src="/assets/video/hero_video.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
