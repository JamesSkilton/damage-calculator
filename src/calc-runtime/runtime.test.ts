import {describe, expect, it} from 'vitest';
import {calculateBattleRuntime, CalcRuntimeError} from 'calc-runtime';
import {legacyParityFixtures} from 'adapters/tests/legacyParity.fixtures';

describe('typed calc runtime', () => {
  it('raises a typed error for unknown species instead of returning zero damage', () => {
    const fixture = legacyParityFixtures[0].input;

    expect(() =>
      calculateBattleRuntime({
        ...fixture,
        attacker: {...fixture.attacker, species: 'Missingmon'},
      }),
    ).toThrowError(CalcRuntimeError);

    try {
      calculateBattleRuntime({
        ...fixture,
        attacker: {...fixture.attacker, species: 'Missingmon'},
      });
    } catch (error) {
      expect(error).toMatchObject({code: 'UNKNOWN_SPECIES'});
    }
  });

  it('raises a typed error for unknown moves instead of synthetic fallback damage', () => {
    const fixture = legacyParityFixtures[0].input;

    expect(() =>
      calculateBattleRuntime({
        ...fixture,
        move: {...fixture.move, name: 'Missing Move'},
      }),
    ).toThrowError(CalcRuntimeError);
  });
});
