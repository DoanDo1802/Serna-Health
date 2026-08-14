'use client'

import React, { ReactNode } from 'react'

interface AppProviderProps {
  children: ReactNode
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)]">
      {children}
    </div>
  )
}
