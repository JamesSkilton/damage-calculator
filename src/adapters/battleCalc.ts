import type {
  BattleCombatant,
  BattleField,
  BattleGeneration,
  BattleMove,
} from 'domain/index';
import { normalizeCalcResult } from 'adapters/calcResult';
import { calculateBattleRuntime } from 'calc-runtime';

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

function getMoveToggle(
  move: BattleCalcMoveInput | BattleMove,
  key: 'useZ' | 'useMax',
): boolean {
  const input = move as Partial<BattleCalcMoveInput>;
  return key === 'useZ'
    ? Boolean(input.useZ ?? move.isZ)
    : Boolean(input.useMax ?? move.isMax);
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

function createRuntimeMove(
  generation: BattleGeneration,
  move: BattleCalcMoveInput | BattleMove,
): BattleMove {
  const source = move as Partial<BattleMove>;

  return {
    generation,
    name: move.name,
    basePower: source.basePower ?? 0,
    type: source.type ?? 'Normal',
    category: source.category ?? 'Status',
    flags: source.flags ?? {},
    target: source.target ?? 'any',
    priority: source.priority ?? 0,
    hits: move.hits || 1,
    isCrit: !!move.isCrit,
    isZ: getMoveToggle(move, 'useZ'),
    isMax: getMoveToggle(move, 'useMax'),
    isStellarFirstUse: !!move.isStellarFirstUse,
    timesUsed: move.timesUsed || 1,
    timesUsedWithMetronome: move.timesUsedWithMetronome,
    hasCrashDamage: source.hasCrashDamage ?? false,
    mindBlownRecoil: source.mindBlownRecoil ?? false,
    struggleRecoil: source.struggleRecoil ?? false,
    breaksProtect: source.breaksProtect ?? false,
    ignoreDefensive: source.ignoreDefensive ?? false,
    multiaccuracy: source.multiaccuracy ?? false,
    recoil: source.recoil,
    drain: source.drain,
    secondaries: source.secondaries,
    self: source.self,
  };
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
  move: BattleCalcMoveInput | BattleMove;
}) {
  return normalizeCalcResult(
    calculateBattleRuntime({
      generation,
      attacker,
      defender,
      move: createRuntimeMove(generation, move),
      field,
    }),
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
