import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps extends React.ComponentProps<'div'> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'border-2 border-dashed border-outline-variant/80 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center bg-surface-container/10 min-h-[180px]',
        className
      )}
      {...props}
    >
      {icon && (
        <div className="flex items-center justify-center text-content-muted/50 mb-2.5 [&>svg]:w-8 [&>svg]:h-8">
          {icon}
        </div>
      )}
      <span className="text-xs sm:text-sm font-semibold text-content-secondary">
        {title}
      </span>
      {description && (
        <span className="text-[11px] text-content-muted/80 mt-1 max-w-sm leading-relaxed">
          {description}
        </span>
      )}
      {action && <div className="mt-4">{action}</div>}
      {children}
    </div>
  );
}
