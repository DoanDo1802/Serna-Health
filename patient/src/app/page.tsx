import React from 'react';
import { HeroSection } from '@/components/features/hero/hero-section';
import { BrandStory } from '@/components/features/brand-story/brand-story';
import { BrandGalaxy } from '@/components/features/brand-galaxy/brand-galaxy';
import { AnnualReport } from '@/components/features/annual-report/annual-report';
import { CultureStats } from '@/components/features/culture-stats/culture-stats';
import { MarketSnapshot } from '@/components/features/market-snapshot/market-snapshot';
import { NewsCarousel } from '@/components/features/news-carousel/news-carousel';
import { CareerPush } from '@/components/features/career-push/career-push';


export default function HomePage() {
  return (
    <div className="relative flex flex-col w-full">
      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. Mission & Story */}
      <BrandStory />

      {/* 3. Interactive Brand Portfolio Galaxy */}
      <BrandGalaxy />

      {/* 4. 2025 Annual Report */}
      <AnnualReport />

      {/* 5. Culture & Employee Statistics */}
      <CultureStats />

      {/* 6. Market Snapshot (WWW Ticker) */}
      <MarketSnapshot />

      {/* 7. Latest News Carousel */}
      <NewsCarousel />

      {/* 8. Careers Push Banner */}
      <CareerPush />
    </div>
  );
}
