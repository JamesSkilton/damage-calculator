import type {
  BattleCombatant,
  BattleField,
  BattleGeneration,
  BattleMove,
} from 'domain/index';

export interface CalcRuntimeInput {
  generation: BattleGeneration;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  move: BattleMove;
  field: BattleField;
}
