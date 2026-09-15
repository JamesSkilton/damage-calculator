import type { ReactEventHandler } from 'react';

const SPRITE_BASE_URL = 'https://img.pokemondb.net/artwork/';

type PokemonSpriteProps = {
  name: string;
  alt?: string;
  className?: string;
  onError?: ReactEventHandler<HTMLImageElement>;
};

function toSpriteSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/alola\b/g, 'alolan')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

export default function PokemonSprite({
  name,
  alt = name,
  className,
  onError,
}: PokemonSpriteProps) {
  return (
    <img
      className={className}
      src={`${SPRITE_BASE_URL}${toSpriteSlug(name)}.jpg`}
      alt={alt}
      onError={onError}
    />
  );
}
