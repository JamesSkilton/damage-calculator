import { describe, expect, it } from 'vitest';
import {
  formatCalcResultRange,
  normalizeCalcResult,
  normalizeCalcResultKoText,
  normalizeCalcResultRange,
  normalizeCalcResultSummary,
} from '@/adapters/calcResult';

describe('calc result normalizer', () => {
  it('normalizes range inputs and keeps the formatted range stable', () => {
    expect(normalizeCalcResultRange(42)).toEqual({ min: 42, max: 42 });
    expect(normalizeCalcResultRange([24, 18])).toEqual({ min: 18, max: 24 });
    expect(normalizeCalcResultRange({ min: 12, max: 36 })).toEqual({
      min: 12,
      max: 36,
    });
    expect(formatCalcResultRange({ min: 12, max: 36 })).toBe('12 - 36');
  });

  it('normalizes KO text from strings and text-bearing objects', () => {
    expect(normalizeCalcResultKoText('  guaranteed OHKO  ')).toBe(
      'guaranteed OHKO',
    );
    expect(normalizeCalcResultKoText({ text: '  59% chance to 2HKO  ' })).toBe(
      '59% chance to 2HKO',
    );
    expect(normalizeCalcResultKoText(undefined)).toBe('');
  });

  it('normalizes summary text with fullDesc precedence and summary fallback', () => {
    expect(normalizeCalcResultSummary('  full description  ', 'summary')).toBe(
      'full description',
    );
    expect(normalizeCalcResultSummary('   ', '  fallback summary  ')).toBe(
      'fallback summary',
    );
    expect(normalizeCalcResultSummary(undefined, '   ')).toBe('');
  });

  it('falls back to koText when kochance returns an empty KO string', () => {
    const result = normalizeCalcResult({
      range() {
        return [18, 24];
      },
      kochance() {
        return { text: '' };
      },
      koText: ' fallback KO text ',
      fullDesc() {
        return '';
      },
    });

    expect(result.koText).toBe('fallback KO text');
  });

  it('normalizes the calc result into a stable UI contract', () => {
    const result = normalizeCalcResult({
      range() {
        return [18, 24];
      },
      kochance() {
        return { text: ' guaranteed 3HKO ' };
      },
      fullDesc(notation = '%') {
        return `Pikachu Thunderbolt vs. Bulbasaur: 18-24 (${notation})`;
      },
    });

    expect(result).toEqual({
      range: { min: 18, max: 24 },
      rangeText: '18 - 24',
      koText: 'guaranteed 3HKO',
      summary: 'Pikachu Thunderbolt vs. Bulbasaur: 18-24 (%)',
    });
  });

  it('falls back to summary when fullDesc is blank and trims the chosen summary', () => {
    const result = normalizeCalcResult({
      range() {
        return { min: 10, max: 20 };
      },
      fullDesc() {
        return '   ';
      },
      summary: '  fallback summary  ',
    });

    expect(result.summary).toBe('fallback summary');
  });

  it('falls back to empty text when the source omits KO or summary data', () => {
    const result = normalizeCalcResult({
      damageRange: { min: 7, max: 7 },
    });

    expect(result).toEqual({
      range: { min: 7, max: 7 },
      rangeText: '7 - 7',
      koText: '',
      summary: '',
    });
  });
});
