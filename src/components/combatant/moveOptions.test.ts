import { describe, expect, it } from 'vitest';
import {
  filterMoveOptions,
  resolveMoveOption,
  isMoveAvailable,
  type MoveOption,
} from './moveOptions';

const sampleMoves: MoveOption[] = [
  { name: 'Earthquake', type: 'Ground', basePower: 100, category: 'Physical' },
  { name: 'Thunderbolt', type: 'Electric', basePower: 90, category: 'Special' },
  { name: 'Thunder Wave', type: 'Electric', basePower: 0, category: 'Status' },
  { name: 'Swords Dance', type: 'Normal', basePower: 0, category: 'Status' },
  { name: 'Sword Dance', type: 'Normal', basePower: 0, category: 'Status' },
];

describe('moveOptions', () => {
  describe('filterMoveOptions', () => {
    it('returns all moves when search term is empty', () => {
      const result = filterMoveOptions(sampleMoves, '');
      expect(result).toHaveLength(5);
    });

    it('filters moves by substring (case-insensitive)', () => {
      const result = filterMoveOptions(sampleMoves, 'thunder');
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.name)).toEqual(['Thunderbolt', 'Thunder Wave']);
    });

    it('filters moves by exact name', () => {
      const result = filterMoveOptions(sampleMoves, 'Earthquake');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Earthquake');
    });

    it('returns empty array when no matches found', () => {
      const result = filterMoveOptions(sampleMoves, 'Nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('resolveMoveOption', () => {
    it('finds exact match (case-insensitive)', () => {
      const result = resolveMoveOption('earthquake', sampleMoves);
      expect(result?.name).toBe('Earthquake');
    });

    it('finds partial match (starts with)', () => {
      const result = resolveMoveOption('Thund', sampleMoves);
      expect(result?.name).toBe('Thunderbolt');
    });

    it('returns undefined for non-matching input', () => {
      const result = resolveMoveOption('Nonexistent', sampleMoves);
      expect(result).toBeUndefined();
    });

    it('returns undefined for empty input', () => {
      const result = resolveMoveOption('', sampleMoves);
      expect(result).toBeUndefined();
    });

    it('handles whitespace trimming', () => {
      const result = resolveMoveOption('  Earthquake  ', sampleMoves);
      expect(result?.name).toBe('Earthquake');
    });
  });

  describe('isMoveAvailable', () => {
    it('returns true for available move', () => {
      const result = isMoveAvailable('Earthquake', sampleMoves);
      expect(result).toBe(true);
    });

    it('returns false for unavailable move', () => {
      const result = isMoveAvailable('Nonexistent', sampleMoves);
      expect(result).toBe(false);
    });

    it('handles case-insensitive matching', () => {
      const result = isMoveAvailable('THUNDERBOLT', sampleMoves);
      expect(result).toBe(true);
    });
  });
});
