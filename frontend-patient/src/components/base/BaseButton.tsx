import React, { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const BaseButton: React.FC<BaseButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-sm',
    secondary: 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--accent)] border border-[var(--border)]',
    outline: 'bg-transparent text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)]',
    danger: 'bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-red-700 shadow-sm',
    ghost: 'bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)]'
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base'
  }

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
