import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BaseBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'outline' | 'filled';
}

export function BaseBadge({ children, variant = 'outline', className, ...props }: BaseBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono tracking-wider uppercase',
        variant === 'outline' && 'border border-white/20 text-white/80 bg-black/40',
        variant === 'filled' && 'bg-white text-black font-semibold',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
