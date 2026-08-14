'use client'

import React from 'react'
import { LandingNavbar } from '@/components/features/LandingNavbar'
import { LandingHero } from '@/components/features/LandingHero'
import { LandingFeatures } from '@/components/features/LandingFeatures'
import { LandingSteps } from '@/components/features/LandingSteps'
import { LandingDoctors } from '@/components/features/LandingDoctors'
import { LandingFooter } from '@/components/features/LandingFooter'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)]">
      {/* Top Navbar */}
      <LandingNavbar />

      {/* Hero Section */}
      <LandingHero />

      {/* Capability Features Section */}
      <LandingFeatures />

      {/* 4-Step Patient Guide Section */}
      <LandingSteps />

      {/* Doctor & Specialty Showcase */}
      <LandingDoctors />

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}

