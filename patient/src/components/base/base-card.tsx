import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BaseCardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  isHoverable?: boolean;
}

export function BaseCard({ children, className, isHoverable = false, ...props }: BaseCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-neutral-900 border border-neutral-800 text-white overflow-hidden',
        isHoverable && 'transition-all duration-300 hover:border-neutral-700 hover:shadow-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface BaseBadgeProps extends HTMLAttributes<HTMLSpanElement> {
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
