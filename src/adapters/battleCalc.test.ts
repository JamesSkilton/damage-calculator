import { describe, expect, it } from 'vitest';
import {
  buildBattleCalcBreakdowns,
  calculateBattleCalcResult,
} from 'adapters/battleCalc';
import { legacyParityFixtures } from 'adapters/tests/legacyParity.fixtures';

describe('typed battle calc runtime', () => {
  it('normalizes a legacy parity fixture into a calc breakdown', () => {
    const { input, expected } = legacyParityFixtures[0];

    expect(
      calculateBattleCalcResult({
        generation: input.generation,
        attacker: input.attacker,
        defender: input.defender,
        field: input.field,
        move: input.move,
      }),
    ).toEqual({
      range: { min: expected.range[0], max: expected.range[1] },
      rangeText: `${expected.range[0]} - ${expected.range[1]}`,
      koText: expected.koText,
      summary: expected.summary,
    });
  });

  it('recreates every representative legacy mechanic through the typed runtime', () => {
    for (const {input, expected} of legacyParityFixtures) {
      expect(
        calculateBattleCalcResult({
          generation: input.generation,
          attacker: input.attacker,
          defender: input.defender,
          field: input.field,
          move: input.move,
        }),
      ).toEqual({
        range: {min: expected.range[0], max: expected.range[1]},
        rangeText: `${expected.range[0]} - ${expected.range[1]}`,
        koText: expected.koText,
        summary: expected.summary,
      });
    }
  });

  it('skips empty move slots when building breakdown entries', () => {
    const { input } = legacyParityFixtures[0];

    const breakdowns = buildBattleCalcBreakdowns({
      generation: input.generation,
      attacker: input.attacker,
      defender: input.defender,
      field: input.field,
      moves: [
        {
          name: 'Night Shade',
          isCrit: false,
          hits: 1,
          useZ: false,
          useMax: false,
          isStellarFirstUse: false,
          timesUsed: 1,
        },
        {
          name: '   ',
          isCrit: false,
          hits: 1,
          useZ: false,
          useMax: false,
          isStellarFirstUse: false,
          timesUsed: 1,
        },
      ],
    });

    expect(breakdowns).toHaveLength(1);
    expect(breakdowns[0].label).toBe('Night Shade');
    expect(breakdowns[0].result?.summary).toContain('Night Shade');
  });
});
