import React from 'react';
import { NovaLogo } from '@/components/base/nova-logo';

export function LandingHero() {
  return (
    <section className="welcome-wrapper astro-lcdefpme" data-welcome-section="">
      <div className="hero-video-wrapper astro-lcdefpme">
        <div className="hero-video-container astro-lcdefpme" data-hero-particles="">
          <div className="main-particles-component-section astro-esuf45jn" data-density="230" data-main-particles-component="" data-particles-scale="0.59" data-ring-displacement="0.62" data-ring-width="0.006" data-ring-width2="0.107" data-theme="light">
            <div className="main-particles-container astro-esuf45jn" data-container=""></div>
          </div>

        </div>
      </div>
      <div className="welcome-section astro-lcdefpme" data-welcome-content="">
        <div className="logo-container flex items-center justify-center gap-3 mb-3 astro-lcdefpme" data-logo="">
          <NovaLogo size={42} />
          <span className="font-bold text-3xl tracking-tight text-current whitespace-nowrap" style={{ fontFamily: 'Google Sans Flex, sans-serif' }}>
            NOVAMED
          </span>
        </div>
        <div className="header-container astro-lcdefpme text-center">
          <h1 className="landing-main-header astro-lcdefpme">
            <span
              className="typed-container landing-main astro-lcdefpme astro-inbjnz4i"
              style={{ display: 'inline-block' }}
              data-cursor-persists="false"
              data-typed-header=""
              data-welcome-header="true"
              data-enddelay="0.3"
              data-initialdelay="1"
            >
              <span className="visually-hidden astro-inbjnz4i">Chăm sóc sức khỏe thông minh thế hệ mới</span>
              <span
                aria-hidden="true"
                className="typed-content astro-inbjnz4i"
                data-nosnippet=""
                translate="no"
                style={{ display: 'inline-block' }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    className="cursor-container astro-inbjnz4i"
                    data-cursor-container=""
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      marginRight: '0.14em',
                      transform: 'none',
                      left: 'auto',
                      top: '0.02em',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      className="blinking-cursor astro-inbjnz4i"
                      src="/assets/image/antigravity-cursor.png"
                      style={{
                        height: '0.88em',
                        width: 'auto',
                        display: 'block',
                      }}
                    />
                  </span>
                  <span>Chăm sóc sức khỏe</span>
                </span>
                <span style={{ display: 'block' }}>thông minh thế hệ mới</span>
              </span>
            </span>
          </h1>
        </div>
        <div className="grid-row welcome-cta astro-lcdefpme" data-cta="">
          <div className="cta-inner astro-lcdefpme" data-os-cta-container="">
            <a aria-expanded="false" aria-haspopup="false" className="call-to-action button button-primary astro-lcdefpme" href="/dashboard/booking"><span>Đặt lịch khám ngay</span></a>
          </div>
          <a aria-expanded="false" aria-haspopup="false" className="call-to-action button button-secondary astro-lcdefpme" href="/use-cases"><span>Xem chuyên khoa</span></a>
        </div>
      </div>
    </section>
  );
}
