import {
  calculate,
  Field,
  Generations,
  type LegacyMove,
  type LegacyPokemon,
  Move,
  Pokemon,
} from 'vendor/legacyCalcRuntime';
import type {
  BattleCombatant,
  BattleField,
  BattleGeneration,
} from 'domain/index';
import { normalizeCalcResult } from 'adapters/calcResult';

export interface BattleCalcMoveInput {
  name: string;
  isCrit: boolean;
  hits: number;
  useZ?: boolean;
  useMax?: boolean;
  isZ?: boolean;
  isMax?: boolean;
  isStellarFirstUse: boolean;
  timesUsed: number;
  timesUsedWithMetronome?: number;
}

export type BattleCalcBreakdown =
  | {
      slotIndex: number;
      label: string;
      result: ReturnType<typeof normalizeCalcResult>;
      error?: never;
    }
  | {
      slotIndex: number;
      label: string;
      error: string;
      result?: never;
    };

function getMoveToggle(move: BattleCalcMoveInput, key: 'useZ' | 'useMax'): boolean {
  return key === 'useZ'
    ? Boolean(move.useZ ?? move.isZ)
    : Boolean(move.useMax ?? move.isMax);
}

function createBattleCalcBreakdown(
  slotIndex: number,
  label: string,
  result: ReturnType<typeof normalizeCalcResult> | undefined,
  error: string | undefined,
): BattleCalcBreakdown {
  if (error) {
    return { slotIndex, label, error };
  }

  if (!result) {
    return { slotIndex, label, error: 'Result data is unavailable.' };
  }

  return { slotIndex, label, result };
}

function formatMoveLabel(move: BattleCalcMoveInput): string {
  const labels: string[] = [];
  const isZ = getMoveToggle(move, 'useZ');
  const isMax = getMoveToggle(move, 'useMax');

  if (move.isCrit) labels.push('Crit');
  if (isZ) labels.push('Z');
  if (isMax) labels.push('Max');
  if (move.isStellarFirstUse) labels.push('Stellar');
  if (move.hits > 1) labels.push(`${move.hits} hits`);
  if (move.timesUsed > 1) labels.push(`Used ${move.timesUsed}x`);

  return labels.length > 0 ? `${move.name} · ${labels.join(' · ')}` : move.name;
}

function createLegacyPokemon(
  generation: BattleGeneration,
  combatant: BattleCombatant,
): LegacyPokemon {
  const legacyGeneration = Generations.get(generation);

  return Pokemon(legacyGeneration, combatant.species, {
    name: combatant.name,
    level: combatant.level,
    ability: combatant.ability,
    abilityOn: combatant.abilityOn,
    isDynamaxed: combatant.isDynamaxed,
    dynamaxLevel: combatant.dynamaxLevel,
    item: combatant.item,
    gender: combatant.gender,
    nature: combatant.nature,
    ivs: combatant.ivs,
    evs: combatant.evs,
    boosts: combatant.boosts,
    curHP: combatant.currentHp,
    status: combatant.status ?? '',
    toxicCounter: combatant.toxicCounter,
    teraType: combatant.teratype,
    moves: [...combatant.moves],
  });
}

function createLegacyMove(
  generation: BattleGeneration,
  attacker: BattleCombatant,
  move: BattleCalcMoveInput,
): LegacyMove {
  const legacyGeneration = Generations.get(generation);

  return Move(legacyGeneration, move.name, {
    ability: attacker.ability,
    item: attacker.item,
    species: attacker.species,
    isCrit: move.isCrit,
    hits: move.hits,
    useZ: getMoveToggle(move, 'useZ'),
    useMax: getMoveToggle(move, 'useMax'),
    isStellarFirstUse: move.isStellarFirstUse,
    timesUsed: move.timesUsed,
    timesUsedWithMetronome: move.timesUsedWithMetronome,
  });
}

export function calculateBattleCalcResult({
  generation,
  attacker,
  defender,
  field,
  move,
}: {
  generation: BattleGeneration;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  field: BattleField;
  move: BattleCalcMoveInput;
}) {
  const legacyGeneration = Generations.get(generation);
  const legacyAttacker = createLegacyPokemon(generation, attacker);
  const legacyDefender = createLegacyPokemon(generation, defender);
  const legacyField = Field(field);
  const legacyMove = createLegacyMove(generation, attacker, move);

  return normalizeCalcResult(
    calculate(
      legacyGeneration,
      legacyAttacker,
      legacyDefender,
      legacyMove,
      legacyField,
    ),
  );
}

export function buildBattleCalcBreakdowns({
  generation,
  attacker,
  defender,
  field,
  moves,
}: {
  generation: BattleGeneration;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  field: BattleField;
  moves: readonly BattleCalcMoveInput[];
}): BattleCalcBreakdown[] {
  return moves.reduce<BattleCalcBreakdown[]>((breakdowns, move, slotIndex) => {
    if (!move.name.trim()) {
      return breakdowns;
    }

    try {
      breakdowns.push(
        createBattleCalcBreakdown(
          slotIndex,
          formatMoveLabel(move),
          calculateBattleCalcResult({
            generation,
            attacker,
            defender,
            field,
            move,
          }),
          undefined,
        ),
      );
    } catch (error) {
      breakdowns.push(
        createBattleCalcBreakdown(
          slotIndex,
          formatMoveLabel(move),
          undefined,
          error instanceof Error ? error.message : 'Unable to calculate',
        ),
      );
    }

    return breakdowns;
  }, []);
}
