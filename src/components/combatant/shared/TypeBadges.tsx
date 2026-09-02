import { getTypeColor, getTypeIcon } from './typeIcon';

type TypeBadgesProps = {
  types: string[];
};

/**
 * Renders one chip per Pokémon type (a single chip for moves, one or two for
 * species). Shared by SearchableMovePicker and SearchablePokemonPicker (via
 * SearchableTypePicker) so the icon/color/fallback-glyph logic only lives in
 * one place.
 */
export default function TypeBadges({ types }: TypeBadgesProps) {
  return (
    <>
      {types.map((type) => (
        <span
          key={type}
          className="type-badge"
          role="img"
          aria-label={type}
          title={type}
          style={{ backgroundColor: getTypeColor(type) }}
        >
          {getTypeIcon(type) ? (
            <img
              className="type-badge-img"
              src={getTypeIcon(type)}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <span className="type-badge-fallback" aria-hidden="true">
              {type.slice(0, 1)}
            </span>
          )}
        </span>
      ))}
    </>
  );
}
