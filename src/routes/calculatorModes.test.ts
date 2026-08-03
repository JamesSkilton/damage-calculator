import { describe, expect, it } from 'vitest';
import { calculatorModes } from 'modes/calculatorModes';

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

  it('describes the one-vs-one team panels', () => {
    expect(calculatorModes[0]).toMatchObject({
      label: 'One vs One',
      title: 'One vs One',
      description: expect.stringContaining('attacker and defender'),
    });
  });
});
