import type { BattleDamageRange } from '@/domain';

export type CalcResultRangeInput =
  | number
  | readonly [number, number]
  | BattleDamageRange
  | { min: number; max: number };

export type CalcResultKoInput =
  string | { text?: string | null } | null | undefined;

export interface CalcResultLike {
  range?: () => CalcResultRangeInput;
  damageRange?: CalcResultRangeInput;
  kochance?: (err?: boolean) => { text?: string | null } | null | undefined;
  koText?: CalcResultKoInput;
  fullDesc?: (notation?: string, err?: boolean) => string;
  summary?: string | null;
}

export interface NormalizedCalcResultRange {
  min: number;
  max: number;
}

export interface NormalizedCalcResult {
  range: NormalizedCalcResultRange;
  rangeText: string;
  koText: string;
  summary: string;
}

export const CALC_RESULT_DEFAULT_NOTATION = '%';
