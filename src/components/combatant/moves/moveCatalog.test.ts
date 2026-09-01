import { describe, expect, it } from 'vitest';
import { buildMoveCatalog } from './moveCatalog';

describe('buildMoveCatalog', () => {
  it('returns a non-empty list for gen 9', () => {
    const moves = buildMoveCatalog(9);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('excludes the (No Move) placeholder', () => {
    const moves = buildMoveCatalog(9);
    expect(moves.some((move) => move.name === '(No Move)')).toBe(false);
  });

  it('includes a known move with correct metadata', () => {
    const moves = buildMoveCatalog(9);
    const earthquake = moves.find((move) => move.name === 'Earthquake');
    expect(earthquake).toEqual({
      name: 'Earthquake',
      type: 'Ground',
      basePower: 100,
      category: 'Physical',
    });
  });

  it('is sorted alphabetically', () => {
    const moves = buildMoveCatalog(9);
    const names = moves.map((move) => move.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('excludes moves not yet available in earlier generations', () => {
    const gen3Moves = buildMoveCatalog(3);
    const gen4Moves = buildMoveCatalog(4);
    expect(gen3Moves.some((move) => move.name === 'Roost')).toBe(false);
    expect(gen4Moves.some((move) => move.name === 'Roost')).toBe(true);
  });
});
