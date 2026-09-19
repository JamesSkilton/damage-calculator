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
          type: 'move',
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
          type: 'move',
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
          type: 'move',
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

  it('switches rosters with zero damage and retains each Pokemon HP', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Thunderbolt'] };
    const defender = { ...team.defender, currentHp: 100, moves: ['Tackle'] };
    const alternateDefender = { ...defender, name: 'Alternate', species: 'Charizard', currentHp: 100 };
    const move = {
      name: 'Thunderbolt',
      isCrit: false,
      hits: 1,
      isStellarFirstUse: false,
      timesUsed: 1,
    };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      attackerRoster: [{ id: 'a', label: 'Attacker', source: 'party', combatant: attacker, moves: [] }],
      defenderRoster: [
        { id: 'd', label: 'Defender', source: 'trainer', combatant: defender, moves: [] },
        { id: 'alt', label: 'Alternate', source: 'trainer', combatant: alternateDefender, moves: [] },
      ],
      attackerRosterId: 'a',
      defenderRosterId: 'd',
      actions: [
        { id: 'hit-one', actor: 'attacker', type: 'move', move },
        { id: 'switch-out', actor: 'defender', type: 'switch', targetPokemonId: 'alt' },
        { id: 'hit-two', actor: 'attacker', type: 'move', move },
        { id: 'switch-back', actor: 'defender', type: 'switch', targetPokemonId: 'd' },
      ],
    });

    expect(results[0].damage.max).toBeGreaterThan(0);
    expect(results[1].damage).toEqual({ min: 0, max: 0 });
    expect(results[1].activePokemonId).toBe('alt');
    expect(results[2].cumulativeDamage.max).toBeGreaterThan(results[0].cumulativeDamage.max);
    expect(results[3].activePokemonId).toBe('d');
    expect(results[3].targetHp).toEqual(results[0].defenderHp);
  });

  it('reports an invalid switch target without changing active state', () => {
    const team = createTeamDraft(9);
    const results = buildBattlePlanResults({
      generation: 9,
      attacker: team.attacker,
      defender: team.defender,
      field: createBattleFieldDraft(9),
      actions: [{ id: 'invalid-switch', actor: 'attacker', type: 'switch', targetPokemonId: 'missing' }],
    });

    expect(results[0].error).toContain('Unknown switch target');
    expect(results[0].activePokemonId).toBe('initial-attacker');
    expect(results[0].damage).toEqual({ min: 0, max: 0 });
  });
});