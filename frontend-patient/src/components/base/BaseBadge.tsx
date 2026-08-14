import React, { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface BaseBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'info' | 'neutral' | 'danger'
}

export const BaseBadge: React.FC<BaseBadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  ...props
}) => {
  const variantStyles = {
    success: 'bg-[var(--accent)] text-black border-transparent',
    warning: 'bg-amber-100 text-amber-900 border-amber-300',
    info: 'bg-sky-100 text-sky-800 border-sky-300',
    neutral: 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]',
    danger: 'bg-red-100 text-red-800 border-red-300'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
