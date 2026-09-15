import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'neutral';

interface BadgeProps extends React.ComponentProps<'span'> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-primary/20 text-primary border-primary/30',
  secondary: 'bg-surface-container-high text-content-secondary border-outline-variant/60',
  outline: 'bg-transparent text-content-secondary border-outline-variant',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  destructive: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  neutral: 'bg-surface-container text-content-muted border-outline-variant/40',
};

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
