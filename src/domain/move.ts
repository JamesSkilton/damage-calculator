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
