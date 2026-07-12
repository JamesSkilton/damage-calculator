import { describe, expect, it } from 'vitest';
import { calculatorModes } from '@/modes/calculatorModes';

describe('calculatorModes', () => {
  it('exposes the expected route slugs', () => {
    expect(calculatorModes.map((mode) => mode.slug)).toEqual([
      'one-vs-one',
      'one-vs-all',
      'all-vs-one',
      'champions',
      'randoms',
      'oms',
    ]);
  });
});
