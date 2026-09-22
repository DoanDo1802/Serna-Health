import React from 'react';

interface NovaLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  withGlow?: boolean;
}

export function NovaLogo({ size = 28, withGlow = true, className = '', ...props }: NovaLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      fill="none"
      width={size}
      height={size}
      className={`inline-block transition-transform duration-300 hover:scale-105 ${className}`}
      {...props}
    >
      <defs>
        {withGlow && (
          <filter id="nova-ambient-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" mode="over" />
          </filter>
        )}

        <clipPath id="nova-clip-path">
          <path d="M 100 20 
                   C 113 20, 123 35, 123 55 
                   C 123 75, 125 77, 145 77 
                   C 165 77, 180 87, 180 100 
                   C 180 113, 165 123, 145 123 
                   C 125 123, 123 125, 123 145 
                   C 123 165, 113 180, 100 180 
                   C 87 180, 77 165, 77 145 
                   C 77 125, 75 123, 55 123 
                   C 35 123, 20 113, 20 100 
                   C 20 87, 35 77, 55 77 
                   C 75 77, 77 75, 77 55 
                   C 77 35, 87 20, 100 20 Z" />
        </clipPath>

        <linearGradient id="nova-grad-base" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3186FF" />
          <stop offset="35%" stopColor="#2DD4BF" />
          <stop offset="65%" stopColor="#FBBC04" />
          <stop offset="100%" stopColor="#FC413D" />
        </linearGradient>

        <radialGradient id="nova-mesh-blue" cx="85" cy="45" r="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4C96FF" stopOpacity="1" />
          <stop offset="60%" stopColor="#3186FF" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3186FF" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="nova-mesh-amber" cx="155" cy="95" r="65" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFDD55" stopOpacity="1" />
          <stop offset="50%" stopColor="#FBBC04" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FBBC04" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="nova-mesh-coral" cx="100" cy="155" r="65" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF635C" stopOpacity="1" />
          <stop offset="55%" stopColor="#FC413D" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FC413D" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="nova-mesh-teal" cx="45" cy="100" r="65" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="1" />
          <stop offset="60%" stopColor="#059669" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="nova-core-lumen" cx="100" cy="100" r="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer Glow Halo */}
      {withGlow && (
        <path
          d="M 100 20 
             C 113 20, 123 35, 123 55 
             C 123 75, 125 77, 145 77 
             C 165 77, 180 87, 180 100 
             C 180 113, 165 123, 145 123 
             C 125 123, 123 125, 123 145 
             C 123 165, 113 180, 100 180 
             C 87 180, 77 165, 77 145 
             C 77 125, 75 123, 55 123 
             C 35 123, 20 113, 20 100 
             C 20 87, 35 77, 55 77 
             C 75 77, 77 75, 77 55 
             C 77 35, 87 20, 100 20 Z"
          fill="url(#nova-grad-base)"
          opacity="0.5"
          filter="url(#nova-ambient-glow)"
        />
      )}

      {/* Main Core Body */}
      <g clipPath="url(#nova-clip-path)">
        <rect x="0" y="0" width="200" height="200" fill="url(#nova-grad-base)" />
        <rect x="0" y="0" width="200" height="200" fill="url(#nova-mesh-blue)" />
        <rect x="0" y="0" width="200" height="200" fill="url(#nova-mesh-amber)" />
        <rect x="0" y="0" width="200" height="200" fill="url(#nova-mesh-coral)" />
        <rect x="0" y="0" width="200" height="200" fill="url(#nova-mesh-teal)" />
        <rect x="0" y="0" width="200" height="200" fill="url(#nova-core-lumen)" />
      </g>
    </svg>
  );
}
