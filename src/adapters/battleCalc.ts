import type {
  BattleCombatant,
  BattleField,
  BattleGeneration,
  BattleMove,
} from 'domain/index';
import { normalizeCalcResult } from 'adapters/calcResult';
import { calculateBattleRuntime } from 'calc-runtime';
import type { Result as CoreResult } from 'calc-runtime/core/result';

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

export interface BattleCalcKoBreakdownEntry {
  hits: number;
  label: string;
  /** Chance (0-1) that this attack KOs on exactly this hit count. */
  chance: number;
}

export interface BattleCalcDetails {
  percentRange: { min: number; max: number };
  averageDamage: number;
  averagePercent: number;
  possibleDamage: readonly number[];
  /** All raw damage rolls (including duplicates), sorted ascending. */
  allDamageRolls: readonly number[];
  /** Unique damage values paired with how many of the raw rolls produced them. */
  damageRollFrequency: readonly { damage: number; count: number }[];
  koBreakdown: readonly BattleCalcKoBreakdownEntry[];
  isCritOhko: boolean;
  /** Defender's max HP stat, for rendering damage against their HP bar. */
  defenderMaxHp: number;
  /** Defender's current HP (accounts for any prior damage/field state). */
  defenderCurrentHp: number;
}

export type BattleCalcBreakdown =
  | {
      slotIndex: number;
      label: string;
      result: ReturnType<typeof normalizeCalcResult>;
      details?: BattleCalcDetails;
      error?: never;
    }
  | {
      slotIndex: number;
      label: string;
      error: string;
      result?: never;
      details?: never;
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
  details: BattleCalcDetails | undefined,
  error: string | undefined,
): BattleCalcBreakdown {
  if (error) {
    return { slotIndex, label, error };
  }

  if (!result) {
    return { slotIndex, label, error: 'Result data is unavailable.' };
  }

  return { slotIndex, label, result, details };
}

/**
 * Flatten a raw calc-runtime damage roll set into a single list of possible
 * total damage values (summing per-hit rolls for multi-hit moves).
 */
function getDamageRolls(damage: CoreResult['damage']): number[] {
  if (typeof damage === 'number') {
    return [damage];
  }

  if (damage.length === 0) {
    return [0];
  }

  if (typeof damage[0] === 'number') {
    return damage as number[];
  }

  const hits = damage as number[][];
  const rollCount = Math.max(...hits.map((rolls) => rolls.length));
  const totals: number[] = [];

  for (let i = 0; i < rollCount; i++) {
    let total = 0;
    for (const rolls of hits) {
      total += rolls[i] ?? rolls[rolls.length - 1] ?? 0;
    }
    totals.push(total);
  }

  return totals.length > 0 ? totals : [0];
}

/**
 * Chance (0-1) that summing `hits` independent draws from `rolls` reaches
 * at least `hp`. Uses a small frequency-map convolution since `rolls` is
 * typically 16 equally-likely values and `hits` is capped at 4.
 */
function chanceToKoWithinHits(
  rolls: readonly number[],
  hits: number,
  hp: number,
): number {
  if (hp <= 0) {
    return 1;
  }

  let distribution = new Map<number, number>([[0, 1]]);

  for (let hit = 0; hit < hits; hit++) {
    const next = new Map<number, number>();

    for (const [sum, count] of distribution) {
      for (const roll of rolls) {
        const newSum = sum + roll;
        next.set(newSum, (next.get(newSum) ?? 0) + count);
      }
    }

    distribution = next;
  }

  let total = 0;
  let koCount = 0;

  for (const [sum, count] of distribution) {
    total += count;
    if (sum >= hp) {
      koCount += count;
    }
  }

  return total > 0 ? koCount / total : 0;
}

const KO_BREAKDOWN_HIT_COUNTS = [1, 2, 3, 4] as const;

/**
 * Compute additional derived details (percent range, average damage,
 * possible damage rolls, an approximate OHKO/2HKO/3HKO/4HKO chance table,
 * and a crit-OHKO flag) from a raw calc-runtime result.
 *
 * The KO breakdown is an approximation: it convolves the raw per-hit
 * damage roll distribution and does not account for end-of-turn effects,
 * hazards, or toxic counters the way the calculator's internal KO chance
 * logic does.
 */
function computeBattleCalcDetails({
  generation,
  attacker,
  defender,
  field,
  move,
  coreResult,
}: {
  generation: BattleGeneration;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  field: BattleField;
  move: BattleCalcMoveInput | BattleMove;
  coreResult: CoreResult;
}): BattleCalcDetails {
  const rolls = getDamageRolls(coreResult.damage);
  const maxHp = coreResult.defender.maxHP();
  const curHp = coreResult.defender.curHP();
  const [rangeMin, rangeMax] = coreResult.range();

  const toPercent = (value: number) => (maxHp > 0 ? (value / maxHp) * 100 : 0);

  const possibleDamage = Array.from(new Set(rolls)).sort((a, b) => a - b);
  const allDamageRolls = [...rolls].sort((a, b) => a - b);
  const damageRollFrequency = possibleDamage.map((damage) => ({
    damage,
    count: rolls.filter((roll) => roll === damage).length,
  }));
  const averageDamage =
    rolls.reduce((sum, roll) => sum + roll, 0) / rolls.length;

  const cumulativeKoChance = [0, ...KO_BREAKDOWN_HIT_COUNTS].map((hits) =>
    hits === 0 ? 0 : chanceToKoWithinHits(rolls, hits, curHp),
  );

  const koBreakdown: BattleCalcKoBreakdownEntry[] = KO_BREAKDOWN_HIT_COUNTS.map(
    (hits, index) => ({
      hits,
      label: hits === 1 ? 'OHKO' : `${hits}HKO`,
      chance: Math.max(
        0,
        cumulativeKoChance[index + 1] - cumulativeKoChance[index],
      ),
    }),
  );

  let isCritOhko = false;
  try {
    const critResult = runBattleCalc(generation, attacker, defender, field, {
      ...move,
      isCrit: true,
    } as BattleCalcMoveInput);
    isCritOhko = critResult.range()[0] >= curHp;
  } catch {
    isCritOhko = false;
  }

  return {
    percentRange: { min: toPercent(rangeMin), max: toPercent(rangeMax) },
    averageDamage,
    averagePercent: toPercent(averageDamage),
    possibleDamage,
    allDamageRolls,
    damageRollFrequency,
    koBreakdown,
    isCritOhko,
    defenderMaxHp: maxHp,
    defenderCurrentHp: curHp,
  };
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

function runBattleCalc(
  generation: BattleGeneration,
  attacker: BattleCombatant,
  defender: BattleCombatant,
  field: BattleField,
  move: BattleCalcMoveInput | BattleMove,
): CoreResult {
  return calculateBattleRuntime({
    generation,
    attacker,
    defender,
    move: createRuntimeMove(generation, move),
    field,
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
  move: BattleCalcMoveInput | BattleMove;
}) {
  return normalizeCalcResult(
    runBattleCalc(generation, attacker, defender, field, move),
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
      const coreResult = runBattleCalc(
        generation,
        attacker,
        defender,
        field,
        move,
      );

      breakdowns.push(
        createBattleCalcBreakdown(
          slotIndex,
          formatMoveLabel(move),
          normalizeCalcResult(coreResult),
          computeBattleCalcDetails({
            generation,
            attacker,
            defender,
            field,
            move,
            coreResult,
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
          undefined,
          error instanceof Error ? error.message : 'Unable to calculate',
        ),
      );
    }

    return breakdowns;
  }, []);
}
