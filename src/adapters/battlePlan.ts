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
import { getInflictedStatus, inflictsConfusion } from './moveStatus';
import { canEatBerry, curesConfusion, curesStatus, getHitBerry, getHpBerry } from './berries';
import { getBerryResistType } from 'calc-runtime/core/items';

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
  const consumedItems = new Set<string>();
  // Items eaten on some damage rolls but not all of them.
  const maybeConsumedItems = new Set<string>();
  const unburdenActive = new Set(
    [...rosters.attacker, ...rosters.defender]
      .filter((entry) => (entry.id === activeIds.attacker || entry.id === activeIds.defender) &&
        entry.combatant.ability === 'Unburden' && entry.combatant.abilityOn)
      .map((entry) => entry.id),
  );
  let stepEvents: string[] = [];
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

  const heldItem = (entry: BattlePlanRosterEntry) =>
    consumedItems.has(entry.id) ? undefined : entry.combatant.item;
  const sideOf = (entry: BattlePlanRosterEntry): BattlePlanActor =>
    rosters.attacker.some((candidate) => candidate.id === entry.id) ? 'attacker' : 'defender';
  const canEat = (entry: BattlePlanRosterEntry) => {
    const opponent = getActiveEntry(sideOf(entry) === 'attacker' ? 'defender' : 'attacker');
    return canEatBerry(entry.combatant.ability, opponent?.combatant.ability);
  };
  const markConsumed = (entry: BattlePlanRosterEntry, certain: boolean) => {
    if (certain) {
      consumedItems.add(entry.id);
      maybeConsumedItems.delete(entry.id);
      if (entry.combatant.ability === 'Unburden') {
        unburdenActive.add(entry.id);
        stepEvents.push(`${entry.label}: Unburden activated`);
      }
    } else if (!consumedItems.has(entry.id)) {
      maybeConsumedItems.add(entry.id);
    }
  };
  const boostStat = (entry: BattlePlanRosterEntry, stat: keyof BattleStatBoosts, stages: number) => {
    const next = { ...getBoosts(entry) };
    next[stat] = Math.max(-6, Math.min(6, (next[stat] ?? 0) + stages));
    boostsById.set(entry.id, next);
  };
  const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

  const recordCheekPouch = (entry: BattlePlanRosterEntry, certain: boolean, gains: number[]) => {
    const min = Math.min(...gains);
    const max = Math.max(...gains);
    if (max > 0) {
      stepEvents.push(`${entry.label}: Cheek Pouch ${certain ? 'restored' : 'possibly restored'} ${min === max ? max : `${min}-${max}`} HP`);
    }
  };

  const applyCheekPouch = (entry: BattlePlanRosterEntry, certain: boolean, threshold?: number) => {
    if (entry.combatant.ability !== 'Cheek Pouch') return;
    const maxHp = maxHpById.get(entry.id) ?? 0;
    const hp = getHp(entry);
    if (maxHp <= 0 || hp.max <= 0) return;
    const amount = Math.max(1, Math.floor(maxHp / 3));
    const candidates = [hp.min, hp.max, 1, ...(threshold === undefined ? [] : [threshold, threshold + 1])]
      .filter((value) => value >= hp.min && value <= hp.max);
    const gain = (value: number) => value > 0 && (threshold === undefined || value <= threshold)
      ? Math.min(maxHp - value, amount)
      : 0;
    const healed = candidates.map((value) => value + gain(value));
    hpById.set(entry.id, createHpRange(certain || threshold !== undefined ? Math.min(...healed) : hp.min, Math.max(...healed)));
    recordCheekPouch(entry, certain, certain || threshold !== undefined ? candidates.map(gain) : [0, ...candidates.map(gain)]);
  };

  /** Eats the active Pokémon's low-HP berry if its HP is at or below the berry's threshold. Returns the HP healed. */
  const eatHpBerry = (entry: BattlePlanRosterEntry): number => {
    const item = heldItem(entry);
    const berry = getHpBerry(item, generation, entry.combatant.ability);
    const maxHp = maxHpById.get(entry.id) ?? 0;
    const hp = getHp(entry);
    if (!item || !berry || maxHp <= 0 || hp.max <= 0 || !canEat(entry)) return 0;

    const triggers = (value: number) => value > 0 && value <= maxHp * berry.threshold;
    if (!triggers(Math.max(1, hp.min))) return 0;
    const certain = hp.min > 0 && triggers(hp.max);
    const label = certain ? item : `${item} (possibly)`;
    markConsumed(entry, certain);

    const { effect } = berry;
    if (effect.kind === 'heal') {
      const threshold = Math.floor(maxHp * berry.threshold);
      const candidates = [hp.min, hp.max, 1, threshold, threshold + 1]
        .filter((value) => value >= hp.min && value <= hp.max);
      const gain = (value: number) => triggers(value) ? Math.min(maxHp - value, effect.amount(maxHp)) : 0;
      const pouchGain = (value: number) => entry.combatant.ability === 'Cheek Pouch' && triggers(value)
        ? Math.min(maxHp - value - gain(value), Math.max(1, Math.floor(maxHp / 3)))
        : 0;
      const healedHp = candidates.map((value) => value + gain(value) + pouchGain(value));
      const gains = candidates.map(gain);
      hpById.set(entry.id, createHpRange(Math.min(...healedHp), Math.max(...healedHp)));
      const healMin = Math.min(...gains);
      const healMax = Math.max(...gains);
      stepEvents.push(`${entry.label}: ${label} restored ${healMax === healMin ? healMax : `${healMin}-${healMax}`} HP`);
      recordCheekPouch(entry, certain, candidates.map(pouchGain));
      return healMax;
    }
    if (effect.kind === 'boost') {
      if (certain) boostStat(entry, effect.stat, effect.stages);
      stepEvents.push(`${entry.label}: ${label} ${certain ? 'raised' : 'may raise'} ${effect.stat.toUpperCase()} ${signed(effect.stages)}`);
    } else if (effect.kind === 'random-boost') {
      stepEvents.push(`${entry.label}: ${label} sharply raised a random stat`);
    } else {
      stepEvents.push(`${entry.label}: ${label} was eaten`);
    }
    applyCheekPouch(entry, certain, Math.floor(maxHp * berry.threshold));
    return 0;
  };

  /** Combatant as the damage calc should see it right now (status, stat stages, consumed item). */
  const liveCombatant = (entry: BattlePlanRosterEntry, hp: BattlePlanHpRange) => ({
    ...entry.combatant,
    item: heldItem(entry),
    abilityOn: entry.combatant.ability === 'Unburden' ? unburdenActive.has(entry.id) : entry.combatant.abilityOn,
    status: statusById.get(entry.id),
    boosts: getBoosts(entry),
    currentHp: hp.max,
  });

  const resolve = (action: BattlePlanAction): Omit<BattlePlanStepResult, 'field' | 'statuses' | 'items' | 'unburdenActive' | 'boosts' | 'maxHp' | 'itemEvents'> => {
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
        let hp = getHp(entry);
        let tick: EndOfTurnResidual = { maxHp: maxHpById.get(entry.id) ?? 0, damage: 0, sources: [], parts: [] };
        if (hp.max > 0) {
          const counter = toxicCounterById.get(entry.id) ?? 0;
          let curedBy: string | undefined;
          const currentStatus = statusById.get(entry.id);
          if (currentStatus && canEat(entry) && curesStatus(heldItem(entry), currentStatus)) {
            curedBy = `${entry.combatant.item} (cures ${currentStatus})`;
            statusById.set(entry.id, undefined);
            toxicCounterById.set(entry.id, 0);
            markConsumed(entry, true);
          }
          try {
            tick = calculateEndOfTurnResidual({
              generation,
              combatant: {
                ...entry.combatant,
                item: heldItem(entry),
                status: statusById.get(entry.id),
              },
              field: currentField,
              toxicCounter: counter,
            });
          } catch {
            // Unknown species etc.: leave HP untouched.
          }
          if (curedBy) tick.sources = [...tick.sources, curedBy];
          if (statusById.get(entry.id) === 'tox') toxicCounterById.set(entry.id, counter + 1);
          if (tick.inflictedStatus) {
            statusById.set(entry.id, tick.inflictedStatus);
            toxicCounterById.set(entry.id, 0);
          }
          maxHpById.set(entry.id, tick.maxHp);
          if (curedBy) {
            applyCheekPouch(entry, true);
            hp = getHp(entry);
          }
          const apply = (value: number) => Math.min(tick.maxHp, Math.max(0, value - tick.damage));
          const next = createHpRange(apply(hp.min), apply(hp.max));
          hpById.set(entry.id, next);
          const healed = eatHpBerry(entry);
          if (healed > 0) {
            tick.parts = [...tick.parts, { source: entry.combatant.item!, amount: -healed, berry: true }];
            tick.sources = [...tick.sources, entry.combatant.item!];
          }
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
      unburdenActive.delete(activeEntry.id);
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
          moves: [{ ...action.move, name: opponent.moves[0]?.name || action.move.name || 'Tackle' }],
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
      attacker: liveCombatant(activeEntry, actingHp),
      defender: liveCombatant(targetEntry, targetHp),
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
    hpById.set(targetEntry.id, resolvedTargetHp);
    maxHpById.set(targetEntry.id, details.defenderMaxHp);
    if (!maxHpById.has(activeEntry.id)) maxHpById.set(activeEntry.id, details.attackerMaxHp);

    // Resist berries are eaten while the incoming damage is being calculated.
    const targetItem = heldItem(targetEntry);
    if (targetItem && details.defenderItemUsed === targetItem && getBerryResistType(targetItem)) {
      markConsumed(targetEntry, true);
      stepEvents.push(`${targetEntry.label}: ${targetItem} weakened the hit`);
      applyCheekPouch(targetEntry, true);
    }
    const hpBeforeDamage = getHp(targetEntry);
    const nextTargetHp = createHpRange(
      hpBeforeDamage.min - damage.max,
      hpBeforeDamage.max - damage.min,
    );

    if (isAttackerAction) {
      defenderHp = nextTargetHp;
    } else {
      attackerHp = nextTargetHp;
    }
    hpById.set(targetEntry.id, nextTargetHp);
    cumulativeDamage = isAttackerAction
      ? createHpRange(
          cumulativeDamage.min + damage.min,
          cumulativeDamage.max + damage.max,
        )
      : cumulativeDamage;

    // Item reactions to this hit, in the order the game resolves them.
    const hitBerry = canEat(targetEntry) ? getHitBerry(heldItem(targetEntry), targetCombatant.ability) : undefined;
    const survivesMaybe = nextTargetHp.max > 0 && damage.max > 0;
    const hitTriggers =
      hitBerry !== undefined &&
      survivesMaybe &&
      (hitBerry.when === 'super-effective'
        ? details.isSuperEffective
        : details.moveCategory.toLowerCase() === hitBerry.when);
    if (hitBerry && hitTriggers) {
      const certain = nextTargetHp.min > 0 && damage.min > 0;
      const berryName = `${heldItem(targetEntry)}${certain ? '' : ' (possibly)'}`;
      markConsumed(targetEntry, certain);
      const { effect } = hitBerry;
      if (effect.kind === 'boost') {
        if (certain) boostStat(targetEntry, effect.stat, effect.stages);
        stepEvents.push(`${targetEntry.label}: ${berryName} ${certain ? 'raised' : 'may raise'} ${effect.stat.toUpperCase()} ${signed(effect.stages)}`);
      } else if (effect.kind === 'heal') {
        const amount = Math.floor(details.defenderMaxHp / effect.divisor);
        const current = getHp(targetEntry);
        hpById.set(
          targetEntry.id,
          createHpRange(
            Math.min(details.defenderMaxHp, current.min + (certain ? amount : 0)),
            Math.min(details.defenderMaxHp, current.max + amount),
          ),
        );
        stepEvents.push(`${targetEntry.label}: ${berryName} restored ${amount} HP`);
      } else if (!actingCombatant.ability?.includes('Magic Guard')) {
        const amount = Math.max(1, Math.floor(details.attackerMaxHp / effect.divisor));
        const current = actingHp.max === 0
          ? createHpRange(details.attackerMaxHp, details.attackerMaxHp)
          : actingHp;
        hpById.set(activeEntry.id, createHpRange(current.min - amount, certain ? current.max - amount : current.max));
        stepEvents.push(`${activeEntry.label}: lost ${amount} HP to ${berryName}`);
      }
      applyCheekPouch(targetEntry, certain);
    }

    eatHpBerry(targetEntry);
    if (hitBerry?.effect.kind === 'recoil') eatHpBerry(activeEntry);
    if (isAttackerAction) {
      attackerHp = getHp(activeEntry);
      defenderHp = getHp(targetEntry);
    } else {
      attackerHp = getHp(targetEntry);
      defenderHp = getHp(activeEntry);
    }
    const inflicted = getInflictedStatus(
      generation,
      action.move.name,
      targetCombatant.types,
      statusById.get(targetEntry.id),
    );
    if (inflicted) {
      statusById.set(targetEntry.id, inflicted);
      toxicCounterById.set(targetEntry.id, 0);
      const cureItem = heldItem(targetEntry);
      if (canEat(targetEntry) && curesStatus(cureItem, inflicted)) {
        statusById.set(targetEntry.id, undefined);
        markConsumed(targetEntry, true);
        stepEvents.push(`${targetEntry.label}: ${cureItem} cured ${inflicted}`);
        applyCheekPouch(targetEntry, true);
      }
    }
    if (inflictsConfusion(action.move.name, targetCombatant.ability)) {
      const cureItem = heldItem(targetEntry);
      if (canEat(targetEntry) && curesConfusion(cureItem)) {
        markConsumed(targetEntry, true);
        stepEvents.push(`${targetEntry.label}: ${cureItem} cured confusion`);
        applyCheekPouch(targetEntry, true);
      }
    }
    attackerHp = getHp(getActiveEntry('attacker')!);
    defenderHp = getHp(getActiveEntry('defender')!);
    const finalTargetHp = getHp(targetEntry);

    return {
      action,
      damage,
      cumulativeDamage,
      attackerHp,
      defenderHp,
      targetHp: finalTargetHp,
      targetMaxHp: details.defenderMaxHp,
      isKo: nextTargetHp.max === 0,
      canKo: nextTargetHp.min === 0 && nextTargetHp.max > 0,
      activePokemonId: activeEntry.id,
      activePokemonLabel: activeEntry.label,
    };
  };

  return actions.map((action) => {
    stepEvents = [];
    const step = resolve(action);
    return {
      ...step,
      itemEvents: stepEvents,
      field: currentField,
      statuses: Object.fromEntries(statusById),
      items: Object.fromEntries(
        [...rosters.attacker, ...rosters.defender]
          .filter((entry) => entry.combatant.item)
          .map((entry) => [
            entry.id,
            consumedItems.has(entry.id) ? 'consumed' : maybeConsumedItems.has(entry.id) ? 'maybe-consumed' : 'held',
          ]),
      ),
      unburdenActive: Object.fromEntries(
        [...rosters.attacker, ...rosters.defender]
          .filter((entry) => entry.combatant.ability === 'Unburden')
          .map((entry) => [entry.id, unburdenActive.has(entry.id)]),
      ),
      boosts: Object.fromEntries(Array.from(boostsById, ([id, value]) => [id, { ...value }])),
      maxHp: {
        attacker: maxHpById.get(activeIds.attacker) ?? 0,
        defender: maxHpById.get(activeIds.defender) ?? 0,
      },
    };
  });
}