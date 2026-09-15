import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const variantClasses = {
  default:
    'bg-primary hover:bg-primary-hover text-white shadow-xs hover:shadow-card active:scale-[0.98]',
  outline:
    'bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-primary text-content-secondary hover:text-content-primary active:scale-[0.98]',
  ghost:
    'hover:bg-surface-container text-content-secondary hover:text-content-primary active:scale-[0.98]',
  destructive:
    'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 active:scale-[0.98]',
  secondary:
    'bg-surface-container-high hover:bg-surface-container-highest text-content-primary border border-outline-variant/60 active:scale-[0.98]',
};

const sizeClasses = {
  default: 'h-9 px-4 py-2 text-xs font-semibold rounded-full',
  sm: 'h-7 px-3 text-[11px] font-medium rounded-full',
  lg: 'h-11 px-6 text-sm font-bold rounded-full',
  icon: 'h-8 w-8 rounded-full p-0 flex items-center justify-center',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
