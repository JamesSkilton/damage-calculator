import type { BattleCombatant } from './combatant';
import type { BattleField } from './field';
import type { BattleDamage, BattleDamageRange, BattleGeneration } from './shared';
import type { BattleMove } from './move';

export interface BattleResult {
  generation: BattleGeneration;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  move: BattleMove;
  field: BattleField;
  damage: BattleDamage;
  damageRange: BattleDamageRange;
}
