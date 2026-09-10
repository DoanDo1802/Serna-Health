import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'info' | 'primary' | 'error' | 'neutral';

export const BADGE_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  primary: 'bg-primary/15 text-primary border-primary/30',
  error: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  neutral: 'bg-surface-container-high text-content-secondary border-outline-variant',
};

interface StatusBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
  dot = false,
}) => {
  const dotColors: Record<BadgeVariant, string> = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    info: 'bg-sky-400',
    primary: 'bg-primary',
    error: 'bg-rose-400',
    neutral: 'bg-content-muted',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold border ${BADGE_STYLES[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      <span>{children}</span>
    </span>
  );
};
