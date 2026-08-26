import React from 'react';
import { RESPONSIBILITY_TILES } from '@/constants/navigation';
import { BaseButton } from '@/components/base/base-button';

interface MegaDropdownProps {
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function MegaDropdown({ isOpen, onMouseEnter, onMouseLeave }: MegaDropdownProps) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute top-full left-0 right-0 pt-3 z-50 animate-fade-in"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto shadow-2xl">
        {/* Tile 1: Text Title & CTA */}
        <div className="bg-neutral-900/60 rounded-xl p-5 flex flex-col justify-between border border-white/5">
          <div>
            <h4 className="text-xl font-bold text-white mb-2">{RESPONSIBILITY_TILES[0].title}</h4>
            <p className="text-sm text-neutral-400 leading-relaxed">
              {RESPONSIBILITY_TILES[0].description}
            </p>
          </div>
          <div className="mt-6">
            <BaseButton
              href={RESPONSIBILITY_TILES[0].href}
              variant="glass"
              size="sm"
              iconRight="→"
              className="w-full justify-between"
            >
              View
            </BaseButton>
          </div>
        </div>

        {/* Tiles 2-4: Purpose, Planet, Product */}
        {RESPONSIBILITY_TILES.slice(1).map((tile) => (
          <a
            key={tile.title}
            href={tile.href}
            className="group relative rounded-xl overflow-hidden aspect-[4/3] bg-neutral-800 flex flex-col justify-end p-4 border border-white/5 hover:border-white/20 transition-all"
          >
            {tile.image && (
              <img
                src={tile.image}
                alt={tile.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <span className="relative z-10 text-white font-medium text-base group-hover:underline">
              {tile.ctaText} →
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
