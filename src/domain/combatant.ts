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
  /** True while a toggle ability (Flash Fire, Slow Start, Stakeout, etc.) is active for this combatant. */
  abilityOn: boolean;
  /** True when the combatant is in the Dynamax state. */
  isDynamaxed: boolean;
  /**
   * Dynamax level (0–10). Only meaningful when `isDynamaxed` is true.
   * Omit when not dynamaxed. Defaults to 10 in the legacy calc.
   */
  dynamaxLevel?: number;
  moves: readonly string[];
  teratype?: BattleTypeName;
}
