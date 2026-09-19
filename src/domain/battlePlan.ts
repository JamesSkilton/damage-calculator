import type { BattleCombatant } from './combatant';
import type { BattleField } from './field';

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

export type BattlePlanAction = BattlePlanMoveAction | BattlePlanSwitchAction;

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