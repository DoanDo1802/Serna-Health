import React from 'react';
import { cn } from '@/lib/utils';

interface BaseIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
  size?: number;
}

export function BaseIcon({ name, className, size = 16, ...props }: BaseIconProps) {
  return (
    <svg
      className={cn('inline-block shrink-0 fill-current', className)}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <use xlinkHref={`/sprite.svg#${name}`} />
    </svg>
  );
}
