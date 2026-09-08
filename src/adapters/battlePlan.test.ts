import { describe, expect, it } from 'vitest';
import { buildBattlePlanResults } from './battlePlan';
import { createBattleFieldDraft } from '../components/combatant/shared/battleFieldDraft';
import { createTeamDraft } from '../components/combatant/shared/combatantDraft';

describe('battle plan adapter', () => {
  it('propagates damage ranges through ordered player actions', () => {
    const attacker = createTeamDraft(9).attacker;
    const defender = createTeamDraft(9).defender;
    const field = createBattleFieldDraft(9);
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field,
      actions: [
        {
          id: 'first',
          actor: 'attacker',
          move: {
            name: 'Thunderbolt',
            isCrit: false,
            hits: 1,
            isStellarFirstUse: false,
            timesUsed: 1,
          },
        },
        {
          id: 'second',
          actor: 'attacker',
          move: {
            name: 'Thunderbolt',
            isCrit: false,
            hits: 1,
            isStellarFirstUse: false,
            timesUsed: 1,
          },
        },
      ],
    });

    expect(results).toHaveLength(2);
    expect(results[0].damage.max).toBeGreaterThan(0);
    expect(results[0].defenderHp.min).toBeLessThan(results[0].defenderHp.max);
    expect(results[1].cumulativeDamage.min).toBe(
      results[0].damage.min + results[1].damage.min,
    );
    expect(results[1].defenderHp.max).toBeLessThanOrEqual(results[0].defenderHp.max);
  });

  it('returns a local error for an unknown move without stopping later rows', () => {
    const team = createTeamDraft(9);
    const results = buildBattlePlanResults({
      generation: 9,
      attacker: team.attacker,
      defender: team.defender,
      field: createBattleFieldDraft(9),
      actions: [
        {
          id: 'invalid',
          actor: 'attacker',
          move: {
            name: 'Not A Move',
            isCrit: false,
            hits: 1,
            isStellarFirstUse: false,
            timesUsed: 1,
          },
        },
      ],
    });

    expect(results[0].error).toBeTruthy();
    expect(results[0].damage).toEqual({ min: 0, max: 0 });
  });
});