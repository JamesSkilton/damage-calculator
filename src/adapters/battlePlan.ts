import type {
  BattlePlanAction,
  BattlePlanActor,
  BattlePlanResidual,
  BattlePlanInput,
  BattlePlanStepResult,
  BattlePlanHpRange,
  BattlePlanHealing,
  BattlePlanRosterEntry,
} from 'domain/battlePlan';
import type { BattleStatBoosts, BattleStatusName } from 'domain/shared';
import { calculateEndOfTurnResidual, isBattleGrounded, type EndOfTurnResidual } from 'calc-runtime';
import { buildBattleCalcBreakdowns } from './battleCalc';
import { getInflictedStatus, inflictsConfusion } from './moveStatus';
import { canEatBerry, curesConfusion, curesStatus, getHitBerry, getHpBerry } from './berries';
import { getBerryResistType, getFlingPower } from 'calc-runtime/core/items';
import { Generations } from 'calc-runtime/core/data';
import { toID } from 'calc-runtime/core/util';

const partialTrappingMoves = new Set([
  'Bind', 'Clamp', 'Fire Spin', 'Infestation', 'Magma Storm', 'Sand Tomb',
  'Snap Trap', 'Thunder Cage', 'Whirlpool', 'Wrap',
]);

export function replaceActivePokemonInPlanSegment(
  actions: readonly BattlePlanAction[],
  actor: BattlePlanActor,
  initialPokemonId: string,
  replacementPokemonId: string,
): BattlePlanAction[] {
  const lastSwitchIndex = actions.reduce(
    (last, action, index) =>
      action.actor === actor && action.type === 'switch' ? index : last,
    -1,
  );
  const firstIndex = lastSwitchIndex >= 0 ? lastSwitchIndex + 1 : 0;
  const lastSwitch = lastSwitchIndex >= 0 ? actions[lastSwitchIndex] : undefined;
  const switchPokemonId =
    lastSwitch?.type === 'switch'
      ? lastSwitch.targetPokemonId
      : initialPokemonId;
  let currentPokemonId = switchPokemonId;

  for (let index = firstIndex; index < actions.length; index++) {
    const action = actions[index];
    if (action.actor === actor && action.type === 'move') {
      currentPokemonId = action.pokemonId ?? currentPokemonId;
    }
  }

  const next = [...actions];
  const replaceSwitchTarget =
    lastSwitch?.type === 'switch' &&
    lastSwitch.targetPokemonId === currentPokemonId;

  if (replaceSwitchTarget && lastSwitch?.type === 'switch') {
    next[lastSwitchIndex] = {
      ...lastSwitch,
      targetPokemonId: replacementPokemonId,
    };
  }

  let activePokemonId = switchPokemonId;
  for (let index = firstIndex; index < next.length; index++) {
    const action = next[index];
    if (action.actor !== actor || action.type !== 'move') continue;

    const actionPokemonId = action.pokemonId ?? activePokemonId;
    if (
      actionPokemonId === currentPokemonId ||
      (actionPokemonId === replacementPokemonId &&
        activePokemonId === replacementPokemonId)
    ) {
      next[index] = { ...action, pokemonId: replacementPokemonId };
      activePokemonId = replacementPokemonId;
    } else {
      activePokemonId = actionPokemonId;
    }
  }

  return next;
}

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
  // Keep the still-held outcomes separate so a previous heal cannot trigger again.
  const unconsumedHp = new Map<string, { alive?: BattlePlanHpRange; fainted: boolean }>();
  const flinchedIds = new Set<string>();
  const traps = new Map<string, {
    sourceId: string;
    move: string;
    minTurns: number;
    maxTurns: number;
  }>();
  const clearTrapsOnSwitch = (id: string) => {
    traps.delete(id);
    for (const [targetId, trap] of traps) {
      if (trap.sourceId === id) traps.delete(targetId);
    }
  };
  const eatenBerries = new Set<string>();
  const maybeEatenBerries = new Set<string>();
  const recyclableItems = new Map<string, string>();
  const items = Generations.get(generation)?.items;
  const unburdenActive = new Set(
    [...rosters.attacker, ...rosters.defender]
      .filter((entry) => (entry.id === activeIds.attacker || entry.id === activeIds.defender) &&
        entry.combatant.ability === 'Unburden' && entry.combatant.abilityOn)
      .map((entry) => entry.id),
  );
  let stepEvents: string[] = [];
  let stepHealing: BattlePlanHealing[] = [];
  const maxHpById = new Map<string, number>();
  for (const entry of [...rosters.attacker, ...rosters.defender]) {
    hpById.set(entry.id, createHpRange(entry.combatant.currentHp, entry.combatant.currentHp));
  }
  const getActiveEntry = (actor: 'attacker' | 'defender') =>
    rosters[actor].find((entry) => entry.id === activeIds[actor]);
  const getHp = (entry: BattlePlanRosterEntry) =>
    hpById.get(entry.id) ?? createHpRange(entry.combatant.currentHp, entry.combatant.currentHp);
  const updateUnconsumedHp = (
    entry: BattlePlanRosterEntry,
    update: (hp: BattlePlanHpRange) => BattlePlanHpRange,
  ) => {
    const state = unconsumedHp.get(entry.id);
    if (!state?.alive) return;
    const next = update(state.alive);
    unconsumedHp.set(entry.id, {
      alive: next.max > 0 ? createHpRange(Math.max(1, next.min), next.max) : undefined,
      fainted: state.fainted || next.min === 0,
    });
  };

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
  const isBerry = (item: string | undefined) =>
    Boolean(item && items?.get(toID(item))?.isBerry);
  const sideOf = (entry: BattlePlanRosterEntry): BattlePlanActor =>
    rosters.attacker.some((candidate) => candidate.id === entry.id) ? 'attacker' : 'defender';
  const canEat = (entry: BattlePlanRosterEntry) => {
    const opponent = getActiveEntry(sideOf(entry) === 'attacker' ? 'defender' : 'attacker');
    return canEatBerry(entry.combatant.ability, opponent?.combatant.ability);
  };
  const markConsumed = (
    entry: BattlePlanRosterEntry,
    certain: boolean,
    eater: BattlePlanRosterEntry | null = entry,
    eaterCertain = certain,
  ) => {
    const item = heldItem(entry);
    if (item) recyclableItems.set(entry.id, item);
    if (item && isBerry(item) && eater) {
      if (eaterCertain) {
        eatenBerries.add(eater.id);
        maybeEatenBerries.delete(eater.id);
      } else if (!eatenBerries.has(eater.id)) {
        maybeEatenBerries.add(eater.id);
      }
    }
    if (certain) {
      consumedItems.add(entry.id);
      maybeConsumedItems.delete(entry.id);
      unconsumedHp.delete(entry.id);
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
      stepHealing.push({ pokemonId: entry.id, source: 'Cheek Pouch', amount: { min, max } });
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

  const applyEatenBerry = (item: string, eater: BattlePlanRosterEntry, certain = true) => {
    stepEvents.push(`${eater.label}: ${certain ? 'ate' : 'possibly ate'} ${item}`);
    const berry = getHpBerry(item, generation, eater.combatant.ability);
    const effect = berry?.effect;
    const maxHp = maxHpById.get(eater.id) ?? 0;
    const hp = getHp(eater);
    if (effect?.kind === 'heal' && maxHp > 0) {
      const candidates = [hp.min, hp.max, 1]
        .filter((value) => value >= hp.min && value <= hp.max);
      const heal = (value: number) => value > 0
        ? Math.min(maxHp - value, effect.amount(maxHp))
        : 0;
      const healed = candidates.map((value) => value + (certain ? heal(value) : 0));
      const possibleHealed = candidates.map((value) => value + heal(value));
      hpById.set(
        eater.id,
        createHpRange(
          Math.min(...(certain ? healed : candidates)),
          Math.max(...possibleHealed),
        ),
      );
      const minHeal = certain ? Math.min(...candidates.map(heal)) : 0;
      const maxHeal = Math.max(...candidates.map(heal));
      if (maxHeal > 0) {
        stepEvents.push(`${eater.label}: ${item} restored ${maxHeal === minHeal ? maxHeal : `${minHeal}-${maxHeal}`} HP`);
        stepHealing.push({ pokemonId: eater.id, source: item, amount: { min: minHeal, max: maxHeal } });
      }
    } else if (effect?.kind === 'boost') {
      if (certain) boostStat(eater, effect.stat, effect.stages);
      stepEvents.push(`${eater.label}: ${item} ${certain ? 'raised' : 'may raise'} ${effect.stat.toUpperCase()} ${signed(effect.stages)}`);
    } else if (effect?.kind === 'random-boost') {
      stepEvents.push(`${eater.label}: ${item} sharply raised a random stat`);
    }

    const status = statusById.get(eater.id);
    if (status && curesStatus(item, status)) {
      if (certain) {
        statusById.set(eater.id, undefined);
        toxicCounterById.set(eater.id, 0);
      }
      stepEvents.push(`${eater.label}: ${item} ${certain ? 'cured' : 'may cure'} ${status}`);
    }
    applyCheekPouch(eater, certain);
  };

  /** Consumes the active Pokémon's low-HP item if its HP is at or below its threshold. Returns the HP healed. */
  const eatHpBerry = (entry: BattlePlanRosterEntry): number => {
    const item = heldItem(entry);
    const berry = getHpBerry(item, generation, entry.combatant.ability);
    const maxHp = maxHpById.get(entry.id) ?? 0;
    const hp = getHp(entry);
    if (!item || !berry || maxHp <= 0 || hp.max <= 0) return 0;
    if (item === 'Berry Juice'
      ? entry.combatant.ability === 'Klutz' || currentField.isMagicRoom
      : !canEat(entry)) return 0;

    const triggers = (value: number) => value > 0 && value <= maxHp * berry.threshold;
    const previous = unconsumedHp.get(entry.id);
    const eligible = previous ? previous.alive : hp;
    if (!eligible || !triggers(Math.max(1, eligible.min))) return 0;
    const wasMaybe = maybeConsumedItems.has(entry.id);
    const certain = hp.min > 0 && eligible.min > 0 && triggers(eligible.max) && !previous?.fainted;
    const label = certain && !wasMaybe ? item : `${item} (possibly)`;
    const threshold = Math.floor(maxHp * berry.threshold);
    const remaining = {
      alive: eligible.max > threshold
        ? createHpRange(Math.max(eligible.min, threshold + 1), eligible.max)
        : undefined,
      fainted: previous?.fainted ?? eligible.min === 0,
    };
    markConsumed(entry, certain);
    if (!certain) unconsumedHp.set(entry.id, remaining);

    const { effect } = berry;
    if (effect.kind === 'heal') {
      const candidates = [eligible.min, eligible.max, 1, threshold, threshold + 1]
        .filter((value) => value >= eligible.min && value <= eligible.max);
      const gain = (value: number) => triggers(value) ? Math.min(maxHp - value, effect.amount(maxHp)) : 0;
      const pouchGain = (value: number) => isBerry(item) && entry.combatant.ability === 'Cheek Pouch' && triggers(value)
        ? Math.min(maxHp - value - gain(value), Math.max(1, Math.floor(maxHp / 3)))
        : 0;
      const healedHp = candidates.map((value) => value + gain(value) + pouchGain(value));
      const gains = candidates.map(gain);
      hpById.set(entry.id, createHpRange(
        Math.min(...healedHp, ...(wasMaybe ? [hp.min] : [])),
        Math.max(...healedHp, ...(wasMaybe ? [hp.max] : [])),
      ));
      const healMin = wasMaybe ? 0 : Math.min(...gains);
      const healMax = Math.max(...gains);
      stepEvents.push(`${entry.label}: ${label} restored ${healMax === healMin ? healMax : `${healMin}-${healMax}`} HP`);
      if (healMax > 0) {
        stepHealing.push({
          pokemonId: entry.id,
          source: item,
          amount: { min: healMin, max: healMax },
        });
      }
      recordCheekPouch(entry, certain && !wasMaybe, [...(wasMaybe ? [0] : []), ...candidates.map(pouchGain)]);
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

  const resolve = (action: BattlePlanAction): Omit<BattlePlanStepResult, 'field' | 'statuses' | 'items' | 'eatenBerries' | 'unburdenActive' | 'boosts' | 'maxHp' | 'itemEvents' | 'healing'> => {
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

    if (action.type === 'end-turn' && action.replacement) {
      flinchedIds.clear();
      return {
        action,
        damage: createHpRange(0, 0),
        cumulativeDamage,
        attackerHp,
        defenderHp,
        targetHp: defenderHp,
        targetMaxHp: maxHpById.get(getActiveEntry('defender')!.id) ?? 0,
        isKo: false,
        activePokemonId: activeEntry.id,
        activePokemonLabel: activeEntry.label,
      };
    }

    if (action.type === 'end-turn') {
      flinchedIds.clear();
      const residual = {} as Record<BattlePlanActor, BattlePlanResidual>;
      const seedParts: Partial<Record<BattlePlanActor, BattlePlanResidual['parts']>> = {};
      for (const side of ['attacker', 'defender'] as const) {
        const entry = getActiveEntry(side)!;
        if (!maxHpById.has(entry.id)) {
          try {
            const maxHp = calculateEndOfTurnResidual({
              generation, combatant: entry.combatant, field: currentField, toxicCounter: 0,
            }).maxHp;
            maxHpById.set(entry.id, maxHp);
            if (getHp(entry).max === 0) hpById.set(entry.id, createHpRange(maxHp, maxHp));
          } catch (error) {
            return {
              action, damage: createHpRange(0, 0), cumulativeDamage, attackerHp, defenderHp,
              targetHp: defenderHp, targetMaxHp: 0, isKo: false,
              error: `Unable to determine HP for ${entry.label}: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        }
      }
      for (const side of ['attacker', 'defender'] as const) {
        const other = side === 'attacker' ? 'defender' : 'attacker';
        const seeded = getActiveEntry(side)!;
        const recipient = getActiveEntry(other)!;
        const condition = side === 'attacker' ? currentField.attackerSide : currentField.defenderSide;
        const seededHp = getHp(seeded);
        const recipientHp = getHp(recipient);
        if (!condition.isSeeded || seededHp.max === 0 || seeded.combatant.ability === 'Magic Guard') continue;
        const amount = Math.max(1, Math.floor(maxHpById.get(seeded.id)! / (generation === 1 ? 16 : 8)));
        const loss = { min: Math.min(amount, seededHp.min), max: Math.min(amount, seededHp.max) };
        hpById.set(seeded.id, createHpRange(seededHp.min - amount, seededHp.max - amount));
        updateUnconsumedHp(seeded, (hp) => createHpRange(hp.min - amount, hp.max - amount));
        (seedParts[side] ??= []).push({ source: 'Leech Seed', amount: loss.max });
        const bigRoot = heldItem(recipient) === 'Big Root' && recipient.combatant.ability !== 'Klutz' && !currentField.isMagicRoom;
        const gain = (value: number) => bigRoot ? Math.floor(value * 5324 / 4096) : value;
        const minGain = recipientHp.min > 0 ? gain(loss.min) : 0;
        const maxGain = recipientHp.max > 0 ? gain(loss.max) : 0;
        if (seeded.combatant.ability === 'Liquid Ooze') {
          if (recipient.combatant.ability !== 'Magic Guard') {
            hpById.set(recipient.id, createHpRange(recipientHp.min - maxGain, recipientHp.max - minGain));
            updateUnconsumedHp(recipient, (hp) => createHpRange(hp.min - maxGain, hp.max - minGain));
            (seedParts[other] ??= []).push({ source: 'Liquid Ooze', amount: maxGain });
          }
        } else {
          const maxHp = maxHpById.get(recipient.id)!;
          hpById.set(recipient.id, createHpRange(
            recipientHp.min > 0 ? Math.min(maxHp, recipientHp.min + minGain) : 0,
            Math.min(maxHp, recipientHp.max + maxGain),
          ));
          updateUnconsumedHp(recipient, (hp) => createHpRange(
            Math.min(maxHp, hp.min + minGain),
            Math.min(maxHp, hp.max + maxGain),
          ));
          const healed = {
            min: Math.min(minGain, maxHp - recipientHp.max),
            max: Math.min(maxGain, maxHp - recipientHp.min),
          };
          if (healed.max > 0 || healed.min > 0) {
            stepHealing.push({ pokemonId: recipient.id, source: 'Leech Seed', amount: healed });
          }
          (seedParts[other] ??= []).push({ source: 'Leech Seed recovery', amount: -maxGain });
        }
      }
      for (const side of ['attacker', 'defender'] as const) {
        const entry = getActiveEntry(side);
        if (!entry) continue;
        let hp = getHp(entry);
        let tick: EndOfTurnResidual = { maxHp: maxHpById.get(entry.id) ?? 0, damage: 0, sources: [], parts: [] };
        if (hp.max > 0) {
          const trap = traps.get(entry.id);
          if (trap) {
            const source = getActiveEntry(side === 'attacker' ? 'defender' : 'attacker');
            if (!source || source.id !== trap.sourceId || getHp(source).max === 0) {
              traps.delete(entry.id);
            } else {
              if (getHp(source).min === 0) trap.minTurns = 0;
              if (entry.combatant.ability !== 'Magic Guard') {
                const bindingBand = heldItem(source) === 'Binding Band' &&
                  source.combatant.ability !== 'Klutz' && !currentField.isMagicRoom;
                const divisor = generation > 5 ? (bindingBand ? 6 : 8) : (bindingBand ? 8 : 16);
                const amount = Math.max(1, Math.floor(maxHpById.get(entry.id)! / divisor));
                const certain = trap.minTurns > 0;
                hpById.set(entry.id, createHpRange(hp.min - amount, hp.max - (certain ? amount : 0)));
                updateUnconsumedHp(entry, (heldHp) =>
                  createHpRange(heldHp.min - amount, heldHp.max - (certain ? amount : 0)));
                (seedParts[side] ??= []).push({
                  source: certain ? trap.move : `${trap.move} (possibly)`,
                  amount,
                });
                hp = getHp(entry);
              }
              trap.minTurns--;
              trap.maxTurns--;
              if (trap.maxTurns <= 0) traps.delete(entry.id);
            }
          }
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
          const apply = (value: number) => value > 0 ? Math.min(tick.maxHp, Math.max(0, value - tick.damage)) : 0;
          const next = createHpRange(apply(hp.min), apply(hp.max));
          hpById.set(entry.id, next);
          updateUnconsumedHp(entry, (heldHp) => createHpRange(apply(heldHp.min), apply(heldHp.max)));
          if (tick.parts.every((part) => part.amount < 0)) {
            let recoveryHp = hp;
            for (const part of tick.parts) {
              const amount = {
                min: recoveryHp.min > 0 ? Math.max(0, Math.min(-part.amount, tick.maxHp - recoveryHp.max)) : 0,
                max: Math.max(0, Math.min(-part.amount, tick.maxHp - recoveryHp.min)),
              };
              if (amount.max > 0) {
                stepHealing.push({ pokemonId: entry.id, source: part.source, amount });
              }
              recoveryHp = createHpRange(
                recoveryHp.min > 0 ? Math.min(tick.maxHp, recoveryHp.min - part.amount) : 0,
                Math.min(tick.maxHp, recoveryHp.max - part.amount),
              );
            }
          }
          const healed = eatHpBerry(entry);
          if (healed > 0) {
            tick.parts = [...tick.parts, { source: entry.combatant.item!, amount: -healed, berry: isBerry(entry.combatant.item) }];
            tick.sources = [...tick.sources, entry.combatant.item!];
          }
        }
        const seededParts = seedParts[side] ?? [];
        residual[side] = {
          label: entry.label,
          damage: tick.damage + seededParts.reduce((sum, part) => sum + part.amount, 0),
          maxHp: tick.maxHp || maxHpById.get(entry.id) || 0,
          sources: [...seededParts.map((part) => part.source), ...tick.sources],
          parts: [...seededParts, ...tick.parts],
        };
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
        const heldState = unconsumedHp.get(activeEntry.id);
        if (heldState) {
          unconsumedHp.set(activeEntry.id, {
            alive: hp > 0 ? createHpRange(hp, hp) : undefined,
            fainted: hp === 0,
          });
        }
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
      if (!maxHpById.has(nextEntry.id)) {
        try {
          const hp = calculateEndOfTurnResidual({
            generation,
            combatant: nextEntry.combatant,
            field: currentField,
            toxicCounter: 0,
          }).maxHp;
          maxHpById.set(nextEntry.id, hp);
          if (hpById.get(nextEntry.id)?.max === 0) {
            hpById.set(nextEntry.id, createHpRange(hp, hp));
          }
        } catch (error) {
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
            error: `Unable to determine HP for switch target ${nextEntry.id}: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }
      flinchedIds.delete(activeEntry.id);
      clearTrapsOnSwitch(activeEntry.id);
      hpById.set(activeEntry.id, getHp(activeEntry));
      toxicCounterById.set(activeEntry.id, 0);
      boostsById.set(activeEntry.id, { ...activeEntry.combatant.boosts });
      unburdenActive.delete(activeEntry.id);
      const sideKey = actor === 'attacker' ? 'attackerSide' : 'defenderSide';
      currentField = { ...currentField, [sideKey]: { ...currentField[sideKey], isSeeded: false } };
      activeIds[actor] = nextEntry.id;
      const incoming = liveCombatant(nextEntry, getHp(nextEntry));
      const itemActive = !currentField.isMagicRoom && incoming.ability !== 'Klutz';
      if (
        generation >= 6 &&
        nextEntry.id !== activeEntry.id &&
        currentField[sideKey].isStickyWeb &&
        !(generation >= 8 && itemActive && incoming.item === 'Heavy-Duty Boots') &&
        isBattleGrounded({ generation, combatant: incoming, field: currentField })
      ) {
        const ability = incoming.ability;
        const blocked = ['Clear Body', 'White Smoke', 'Full Metal Body'].includes(ability ?? '') ||
          (ability === 'Flower Veil' && incoming.types.includes('Grass')) ||
          (generation >= 9 && itemActive && incoming.item === 'Clear Amulet');
        if (!blocked || ability === 'Contrary') {
          const stages = ability === 'Contrary' ? 1 : ability === 'Simple' ? -2 : -1;
          const previous = getBoosts(nextEntry).spe ?? 0;
          boostStat(nextEntry, 'spe', stages);
          const change = (getBoosts(nextEntry).spe ?? 0) - previous;
          if (change !== 0) {
            stepEvents.push(`${nextEntry.label}: Sticky Web changed Speed ${signed(change)}`);
            if (change < 0 && ability === 'Defiant') boostStat(nextEntry, 'atk', 2);
            if (change < 0 && ability === 'Competitive') boostStat(nextEntry, 'spa', 2);
            if (change < 0 && itemActive && incoming.item === 'White Herb') {
              const restored = { ...getBoosts(nextEntry) };
              for (const stat of Object.keys(restored) as (keyof BattleStatBoosts)[]) {
                if ((restored[stat] ?? 0) < 0) restored[stat] = 0;
              }
              boostsById.set(nextEntry.id, restored);
              markConsumed(nextEntry, true);
              stepEvents.push(`${nextEntry.label}: White Herb restored lowered stats`);
            }
          }
        }
      }
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

    if (maxHpById.has(activeEntry.id) && actingHp.max === 0) {
      return {
        action: { ...action, move: { ...action.move, skipped: true } },
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

    const activeItem = heldItem(activeEntry);
    const moveFailure =
      action.move.name === 'Belch' &&
      !eatenBerries.has(activeEntry.id) &&
      !maybeEatenBerries.has(activeEntry.id)
        ? 'Belch failed because no Berry has been eaten'
        : action.move.name === 'Natural Gift' && !isBerry(activeItem)
          ? 'Natural Gift failed because no Berry is held'
          : action.move.name === 'Stuff Cheeks' &&
              (!isBerry(activeItem) || !canEat(activeEntry))
            ? 'Stuff Cheeks failed because the user cannot eat a held Berry'
            : action.move.name === 'Fling' &&
                (!activeItem || getFlingPower(activeItem, generation) === 0)
              ? 'Fling failed because the held item cannot be thrown'
              : action.move.name === 'Recycle' &&
                  (!recyclableItems.has(activeEntry.id) ||
                    (activeItem && !maybeConsumedItems.has(activeEntry.id)))
                ? 'Recycle failed because there is no consumed item to restore'
                : undefined;
    const wasFlinched = flinchedIds.delete(activeEntry.id);
    if (action.move.skipped || moveFailure || wasFlinched) {
      if (wasFlinched) {
        stepEvents.push(`${activeEntry.label}: flinched and could not move`);
      } else if (!action.move.skipped && moveFailure) {
        stepEvents.push(`${activeEntry.label}: ${moveFailure}`);
      }
      // No damage calc runs for these moves, so probe once to learn each side's max HP.
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
        action: wasFlinched
          ? { ...action, move: { ...action.move, skipped: true } }
          : action,
        flinched: wasFlinched || undefined,
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
    const belchMayFail =
      action.move.name === 'Belch' && maybeEatenBerries.has(activeEntry.id);
    if (belchMayFail) {
      stepEvents.push(`${activeEntry.label}: Belch may fail because the Berry may not have been eaten`);
    }
    const itemMoveMayFail =
      maybeConsumedItems.has(activeEntry.id) &&
      (action.move.name === 'Natural Gift' || action.move.name === 'Fling');
    if (itemMoveMayFail) {
      stepEvents.push(`${activeEntry.label}: ${action.move.name} may fail because the item may already be consumed`);
    }
    const resolvedTargetHp =
      targetHp.max === 0
        ? createHpRange(details.defenderCurrentHp, details.defenderCurrentHp)
        : targetHp;

    const damage = createHpRange(
      belchMayFail || itemMoveMayFail ? 0 : details.possibleDamage[0] ?? 0,
      details.possibleDamage[details.possibleDamage.length - 1] ?? 0,
    );
    hpById.set(targetEntry.id, resolvedTargetHp);
    maxHpById.set(targetEntry.id, details.defenderMaxHp);
    if (!maxHpById.has(activeEntry.id)) {
      maxHpById.set(activeEntry.id, details.attackerMaxHp);
      // An unset (0) HP means full health; resolve it so it isn't mistaken for a KO.
      if (getHp(activeEntry).max === 0) {
        hpById.set(activeEntry.id, createHpRange(details.attackerMaxHp, details.attackerMaxHp));
      }
    }

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
    updateUnconsumedHp(targetEntry, (hp) => createHpRange(hp.min - damage.max, hp.max - damage.min));
    if (
      generation !== 1 && partialTrappingMoves.has(action.move.name) &&
      !action.move.useZ && !action.move.useMax && damage.max > 0 &&
      nextTargetHp.max > 0 && !traps.has(targetEntry.id)
    ) {
      const gripClaw = heldItem(activeEntry) === 'Grip Claw' &&
        actingCombatant.ability !== 'Klutz' && !currentField.isMagicRoom;
      const minTurns = gripClaw ? (generation >= 5 ? 7 : 5) : (generation >= 5 ? 4 : 2);
      const maxTurns = gripClaw ? minTurns : 5;
      traps.set(targetEntry.id, {
        sourceId: activeEntry.id,
        move: action.move.name,
        minTurns: damage.min > 0 ? minTurns : 0,
        maxTurns,
      });
    }
    if (
      action.move.name === 'Fake Out' &&
      generation >= 3 &&
      damage.max > 0 &&
      nextTargetHp.max > 0 &&
      !['Inner Focus', 'Shield Dust'].includes(targetCombatant.ability ?? '')
    ) {
      flinchedIds.add(targetEntry.id);
    }
    if (details.drain && damage.max > 0) {
      const [numerator, denominator] = details.drain;
      const bigRoot = heldItem(activeEntry) === 'Big Root' && actingCombatant.ability !== 'Klutz' && !currentField.isMagicRoom;
      const drain = (dealt: number) => {
        if (dealt <= 0) return 0;
        const amount = Math.max(1, Math.round(dealt * numerator / denominator));
        return bigRoot ? Math.floor(amount * 5324 / 4096) : amount;
      };
      const totalDrain = (bound: 'min' | 'max', hp: number) => {
        let remaining = hp;
        let total = 0;
        const hits = details.drainHitDamage ?? [damage];
        for (const hit of hits) {
          const dealt = Math.min(hit[bound], remaining);
          total += drain(dealt);
          remaining -= dealt;
        }
        return total;
      };
      const minDrain = damage.min === 0 ? 0 : totalDrain('min', hpBeforeDamage.min);
      const maxDrain = totalDrain('max', hpBeforeDamage.max);
      const current = getHp(activeEntry);
      if (targetCombatant.ability === 'Liquid Ooze') {
        if (actingCombatant.ability !== 'Magic Guard') {
          hpById.set(activeEntry.id, createHpRange(current.min - maxDrain, current.max - minDrain));
          updateUnconsumedHp(activeEntry, (hp) => createHpRange(hp.min - maxDrain, hp.max - minDrain));
          stepEvents.push(`${activeEntry.label}: hurt by Liquid Ooze`);
        }
      } else {
        const maxHp = details.attackerMaxHp;
        hpById.set(activeEntry.id, createHpRange(
          current.min > 0 ? Math.min(maxHp, current.min + minDrain) : 0,
          Math.min(maxHp, current.max + maxDrain),
        ));
        updateUnconsumedHp(activeEntry, (hp) => createHpRange(
          Math.min(maxHp, hp.min + minDrain),
          Math.min(maxHp, hp.max + maxDrain),
        ));
        const minHeal = current.min > 0 ? Math.min(minDrain, maxHp - current.max) : 0;
        const maxHeal = current.max > 0 ? Math.min(maxDrain, maxHp - current.min) : 0;
        if (maxHeal > 0) stepHealing.push({
          pokemonId: activeEntry.id, source: action.move.name, amount: { min: minHeal, max: maxHeal },
        });
      }
    }
    if (action.move.name === 'Leech Seed' && !targetCombatant.types.includes('Grass')) {
      const sideKey = targetActor === 'attacker' ? 'attackerSide' : 'defenderSide';
      if (!currentField[sideKey].isProtected && nextTargetHp.max > 0) {
        currentField = { ...currentField, [sideKey]: { ...currentField[sideKey], isSeeded: true } };
      }
    }
    if (action.move.name === 'Sticky Web' && generation >= 6) {
      const bounced = targetCombatant.ability === 'Magic Bounce' &&
        !['Mold Breaker', 'Teravolt', 'Turboblaze'].includes(actingCombatant.ability ?? '');
      const affectedActor = bounced ? actor : targetActor;
      const sideKey = affectedActor === 'attacker' ? 'attackerSide' : 'defenderSide';
      currentField = { ...currentField, [sideKey]: { ...currentField[sideKey], isStickyWeb: true } };
    }
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
    if (hitBerry && hitTriggers && targetItem) {
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
        const minHeal = certain ? Math.min(amount, details.defenderMaxHp - current.max) : 0;
        const maxHeal = Math.min(amount, details.defenderMaxHp - Math.max(1, current.min));
        hpById.set(
          targetEntry.id,
          createHpRange(
            Math.min(details.defenderMaxHp, current.min + (certain ? amount : 0)),
            Math.min(details.defenderMaxHp, current.max + amount),
          ),
        );
        stepEvents.push(`${targetEntry.label}: ${berryName} restored ${amount} HP`);
        if (maxHeal > 0) {
          stepHealing.push({ pokemonId: targetEntry.id, source: targetItem, amount: { min: minHeal, max: maxHeal } });
        }
      } else if (!actingCombatant.ability?.includes('Magic Guard')) {
        const amount = Math.max(1, Math.floor(details.attackerMaxHp / effect.divisor));
        const current = actingHp.max === 0
          ? createHpRange(details.attackerMaxHp, details.attackerMaxHp)
          : actingHp;
        hpById.set(activeEntry.id, createHpRange(current.min - amount, certain ? current.max - amount : current.max));
        updateUnconsumedHp(activeEntry, (hp) => createHpRange(hp.min - amount, certain ? hp.max - amount : hp.max));
        stepEvents.push(`${activeEntry.label}: lost ${amount} HP to ${berryName}`);
      }
      applyCheekPouch(targetEntry, certain);
    }

    if (action.move.name === 'Natural Gift' && activeItem && isBerry(activeItem)) {
      markConsumed(activeEntry, true, null);
      stepEvents.push(`${activeEntry.label}: Natural Gift consumed ${activeItem}`);
    } else if (action.move.name === 'Fling' && activeItem) {
      markConsumed(activeEntry, true, null);
      stepEvents.push(`${activeEntry.label}: Fling consumed ${activeItem}`);
    } else if (action.move.name === 'Stuff Cheeks') {
      const berry = heldItem(activeEntry);
      if (berry && isBerry(berry) && canEat(activeEntry)) {
        const effectCertain = !maybeConsumedItems.has(activeEntry.id);
        markConsumed(activeEntry, true, activeEntry, true);
        applyEatenBerry(berry, activeEntry, effectCertain);
        if (effectCertain) boostStat(activeEntry, 'def', 2);
        stepEvents.push(`${activeEntry.label}: Defense ${effectCertain ? 'rose' : 'may rise'} +2`);
      }
    } else if (action.move.name === 'Teatime') {
      for (const entry of [getActiveEntry('attacker'), getActiveEntry('defender')]) {
        if (!entry) continue;
        const berry = heldItem(entry);
        if (!berry || !isBerry(berry) || !canEat(entry)) continue;
        const effectCertain = !maybeConsumedItems.has(entry.id);
        markConsumed(entry, true);
        applyEatenBerry(berry, entry, effectCertain);
      }
    } else if (action.move.name === 'Bug Bite' || action.move.name === 'Pluck') {
      const berry = heldItem(targetEntry);
      if (berry && isBerry(berry) && canEat(activeEntry) && damage.max > 0) {
        const eaterCertain = !maybeConsumedItems.has(targetEntry.id);
        markConsumed(targetEntry, true, activeEntry, eaterCertain);
        stepEvents.push(`${targetEntry.label}: lost ${berry} to ${action.move.name}`);
        applyEatenBerry(berry, activeEntry, eaterCertain);
      }
    } else if (action.move.name === 'Recycle') {
      const item = recyclableItems.get(activeEntry.id);
      if (item) {
        consumedItems.delete(activeEntry.id);
        maybeConsumedItems.delete(activeEntry.id);
        unconsumedHp.delete(activeEntry.id);
        recyclableItems.delete(activeEntry.id);
        stepEvents.push(`${activeEntry.label}: recycled ${item}`);
      }
    }

    eatHpBerry(targetEntry);
    if (hitBerry?.effect.kind === 'recoil' || (details.drain && targetCombatant.ability === 'Liquid Ooze')) {
      eatHpBerry(activeEntry);
    }
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
    stepHealing = [];
    if (action.type === 'move' && action.pokemonId) {
      if (activeIds[action.actor] !== action.pokemonId) {
        clearTrapsOnSwitch(activeIds[action.actor]);
      }
      activeIds[action.actor] = action.pokemonId;
    }
    const step = resolve(action);
    return {
      ...step,
      itemEvents: stepEvents,
      healing: stepHealing,
      field: currentField,
      statuses: Object.fromEntries(statusById),
      eatenBerries: Object.fromEntries([
        ...[...eatenBerries].map((id) => [id, 'yes' as const] as const),
        ...[...maybeEatenBerries].map((id) => [id, 'maybe' as const] as const),
      ]),
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