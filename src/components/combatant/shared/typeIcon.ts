/**
 * Maps a Pokémon type to its glyph icon and chip background color for the
 * tight, space-constrained rows of SearchableTypePicker's dropdown (used by
 * both the move picker and the Pokémon/species picker — moves and species
 * share the same 18-type palette).
 *
 * Colors mirror the hex values already used for `.move-type-badge[data-type]`
 * in the legacy SearchableMovePicker.css so icon chips stay visually
 * consistent with the rest of the app (see also TypeBadge.scss's
 * `$badge-types`, which uses the same palette at lower precision).
 */
import bug from 'assets/types/bug.svg';
import dark from 'assets/types/dark.svg';
import dragon from 'assets/types/dragon.svg';
import electric from 'assets/types/electric.svg';
import fairy from 'assets/types/fairy.svg';
import fighting from 'assets/types/fighting.svg';
import fire from 'assets/types/fire.svg';
import flying from 'assets/types/flying.svg';
import ghost from 'assets/types/ghost.svg';
import grass from 'assets/types/grass.svg';
import ground from 'assets/types/ground.svg';
import ice from 'assets/types/ice.svg';
import normal from 'assets/types/normal.svg';
import poison from 'assets/types/poison.svg';
import psychic from 'assets/types/psychic.svg';
import rock from 'assets/types/rock.svg';
import steel from 'assets/types/steel.svg';
import water from 'assets/types/water.svg';

const TYPE_ICONS: Record<string, string> = {
  bug,
  dark,
  dragon,
  electric,
  fairy,
  fighting,
  fire,
  flying,
  ghost,
  grass,
  ground,
  ice,
  normal,
  poison,
  psychic,
  rock,
  steel,
  water,
};

const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878',
  fire: '#f08030',
  water: '#6890f0',
  electric: '#f8d030',
  grass: '#78c850',
  ice: '#98d8d8',
  fighting: '#c03028',
  poison: '#a040a0',
  ground: '#e0c068',
  flying: '#a890f0',
  psychic: '#f85888',
  bug: '#a8b820',
  rock: '#b8a038',
  ghost: '#705898',
  dragon: '#7038f8',
  dark: '#705848',
  steel: '#b8b8d0',
  fairy: '#ee99ac',
  stellar: '#ffd6db',
  '???': '#68a090',
};

const DEFAULT_TYPE_COLOR = '#68a090';

/**
 * Returns the icon asset URL for a type, or undefined when no icon exists
 * (e.g. the typeless '???' type or the 'Stellar' tera type).
 */
export function getTypeIcon(type: string): string | undefined {
  return TYPE_ICONS[type.toLowerCase()];
}

/**
 * Returns the chip background color for a type, falling back to a neutral
 * color for unrecognized/typeless types.
 */
export function getTypeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? DEFAULT_TYPE_COLOR;
}
