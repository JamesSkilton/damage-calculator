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

export interface BattlePlanAction {
  id: string;
  actor: BattlePlanActor;
  move: BattlePlanMove;
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
  error?: string;
}

export interface BattlePlanInput {
  generation: BattleCombatant['generation'];
  attacker: BattleCombatant;
  defender: BattleCombatant;
  field: BattleField;
  actions: readonly BattlePlanAction[];
}