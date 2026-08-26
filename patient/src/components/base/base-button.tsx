import React, { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { BaseIcon } from './base-icon';

type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  target?: string;
  isExternal?: boolean;
  iconRight?: string;
  iconLeft?: string;
  children: React.ReactNode;
}

export function BaseButton({
  variant = 'primary',
  size = 'md',
  href,
  target,
  isExternal,
  iconRight,
  iconLeft,
  className,
  children,
  ...props
}: BaseButtonProps) {
  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-white text-black hover:bg-neutral-200 border-transparent',
    secondary: 'bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-800',
    glass: 'bg-white/10 text-white backdrop-blur-md hover:bg-white/20 border-white/20',
    outline: 'bg-transparent text-black border-black/20 hover:border-black dark:text-white dark:border-white/20',
    ghost: 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/10 border-transparent',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-full gap-1.5',
    md: 'px-5 py-2.5 text-sm rounded-full gap-2',
    lg: 'px-7 py-3.5 text-base rounded-full gap-3',
  };

  const baseClasses = cn(
    'inline-flex items-center justify-center font-medium transition-all duration-200 border select-none group',
    variantStyles[variant],
    sizeStyles[size],
    className
  );

  const content = (
    <>
      {iconLeft && <BaseIcon name={iconLeft} className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />}
      <span>{children}</span>
      {iconRight && <BaseIcon name={iconRight} className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
      {isExternal && <BaseIcon name="external" className="w-3.5 h-3.5 opacity-70 ml-0.5" />}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target={target || (isExternal ? '_blank' : undefined)}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className={baseClasses}
        {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button className={baseClasses} {...props}>
      {content}
    </button>
  );
}
