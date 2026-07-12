import type { BattleCombatant } from 'domain/combatant';
import type { BattleField } from 'domain/field';
import type {
  BattleDamage,
  BattleDamageRange,
  BattleGeneration,
} from 'domain/shared';
import type { BattleMove } from 'domain/move';

export interface BattleResult {
  generation: BattleGeneration;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  move: BattleMove;
  field: BattleField;
  damage: BattleDamage;
  damageRange: BattleDamageRange;
}
