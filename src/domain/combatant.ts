import type {
  BattleGender,
  BattleGeneration,
  BattleStatBoosts,
  BattleStats,
  BattleStatusName,
  BattleTypeName,
} from './shared';

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
