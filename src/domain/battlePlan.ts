import type { BattleCombatant } from './combatant';
import type { BattleField } from './field';
import type { BattleStatBoosts, BattleStatusName, BattleTerrain, BattleWeather } from './shared';

export type BattlePlanActor = 'attacker' | 'defender';

export interface BattlePlanMove {
  name: string;
  isCrit: boolean;
  hits: number;
  useZ?: boolean;
  useMax?: boolean;
  isStellarFirstUse: boolean;
  timesUsed: number;
  timesUsedWithMetronome?: number;
  /** The Pokémon does nothing this action (asleep, frozen, fully paralysed, flinched…). */
  skipped?: boolean;
}

export interface BattlePlanMoveAction {
  id: string;
  actor: BattlePlanActor;
  type: 'move';
  move: BattlePlanMove;
}

export interface BattlePlanSwitchAction {
  id: string;
  actor: BattlePlanActor;
  type: 'switch';
  targetPokemonId: string;
}

/**
 * Mid-plan correction from the real battle. Omitted fields are left unchanged;
 * `'none'` clears a status, weather or terrain.
 */
export interface BattlePlanStateAction {
  id: string;
  /** Side whose active Pokémon the HP and status apply to. */
  actor: BattlePlanActor;
  type: 'state';
  /** Created by the turn bar's HP/stat controls; rendered there instead of as a step card. */
  source?: 'turn';
  hp?: number;
  status?: BattleStatusName | 'none';
  weather?: BattleWeather | 'none';
  terrain?: BattleTerrain | 'none';
  /** Absolute stat stages (-6..6) to set on the active Pokémon; unlisted stats are unchanged. Reset on switch-out. */
  boosts?: BattleStatBoosts;
}

/** Applies end-of-turn status and weather damage to both active Pokémon. */
export interface BattlePlanEndTurnAction {
  id: string;
  actor: BattlePlanActor;
  type: 'end-turn';
}

export type BattlePlanAction =
  | BattlePlanMoveAction
  | BattlePlanSwitchAction
  | BattlePlanStateAction
  | BattlePlanEndTurnAction;

export interface BattlePlanResidual {
  label: string;
  damage: number;
  maxHp: number;
  sources: string[];
  parts: { source: string; amount: number }[];
}

export interface BattlePlanRosterEntry {
  id: string;
  label: string;
  source: string;
  combatant: BattleCombatant;
  moves: readonly BattlePlanMove[];
}

export interface BattlePlanHpRange {
  min: number;
  max: number;
}

export interface BattlePlanStepResult {
  action: BattlePlanAction;
  damage: BattlePlanHpRange;
  cumulativeDamage: BattlePlanHpRange;
  attackerHp: BattlePlanHpRange;
  defenderHp: BattlePlanHpRange;
  targetHp: BattlePlanHpRange;
  targetMaxHp: number;
  isKo: boolean;
  /** End-of-turn damage taken (or healed, if negative) by each active Pokémon. */
  residual?: Record<BattlePlanActor, BattlePlanResidual>;
  /** Field and per-Pokémon statuses in effect after this step. */
  field: BattleField;
  statuses: Readonly<Record<string, BattleStatusName | undefined>>;
  /** Stat stages per roster id in effect after this step. */
  boosts: Readonly<Record<string, BattleStatBoosts>>;
  /** Max HP of each side's active Pokémon once known (0 until a calculation reveals it). */
  maxHp: Readonly<Record<BattlePlanActor, number>>;
  activePokemonId?: string;
  activePokemonLabel?: string;
  error?: string;
}

export interface BattlePlanInput {
  generation: BattleCombatant['generation'];
  attacker: BattleCombatant;
  defender: BattleCombatant;
  field: BattleField;
  actions: readonly BattlePlanAction[];
  attackerRoster?: readonly BattlePlanRosterEntry[];
  defenderRoster?: readonly BattlePlanRosterEntry[];
  attackerRosterId?: string;
  defenderRosterId?: string;
}