import type {
  BattlePlanInput,
  BattlePlanStepResult,
  BattlePlanHpRange,
  BattlePlanRosterEntry,
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
  attackerRoster = [],
  defenderRoster = [],
  attackerRosterId,
  defenderRosterId,
}: BattlePlanInput): BattlePlanStepResult[] {
  const rosters: Record<'attacker' | 'defender', BattlePlanRosterEntry[]> = {
    attacker: attackerRoster.length > 0 ? [...attackerRoster] : [{
      id: 'initial-attacker',
      label: attacker.name || attacker.species,
      source: 'current',
      combatant: attacker,
      moves: [],
    }],
    defender: defenderRoster.length > 0 ? [...defenderRoster] : [{
      id: 'initial-defender',
      label: defender.name || defender.species,
      source: 'current',
      combatant: defender,
      moves: [],
    }],
  };
  const activeIds = {
    attacker: attackerRosterId ?? rosters.attacker[0].id,
    defender: defenderRosterId ?? rosters.defender[0].id,
  };
  const hpById = new Map<string, BattlePlanHpRange>();
  const maxHpById = new Map<string, number>();
  for (const entry of [...rosters.attacker, ...rosters.defender]) {
    hpById.set(entry.id, createHpRange(entry.combatant.currentHp, entry.combatant.currentHp));
  }
  const getActiveEntry = (actor: 'attacker' | 'defender') =>
    rosters[actor].find((entry) => entry.id === activeIds[actor]);
  const getHp = (entry: BattlePlanRosterEntry) =>
    hpById.get(entry.id) ?? createHpRange(entry.combatant.currentHp, entry.combatant.currentHp);

  let attackerHp = getHp(getActiveEntry('attacker')!);
  let defenderHp = getHp(getActiveEntry('defender')!);
  let cumulativeDamage = createHpRange(0, 0);

  return actions.map((action) => {
    const isAttackerAction = action.actor === 'attacker';
    const actor = action.actor;
    const activeEntry = getActiveEntry(actor);
    const targetActor = isAttackerAction ? 'defender' : 'attacker';
    const targetEntry = getActiveEntry(targetActor);

    if (!activeEntry || !targetEntry) {
      return {
        action,
        damage: createHpRange(0, 0),
        cumulativeDamage,
        attackerHp,
        defenderHp,
        targetHp: createHpRange(0, 0),
        targetMaxHp: 0,
        isKo: false,
        error: 'Unable to resolve active Pokemon',
      };
    }

    if (action.type === 'switch') {
      const nextEntry = rosters[actor].find((entry) => entry.id === action.targetPokemonId);
      if (!nextEntry) {
        return {
          action,
          damage: createHpRange(0, 0),
          cumulativeDamage,
          attackerHp,
          defenderHp,
          targetHp: getHp(targetEntry),
          targetMaxHp: maxHpById.get(targetEntry.id) ?? 0,
          isKo: false,
          activePokemonId: activeEntry.id,
          activePokemonLabel: activeEntry.label,
          error: `Unknown switch target: ${action.targetPokemonId}`,
        };
      }
      hpById.set(activeEntry.id, getHp(activeEntry));
      activeIds[actor] = nextEntry.id;
      attackerHp = getHp(getActiveEntry('attacker')!);
      defenderHp = getHp(getActiveEntry('defender')!);
      const switchedHp = getHp(nextEntry);
      return {
        action,
        damage: createHpRange(0, 0),
        cumulativeDamage,
        attackerHp,
        defenderHp,
        targetHp: switchedHp,
        targetMaxHp: maxHpById.get(nextEntry.id) ?? 0,
        isKo: false,
        activePokemonId: nextEntry.id,
        activePokemonLabel: nextEntry.label,
      };
    }

    const actingCombatant = activeEntry.combatant;
    const targetCombatant = targetEntry.combatant;
    const targetHp = getHp(targetEntry);
    const actingHp = getHp(activeEntry);
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
      hpById.set(targetEntry.id, nextTargetHp);
      maxHpById.set(targetEntry.id, details.defenderMaxHp);
    } else {
      attackerHp = nextTargetHp;
      hpById.set(targetEntry.id, nextTargetHp);
      maxHpById.set(targetEntry.id, details.defenderMaxHp);
    }
    cumulativeDamage = isAttackerAction
      ? createHpRange(
          cumulativeDamage.min + damage.min,
          cumulativeDamage.max + damage.max,
        )
      : cumulativeDamage;

    return {
      action,
      damage,
      cumulativeDamage,
      attackerHp,
      defenderHp,
      targetHp: nextTargetHp,
      targetMaxHp: details.defenderMaxHp,
      isKo: nextTargetHp.max === 0,
      activePokemonId: activeEntry.id,
      activePokemonLabel: activeEntry.label,
    };
  });
}