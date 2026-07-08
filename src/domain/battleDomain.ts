/**
 * Canonical battle domain models shared by the phase 2 adapters and result formatting.
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

export interface BattleSideConditions {
  spikes: number;
  steelsurge: boolean;
  vinelash: boolean;
  wildfire: boolean;
  cannonade: boolean;
  volcalith: boolean;
  isSR: boolean;
  isReflect: boolean;
  isLightScreen: boolean;
  isProtected: boolean;
  isSeeded: boolean;
  isSaltCured: boolean;
  isForesight: boolean;
  isTailwind: boolean;
  isHelpingHand: boolean;
  isFlowerGift: boolean;
  isPowerTrick: boolean;
  isFriendGuard: boolean;
  isAuroraVeil: boolean;
  isBattery: boolean;
  isPowerSpot: boolean;
  isSteelySpirit: boolean;
  isSwitching?: BattleSwitchState;
}

export interface BattleField {
  generation: BattleGeneration;
  gameType: BattleGameType;
  weather?: BattleWeather;
  terrain?: BattleTerrain;
  isMagicRoom: boolean;
  isWonderRoom: boolean;
  isGravity: boolean;
  isAuraBreak: boolean;
  isFairyAura: boolean;
  isDarkAura: boolean;
  isBeadsOfRuin: boolean;
  isSwordOfRuin: boolean;
  isTabletsOfRuin: boolean;
  isVesselOfRuin: boolean;
  attackerSide: BattleSideConditions;
  defenderSide: BattleSideConditions;
}

export interface BattleCombatant {
  generation: BattleGeneration;
  name: string;
  species: string;
  level: number;
  gender?: BattleGender;
  ability?: string;
  item?: string;
  nature: string;
  types: readonly [BattleTypeName] | readonly [BattleTypeName, BattleTypeName];
  ivs: BattleStats;
  evs: BattleStats;
  boosts: BattleStatBoosts;
  currentHp: number;
  status?: BattleStatusName;
  toxicCounter: number;
  moves: readonly string[];
  teratype?: BattleTypeName;
}

export type BattleDamage = number | readonly number[] | readonly number[][];

export interface BattleDamageRange {
  min: number;
  max: number;
}

export interface BattleMove {
  generation: BattleGeneration;
  name: string;
  basePower: number;
  type: BattleTypeName;
  category: BattleMoveCategory;
  flags: Partial<Record<BattleMoveFlag, 0 | 1>>;
  target: BattleMoveTarget;
  recoil?: readonly [number, number];
  drain?: readonly [number, number];
  priority: number;
  hits: number;
  isCrit: boolean;
  isZ: boolean;
  isMax: boolean;
  hasCrashDamage: boolean;
  mindBlownRecoil: boolean;
  struggleRecoil: boolean;
  breaksProtect: boolean;
  ignoreDefensive: boolean;
  multiaccuracy: boolean;
  overrideOffensiveStat?: Exclude<BattleStatId, 'hp'>;
  overrideDefensiveStat?: Exclude<BattleStatId, 'hp'>;
  overrideOffensivePokemon?: 'target' | 'source';
  overrideDefensivePokemon?: 'target' | 'source';
  secondaries?: unknown;
  self?: unknown;
}

export interface BattleResult {
  generation: BattleGeneration;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  move: BattleMove;
  field: BattleField;
  damage: BattleDamage;
  damageRange: BattleDamageRange;
}
