import React, { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BaseImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
}

export function BaseImage({ src, alt, className, ...props }: BaseImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('w-full h-full object-cover transition-opacity duration-300', className)}
      {...props}
    />
  );
}
