/**
 * Shared battle primitives used by the phase 2 domain modules.
 */
export type BattleGeneration = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type BattleGender = 'M' | 'F' | 'N';

export type BattleStatId = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

export type BattleStats = Readonly<Record<BattleStatId, number>>;

export type BattleStatBoosts = Partial<Record<BattleStatId, number>>;

export type BattleStatusName = 'slp' | 'psn' | 'brn' | 'frz' | 'par' | 'tox';

export type BattleGameType = 'Singles' | 'Doubles';

export type BattleTerrain = 'Electric' | 'Grassy' | 'Psychic' | 'Misty';

export type BattleWeather =
  | 'Sand'
  | 'Sun'
  | 'Rain'
  | 'Hail'
  | 'Snow'
  | 'Harsh Sunshine'
  | 'Heavy Rain'
  | 'Strong Winds';

export type BattleTypeName =
  | 'Normal'
  | 'Fighting'
  | 'Flying'
  | 'Poison'
  | 'Ground'
  | 'Rock'
  | 'Bug'
  | 'Ghost'
  | 'Steel'
  | 'Fire'
  | 'Water'
  | 'Grass'
  | 'Electric'
  | 'Psychic'
  | 'Ice'
  | 'Dragon'
  | 'Dark'
  | 'Fairy'
  | 'Stellar'
  | '???';

export type BattleMoveCategory = 'Physical' | 'Special' | 'Status';

export type BattleMoveTarget =
  | 'adjacentAlly'
  | 'adjacentAllyOrSelf'
  | 'adjacentFoe'
  | 'all'
  | 'allAdjacent'
  | 'allAdjacentFoes'
  | 'allies'
  | 'allySide'
  | 'allyTeam'
  | 'any'
  | 'foeSide'
  | 'normal'
  | 'randomNormal'
  | 'scripted'
  | 'self';

export type BattleMoveFlag =
  | 'contact'
  | 'bite'
  | 'sound'
  | 'punch'
  | 'bullet'
  | 'pulse'
  | 'slicing'
  | 'wind';

export type BattleSwitchState = 'in' | 'out';

export type BattleDamage = number | readonly number[] | readonly number[][];

export interface BattleDamageRange {
  min: number;
  max: number;
}
