import type {
  BattleMoveCategory,
  BattleMoveFlag,
  BattleMoveTarget,
  BattleStatId,
  BattleTypeName,
} from '@/domain';

export interface LegacyMoveData {
  id?: string;
  name: string;
  basePower: number;
  type: BattleTypeName;
  category?: BattleMoveCategory;
  flags: Partial<Record<BattleMoveFlag, 0 | 1>>;
  secondaries?: unknown;
  target?: BattleMoveTarget;
  recoil?: readonly [number, number];
  hasCrashDamage?: boolean;
  mindBlownRecoil?: boolean;
  struggleRecoil?: boolean;
  willCrit?: boolean;
  drain?: readonly [number, number];
  priority?: number;
  self?: { boosts?: Partial<Record<BattleStatId, number>> } | null;
  ignoreDefensive?: boolean;
  overrideOffensiveStat?: Exclude<BattleStatId, 'hp'>;
  overrideDefensiveStat?: Exclude<BattleStatId, 'hp'>;
  overrideOffensivePokemon?: 'target' | 'source';
  overrideDefensivePokemon?: 'target' | 'source';
  breaksProtect?: boolean;
  isZ?: boolean | string;
  zMove?: { basePower?: number };
  isMax?: boolean | string;
  maxMove?: { basePower: number };
  multihit?: number | number[];
  multiaccuracy?: boolean;
}

export interface LegacyMoveInput {
  name: string;
  useZ?: boolean;
  useMax?: boolean;
  isCrit?: boolean;
  isStellarFirstUse?: boolean;
  hits?: number;
  timesUsed?: number;
  timesUsedWithMetronome?: number;
  ability?: string;
  item?: string;
  species?: string;
  overrides?: Partial<LegacyMoveData>;
}
