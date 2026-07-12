import type { BattleTypeName } from '@/domain';

export const SPECIAL_TYPES: BattleTypeName[] = [
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Ice',
  'Psychic',
  'Dark',
  'Dragon',
];

export const ZMOVES_TYPING: Partial<Record<BattleTypeName, string>> = {
  Bug: 'Savage Spin-Out',
  Dark: 'Black Hole Eclipse',
  Dragon: 'Devastating Drake',
  Electric: 'Gigavolt Havoc',
  Fairy: 'Twinkle Tackle',
  Fighting: 'All-Out Pummeling',
  Fire: 'Inferno Overdrive',
  Flying: 'Supersonic Skystrike',
  Ghost: 'Never-Ending Nightmare',
  Grass: 'Bloom Doom',
  Ground: 'Tectonic Rage',
  Ice: 'Subzero Slammer',
  Normal: 'Breakneck Blitz',
  Poison: 'Acid Downpour',
  Psychic: 'Shattered Psyche',
  Rock: 'Continental Crush',
  Steel: 'Corkscrew Crash',
  Water: 'Hydro Vortex',
};

export const MAXMOVES_TYPING: Partial<Record<BattleTypeName, string>> = {
  Bug: 'Flutterby',
  Dark: 'Darkness',
  Dragon: 'Wyrmwind',
  Electric: 'Lightning',
  Fairy: 'Starfall',
  Fighting: 'Knuckle',
  Fire: 'Flare',
  Flying: 'Airstream',
  Ghost: 'Phantasm',
  Grass: 'Overgrowth',
  Ground: 'Quake',
  Ice: 'Hailstorm',
  Normal: 'Strike',
  Poison: 'Ooze',
  Psychic: 'Mindstorm',
  Rock: 'Rockfall',
  Steel: 'Steelspike',
  Water: 'Geyser',
};
