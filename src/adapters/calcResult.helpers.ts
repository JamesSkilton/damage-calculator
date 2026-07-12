import {
  CALC_RESULT_DEFAULT_NOTATION,
  type CalcResultKoInput,
  type CalcResultLike,
  type CalcResultRangeInput,
  type NormalizedCalcResult,
  type NormalizedCalcResultRange,
} from 'adapters/calcResult.types';

function coerceRange(input: CalcResultRangeInput): NormalizedCalcResultRange {
  if (typeof input === 'number') {
    return { min: input, max: input };
  }

  if (Array.isArray(input)) {
    const [min, max] = input;
    return min <= max ? { min, max } : { min: max, max: min };
  }

  const { min, max } = input as Exclude<
    CalcResultRangeInput,
    number | readonly [number, number]
  >;

  return min <= max ? { min, max } : { min: max, max: min };
}

export function normalizeCalcResultRange(
  input: CalcResultRangeInput,
): NormalizedCalcResultRange {
  return coerceRange(input);
}

export function formatCalcResultRange(
  range: NormalizedCalcResultRange,
): string {
  return `${range.min} - ${range.max}`;
}

export function normalizeCalcResultKoText(input: CalcResultKoInput): string {
  if (typeof input === 'string') {
    return input.trim();
  }

  return input?.text?.trim() ?? '';
}

export function formatCalcResultSummary(
  summary: string | null | undefined,
): string {
  return summary?.trim() ?? '';
}

export function normalizeCalcResultSummary(
  fullDesc: string | null | undefined,
  summary: string | null | undefined,
): string {
  const normalizedFullDesc = formatCalcResultSummary(fullDesc);
  if (normalizedFullDesc) {
    return normalizedFullDesc;
  }

  return formatCalcResultSummary(summary);
}

export function normalizeCalcResult(
  result: CalcResultLike,
  notation = CALC_RESULT_DEFAULT_NOTATION,
): NormalizedCalcResult {
  const rangeInput = result.range?.() ?? result.damageRange;

  if (!rangeInput) {
    throw new Error('Result range is required.');
  }

  const range = normalizeCalcResultRange(rangeInput);
  const koChance = result.kochance?.(false);
  const koText = normalizeCalcResultKoText(
    koChance?.text?.trim() ? koChance : result.koText,
  );
  const summary = normalizeCalcResultSummary(
    result.fullDesc?.(notation, false),
    result.summary,
  );

  return {
    range,
    rangeText: formatCalcResultRange(range),
    koText,
    summary,
  };
}
