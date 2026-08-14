import React, { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BaseInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const BaseInput = React.forwardRef<HTMLInputElement, BaseInputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label className="block text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none transition-all',
            error && 'border-[var(--destructive)] focus:ring-[var(--destructive)]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[var(--destructive)] font-medium">{error}</p>}
      </div>
    )
  }
)

BaseInput.displayName = 'BaseInput'
