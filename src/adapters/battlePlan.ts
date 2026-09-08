import type {
  BattlePlanInput,
  BattlePlanStepResult,
  BattlePlanHpRange,
} from 'domain/battlePlan';
import { buildBattleCalcBreakdowns } from './battleCalc';

function createHpRange(min: number, max: number): BattlePlanHpRange {
  return { min: Math.max(0, min), max: Math.max(0, max) };
}

export function buildBattlePlanResults({
  generation,
  attacker,
  defender,
  field,
  actions,
}: BattlePlanInput): BattlePlanStepResult[] {
  let attackerHp = createHpRange(attacker.currentHp, attacker.currentHp);
  let defenderHp = createHpRange(defender.currentHp, defender.currentHp);
  let attackerMaxHp = 0;
  let defenderMaxHp = 0;
  let cumulativeDamage = createHpRange(0, 0);

  return actions.map((action) => {
    const isAttackerAction = action.actor === 'attacker';
    const actingCombatant = isAttackerAction ? attacker : defender;
    const targetCombatant = isAttackerAction ? defender : attacker;
    const targetHp = isAttackerAction ? defenderHp : attackerHp;
    const actingHp = isAttackerAction ? attackerHp : defenderHp;
    const result = buildBattleCalcBreakdowns({
      generation,
      attacker: {
        ...actingCombatant,
        currentHp: actingHp.max,
      },
      defender: {
        ...targetCombatant,
        currentHp: targetHp.max,
      },
      field,
      moves: [action.move],
    })[0];

    if (!result || result.error || !result.details) {
      return {
        action,
        damage: createHpRange(0, 0),
        cumulativeDamage,
        attackerHp,
        defenderHp,
        targetHp: createHpRange(0, 0),
        targetMaxHp: 0,
        isKo: false,
        error: result?.error ?? 'Unable to calculate',
      };
    }

    const { details } = result;
    if (isAttackerAction) {
      defenderMaxHp = details.defenderMaxHp;
    } else {
      attackerMaxHp = details.defenderMaxHp;
    }

    const resolvedTargetHp =
      targetHp.max === 0
        ? createHpRange(details.defenderCurrentHp, details.defenderCurrentHp)
        : targetHp;

    const damage = createHpRange(
      details.possibleDamage[0] ?? 0,
      details.possibleDamage[details.possibleDamage.length - 1] ?? 0,
    );
    const nextTargetHp = createHpRange(
      resolvedTargetHp.min - damage.max,
      resolvedTargetHp.max - damage.min,
    );

    if (isAttackerAction) {
      defenderHp = nextTargetHp;
    } else {
      attackerHp = nextTargetHp;
    }
    cumulativeDamage = isAttackerAction
      ? createHpRange(
          cumulativeDamage.min + damage.min,
          cumulativeDamage.max + damage.max,
        )
      : cumulativeDamage;

    if (attackerMaxHp === 0) attackerMaxHp = details.defenderMaxHp;
    if (defenderMaxHp === 0) defenderMaxHp = details.defenderMaxHp;

    return {
      action,
      damage,
      cumulativeDamage,
      attackerHp,
      defenderHp,
      targetHp: nextTargetHp,
      targetMaxHp: details.defenderMaxHp,
      isKo: nextTargetHp.max === 0,
    };
  });
}