import type {
  BattlePlanAction,
  BattlePlanActor,
  BattlePlanResidual,
  BattlePlanInput,
  BattlePlanStepResult,
  BattlePlanHpRange,
  BattlePlanRosterEntry,
} from 'domain/battlePlan';
import type { BattleStatBoosts, BattleStatusName } from 'domain/shared';
import { calculateEndOfTurnResidual, type EndOfTurnResidual } from 'calc-runtime';
import { buildBattleCalcBreakdowns } from './battleCalc';
import { getInflictedStatus } from './moveStatus';

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

  let currentField = field;
  const statusById = new Map<string, BattleStatusName | undefined>();
  const toxicCounterById = new Map<string, number>();
  for (const entry of [...rosters.attacker, ...rosters.defender]) {
    statusById.set(entry.id, entry.combatant.status);
    toxicCounterById.set(entry.id, entry.combatant.toxicCounter);
  }

  const boostsById = new Map<string, BattleStatBoosts>();
  for (const entry of [...rosters.attacker, ...rosters.defender]) {
    boostsById.set(entry.id, { ...entry.combatant.boosts });
  }
  const getBoosts = (entry: BattlePlanRosterEntry) => boostsById.get(entry.id) ?? entry.combatant.boosts;

  const resolve = (action: BattlePlanAction): Omit<BattlePlanStepResult, 'field' | 'statuses' | 'boosts' | 'maxHp'> => {
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

    if (action.type === 'end-turn') {
      const residual = {} as Record<BattlePlanActor, BattlePlanResidual>;
      for (const side of ['attacker', 'defender'] as const) {
        const entry = getActiveEntry(side);
        if (!entry) continue;
        const hp = getHp(entry);
        let tick: EndOfTurnResidual = { maxHp: maxHpById.get(entry.id) ?? 0, damage: 0, sources: [], parts: [] };
        if (hp.max > 0) {
          const counter = toxicCounterById.get(entry.id) ?? 0;
          try {
            tick = calculateEndOfTurnResidual({
              generation,
              combatant: { ...entry.combatant, status: statusById.get(entry.id) },
              field: currentField,
              toxicCounter: counter,
            });
          } catch {
            // Unknown species etc.: leave HP untouched.
          }
          if (statusById.get(entry.id) === 'tox') toxicCounterById.set(entry.id, counter + 1);
          if (tick.inflictedStatus) {
            statusById.set(entry.id, tick.inflictedStatus);
            toxicCounterById.set(entry.id, 0);
          }
          maxHpById.set(entry.id, tick.maxHp);
          const apply = (value: number) => Math.min(tick.maxHp, Math.max(0, value - tick.damage));
          const next = createHpRange(apply(hp.min), apply(hp.max));
          hpById.set(entry.id, next);
        }
        residual[side] = { label: entry.label, damage: tick.damage, maxHp: tick.maxHp, sources: tick.sources, parts: tick.parts };
      }
      attackerHp = getHp(getActiveEntry('attacker')!);
      defenderHp = getHp(getActiveEntry('defender')!);
      return {
        action,
        damage: createHpRange(0, 0),
        cumulativeDamage,
        attackerHp,
        defenderHp,
        targetHp: defenderHp,
        targetMaxHp: residual.defender?.maxHp ?? 0,
        isKo: attackerHp.max === 0 || defenderHp.max === 0,
        residual,
        activePokemonId: activeEntry.id,
        activePokemonLabel: activeEntry.label,
      };
    }

    if (action.type === 'state') {
      if (action.weather) {
        currentField = { ...currentField, weather: action.weather === 'none' ? undefined : action.weather };
      }
      if (action.terrain) {
        currentField = { ...currentField, terrain: action.terrain === 'none' ? undefined : action.terrain };
      }
      if (action.status) {
        statusById.set(activeEntry.id, action.status === 'none' ? undefined : action.status);
        toxicCounterById.set(activeEntry.id, 0);
      }
      if (action.boosts) {
        const next = { ...getBoosts(activeEntry) };
        for (const [stat, stage] of Object.entries(action.boosts)) {
          if (stage !== undefined) next[stat as keyof BattleStatBoosts] = Math.max(-6, Math.min(6, stage));
        }
        boostsById.set(activeEntry.id, next);
      }
      if (action.hp !== undefined) {
        const known = maxHpById.get(activeEntry.id);
        const hp = Math.max(0, known ? Math.min(known, action.hp) : action.hp);
        hpById.set(activeEntry.id, createHpRange(hp, hp));
      }
      attackerHp = getHp(getActiveEntry('attacker')!);
      defenderHp = getHp(getActiveEntry('defender')!);
      const activeHp = getHp(activeEntry);
      return {
        action,
        damage: createHpRange(0, 0),
        cumulativeDamage,
        attackerHp,
        defenderHp,
        targetHp: activeHp,
        targetMaxHp: maxHpById.get(activeEntry.id) ?? 0,
        isKo: false,
        activePokemonId: activeEntry.id,
        activePokemonLabel: activeEntry.label,
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
      toxicCounterById.set(activeEntry.id, 0);
      boostsById.set(activeEntry.id, { ...activeEntry.combatant.boosts });
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

    if (action.move.skipped) {
      // No damage calc runs for a skipped move, so probe once to learn each side's max HP.
      for (const [entry, opponent] of [[activeEntry, targetEntry], [targetEntry, activeEntry]] as const) {
        if (maxHpById.has(entry.id)) continue;
        const probe = buildBattleCalcBreakdowns({
          generation,
          attacker: opponent.combatant,
          defender: { ...entry.combatant, currentHp: getHp(entry).max },
          field: currentField,
          moves: [{ ...action.move, name: opponent.moves[0]?.name || action.move.name || 'Tackle', skipped: false }],
        })[0];
        if (probe?.details) {
          maxHpById.set(entry.id, probe.details.defenderMaxHp);
          // An unset (0) HP means full health; resolve it to real HP so it doesn't display as 0.
          if (getHp(entry).max === 0) {
            hpById.set(entry.id, createHpRange(probe.details.defenderCurrentHp, probe.details.defenderCurrentHp));
          }
        }
      }
      attackerHp = getHp(getActiveEntry('attacker')!);
      defenderHp = getHp(getActiveEntry('defender')!);
      return {
        action,
        damage: createHpRange(0, 0),
        cumulativeDamage,
        attackerHp,
        defenderHp,
        targetHp,
        targetMaxHp: maxHpById.get(targetEntry.id) ?? 0,
        isKo: false,
        activePokemonId: activeEntry.id,
        activePokemonLabel: activeEntry.label,
      };
    }
    const result = buildBattleCalcBreakdowns({
      generation,
      attacker: {
        ...actingCombatant,
        status: statusById.get(activeEntry.id),
        boosts: getBoosts(activeEntry),
        currentHp: actingHp.max,
      },
      defender: {
        ...targetCombatant,
        status: statusById.get(targetEntry.id),
        boosts: getBoosts(targetEntry),
        currentHp: targetHp.max,
      },
      field: currentField,
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

    const inflicted = getInflictedStatus(
      generation,
      action.move.name,
      targetCombatant.types,
      statusById.get(targetEntry.id),
    );
    if (inflicted) {
      statusById.set(targetEntry.id, inflicted);
      toxicCounterById.set(targetEntry.id, 0);
    }

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
  };

  return actions.map((action) => ({
    ...resolve(action),
    field: currentField,
    statuses: Object.fromEntries(statusById),
    boosts: Object.fromEntries(Array.from(boostsById, ([id, value]) => [id, { ...value }])),
    maxHp: {
      attacker: maxHpById.get(activeIds.attacker) ?? 0,
      defender: maxHpById.get(activeIds.defender) ?? 0,
    },
  }));
}