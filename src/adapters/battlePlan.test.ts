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

  it('applies state steps: exact HP, status and weather feed later calculations', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Thunderbolt'] };
    const defender = { ...team.defender, currentHp: 100, moves: ['Tackle'] };
    const move = { name: 'Thunderbolt', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'hit', actor: 'attacker', type: 'move', move },
        { id: 'confirm', actor: 'defender', type: 'state', hp: 40, status: 'brn', weather: 'Rain' },
        { id: 'hit-again', actor: 'attacker', type: 'move', move },
      ],
    });

    expect(results[1].damage).toEqual({ min: 0, max: 0 });
    expect(results[1].defenderHp).toEqual({ min: 40, max: 40 });
    expect(results[1].statuses['initial-defender']).toBe('brn');
    expect(results[2].field.weather).toBe('Rain');
    expect(results[2].defenderHp.max).toBeLessThan(40);
  });

  it('applies stat stages from state steps to later calculations', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Thunderbolt'] };
    const defender = { ...team.defender, currentHp: 100, moves: ['Tackle'] };
    const move = { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const base = { generation: 9 as const, attacker, defender, field: createBattleFieldDraft(9) };
    const plain = buildBattlePlanResults({ ...base, actions: [{ id: 'hit', actor: 'defender', type: 'move', move }] });
    const boosted = buildBattlePlanResults({
      ...base,
      actions: [
        { id: 'boost', actor: 'defender', type: 'state', boosts: { atk: 2 } },
        { id: 'hit', actor: 'defender', type: 'move', move },
      ],
    });

    expect(boosted[0].boosts['initial-defender'].atk).toBe(2);
    expect(boosted[1].damage.max).toBeGreaterThan(plain[0].damage.max);
  });

  it('treats a skipped move as no action: zero damage and HP unchanged', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, status: 'slp' as const, moves: ['Thunderbolt'] };
    const defender = { ...team.defender, currentHp: 0, moves: ['Tackle'] };
    const move = { name: 'Thunderbolt', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const [result] = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [{ id: 'asleep', actor: 'attacker', type: 'move', move: { ...move, skipped: true } }],
    });

    expect(result.damage).toEqual({ min: 0, max: 0 });
    expect(result.defenderHp.max).toBe(result.maxHp.defender);
    expect(result.attackerHp.max).toBe(result.maxHp.attacker);
    expect(result.maxHp.attacker).toBeGreaterThan(0);
    expect(result.maxHp.defender).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
  });

  it('applies status from moves like Thunder Wave and carries it into later steps', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Thunder Wave'] };
    const defender = { ...team.defender, types: ['Normal'], currentHp: 100, moves: ['Tackle'] };
    const wave = { name: 'Thunder Wave', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'wave', actor: 'attacker', type: 'move', move: wave },
        { id: 'end', actor: 'attacker', type: 'end-turn' },
        { id: 'wave-again', actor: 'attacker', type: 'move', move: wave },
      ],
    });

    expect(results[0].statuses['initial-defender']).toBe('par');
    expect(results[2].statuses['initial-defender']).toBe('par');
  });

  it('applies end-of-turn burn and escalating toxic damage', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 160, status: 'brn' as const, ability: 'Static' };
    const defender = { ...team.defender, currentHp: 160, status: 'tox' as const, ability: 'Static' };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'e1', actor: 'attacker', type: 'end-turn' },
        { id: 'e2', actor: 'attacker', type: 'end-turn' },
      ],
    });

    const [first, second] = results.map((r) => r.residual!);
    expect(first.attacker.damage).toBeGreaterThan(0);
    expect(first.attacker.sources).toEqual(['burn']);
    expect(second.defender.damage).toBe(Math.floor((second.defender.maxHp * 2) / 16));
    expect(results[1].defenderHp.max).toBeLessThan(results[0].defenderHp.max);
  });

  it('applies item, ability and terrain residuals', () => {
    const team = createTeamDraft(9);
    const base = { ...team.attacker, currentHp: 100, ability: 'Static', status: undefined };
    const field = { ...createBattleFieldDraft(9), terrain: 'Grassy' as const };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker: { ...base, item: 'Leftovers' },
      defender: { ...team.defender, currentHp: 100, ability: 'Static', item: 'Flame Orb', status: undefined },
      field,
      actions: [
        { id: 'e1', actor: 'attacker', type: 'end-turn' },
        { id: 'e2', actor: 'attacker', type: 'end-turn' },
      ],
    });

    expect(results[0].residual!.attacker.sources).toEqual(expect.arrayContaining(['Leftovers']));
    expect(results[0].residual!.defender.sources).toContain('Flame Orb (burns)');
    expect(results[0].statuses['initial-defender']).toBe('brn');
    expect(results[1].residual!.defender.sources).toContain('burn');
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