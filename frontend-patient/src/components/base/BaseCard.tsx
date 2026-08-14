import React, { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BaseCardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

export const BaseCard: React.FC<BaseCardProps> = ({
  children,
  className,
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 shadow-xs',
        hoverable && 'hover:border-[var(--ring)] transition-all cursor-pointer hover:shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
