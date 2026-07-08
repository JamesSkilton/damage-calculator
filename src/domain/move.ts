import type {
  BattleMoveCategory,
  BattleMoveFlag,
  BattleMoveTarget,
  BattleStatId,
  BattleTypeName,
  BattleGeneration,
} from './shared';

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
  /** True on the very first turn the attacker uses a Stellar tera-type move. Boosts BP to 60. */
  isStellarFirstUse: boolean;
  /** Number of turns the move has been used consecutively (e.g. Rollout, Fury Cutter). Defaults to 1. */
  timesUsed: number;
  /** Times the move has been used while holding a Metronome item; drives the stacking damage bonus. */
  timesUsedWithMetronome?: number;
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
