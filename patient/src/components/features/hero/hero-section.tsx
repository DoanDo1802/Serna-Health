'use client';

import React from 'react';

export function HeroSection() {
  return (
    <div className="c-hero-home block h-full w-full p-2 sm:p-3">
      <div className="c-hero-home_card relative h-[calc(100svh_-_1rem)] md:h-[calc(100svh_-_1.5rem)] overflow-hidden rounded-3xl md:rounded-[36px] bg-black">
        {/* Large Bold Headline at Bottom Left */}
        <div className="absolute bottom-8 left-6 sm:bottom-12 sm:left-12 lg:bottom-16 lg:left-16 z-20 pointer-events-none select-none max-w-4xl">
          <h1 className="font-bold text-white leading-[0.82] tracking-[-0.04em] text-6xl sm:text-7xl md:text-8xl lg:text-[120px] xl:text-[145px] m-0">
            Make.
            <br />
            Every Day.
            <br />
            Better.
          </h1>
        </div>

        {/* Video Background Layer with /videos/0702.mp4 */}
        <div className="c-hero-home_bg pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <video
            className="w-full h-full object-cover"
            poster="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1920&auto=format&fit=crop"
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
          >
            <source src="/videos/0702.mp4" type="video/mp4" />
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
          {/* Subtle dark tint */}
          <div className="absolute inset-0 bg-black/35 pointer-events-none" />
        </div>

        {/* Bottom Right Card - Tall Portrait Card with Translucent Frosted Glass */}
        <div className="c-hero-home_push pointer-events-auto absolute bottom-6 right-6 sm:bottom-10 sm:right-10 lg:bottom-14 lg:right-14 z-20">
          <a
            href="https://investors.wolverineworldwide.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-black/45 backdrop-blur-2xl border border-white/15 p-4 sm:p-5 pt-4 pb-6 rounded-[28px] sm:rounded-[32px] w-[265px] sm:w-[295px] shadow-[0_25px_60px_rgba(0,0,0,0.75)] transition-all duration-300 hover:scale-[1.03] hover:bg-black/55 hover:border-white/25 group cursor-pointer"
          >
            {/* Taller Thumbnail Image */}
            <div className="relative rounded-[20px] sm:rounded-[22px] overflow-hidden aspect-[4/3] bg-neutral-900 mb-4">
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                src="https://d3ql15awrosklt.cloudfront.net/medias/_transforms/homepage/_400x300_crop_center-center_none/1953/ThumbnailMRL-1H26-PerformanceInitiative-J00003483-02.webp"
                alt="2025 Annual Report"
                loading="lazy"
              />
            </div>

            {/* Category Tag */}
            <span className="text-[10px] font-mono tracking-[0.16em] text-neutral-300 font-semibold uppercase block mb-3 pl-0.5">
              LATEST &nbsp;NEWS
            </span>

            {/* Title & External Link Icon */}
            <div className="flex items-end justify-between gap-3 pl-0.5 pr-0.5 mt-1">
              <h4 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-white leading-[1.08] m-0">
                2025 Annual
                <br />
                Report
              </h4>
              <span className="text-white/80 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200 mb-1">
                <svg
                  className="w-[19px] h-[19px] fill-none stroke-current stroke-[2.2]"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H9M17 7V15" />
                </svg>
              </span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
