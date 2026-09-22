'use client';

import React, { useEffect } from 'react';
import { LandingHeader } from './landing-header';
import { LandingHero } from './landing-hero';
import { LandingVideo } from './landing-video';
import { LandingMission } from './landing-mission';
import { LandingFeatures } from './landing-features';
import { LandingUseCases } from './landing-use-cases';
import { LandingSolutions } from './landing-solutions';
import { LandingBlogs } from './landing-blogs';
import { LandingCta } from './landing-cta';
import { LandingFooter } from './landing-footer';

const ASTRO_MODULES = [
  '/_astro/page.LAbJoB63.js',
  '/_astro/MainParticlesComponent.astro_astro_type_script_index_0_lang.Dox42TL8.js',
  '/_astro/MorphingParticlesComponent.astro_astro_type_script_index_0_lang.B4r3VvfF.js',
  '/_astro/TypedHeader.astro_astro_type_script_index_0_lang.BK7Om3wI.js',
  '/_astro/index.astro_astro_type_script_index_0_lang.CghSekDP.js',
  '/_astro/YoutubeVideoSection.astro_astro_type_script_index_0_lang.CBT2SQlO.js',
  '/_astro/AgentFirst.astro_astro_type_script_index_0_lang.DHglPJ15.js',
  '/_astro/FeatureExplorerNew.astro_astro_type_script_index_0_lang.ItaQhKl5.js',
  '/_astro/UseCases.astro_astro_type_script_index_0_lang.BF9mW6Y7.js',
  '/_astro/LandingLatestBlogs.astro_astro_type_script_index_0_lang.C0pOmJid.js',
  '/_astro/DownloadSection.astro_astro_type_script_index_0_lang.DO3qSWET.js',
  '/_astro/AntigravityFooter.astro_astro_type_script_index_0_lang.DQIYDjYp.js',
  '/_astro/Header.astro_astro_type_script_index_0_lang.CcyS50QO.js',
  '/_astro/SmoothScrollLayout.astro_astro_type_script_index_0_lang.BIBS_Ca_.js',
  '/_astro/CustomCursor.astro_astro_type_script_index_0_lang.HIixua-1.js',
  '/_astro/Slider.astro_astro_type_script_index_0_lang.COD_D88F.js',
];

export function LandingPage() {
  useEffect(() => {
    let isCancelled = false;

    function appendScript(src: string): Promise<void> {
      return new Promise((resolve) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.type = 'module';
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.head.appendChild(s);
      });
    }

    async function loadModules() {
      for (const src of ASTRO_MODULES) {
        if (isCancelled) break;
        await appendScript(src);
      }

      if (!isCancelled && typeof window !== 'undefined') {
        const w = window as any;
        setTimeout(() => {
          if (typeof w.initSmoothScroll === 'function') {
            w.initSmoothScroll();
          }
          if (typeof w.initMainParticles === 'function') {
            w.initMainParticles();
          }
          if (typeof w.initMorphParticles === 'function') {
            w.initMorphParticles();
          }
          if (typeof w.initWelcomeTimeline === 'function') {
            w.initWelcomeTimeline();
          }
          if (typeof w.initYoutubeVideoSection === 'function') {
            w.initYoutubeVideoSection();
          }
          if (typeof w.initAgentFirst === 'function') {
            w.initAgentFirst();
          }
          if (typeof w.initFeatureExplorer === 'function') {
            w.initFeatureExplorer();
          }
          if (typeof w.initUseCases === 'function') {
            w.initUseCases();
          }
          if (typeof w.initCustomCursor === 'function') {
            w.initCustomCursor();
          }
          if (typeof w.initAntigravityFooter === 'function') {
            w.initAntigravityFooter();
          }
          window.dispatchEvent(new Event('resize'));
          if (w.ScrollTrigger && typeof w.ScrollTrigger.refresh === 'function') {
            w.ScrollTrigger.refresh();
          }
        }, 150);
      }
    }

    loadModules();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="landing-root">
      <LandingHeader />
      <div className="dropdown-overlay astro-nen7h5rs"></div>

      <div id="smooth-wrapper">
        <div id="smooth-content" className="smooth-scroll-wrapper">
          <main className="main astro-lcdefpme">
            <LandingHero />
            <LandingVideo />
            <LandingMission />
            <LandingFeatures />
            <LandingUseCases />
            <LandingSolutions />
            <LandingBlogs />
            <LandingCta />
          </main>
          <LandingFooter />
        </div>
      </div>
    </div>
  );
}
