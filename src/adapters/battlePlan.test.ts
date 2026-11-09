import { describe, expect, it } from 'vitest';
import {
  buildBattlePlanResults,
  replaceActivePokemonInPlanSegment,
} from './battlePlan';
import { createBattleFieldDraft } from '../components/combatant/shared/battleFieldDraft';
import { createTeamDraft } from '../components/combatant/shared/combatantDraft';

describe('battle plan adapter', () => {
  it('replaces the switched-in Pokemon and its actions without changing earlier actions', () => {
    const actions = [
      {
        id: 'before-switch',
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
        id: 'switch-in',
        actor: 'attacker',
        type: 'switch',
        targetPokemonId: 'switched-in',
      },
      {
        id: 'after-switch',
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
        id: 'after-switch-again',
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
    ] as const;

    expect(
      replaceActivePokemonInPlanSegment(
        actions,
        'attacker',
        'initial',
        'eevee',
      ),
    ).toEqual([
      actions[0],
      { ...actions[1], targetPokemonId: 'eevee' },
      { ...actions[2], pokemonId: 'eevee' },
      { ...actions[3], pokemonId: 'eevee' },
    ]);
  });

  it('resolves a move using its explicitly selected roster Pokemon', () => {
    const team = createTeamDraft(9);
    const attacker = {
      ...team.attacker,
      name: 'Initial',
      species: 'Pikachu',
      moves: ['Thunderbolt'],
    };
    const replacement = {
      ...attacker,
      name: 'Eevee',
      species: 'Eevee',
      moves: ['Tackle'],
    };
    const defender = team.defender;
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      attackerRoster: [
        {
          id: 'initial',
          label: 'Initial',
          source: 'current',
          combatant: attacker,
          moves: [],
        },
        {
          id: 'eevee',
          label: 'Eevee',
          source: 'party',
          combatant: replacement,
          moves: [],
        },
      ],
      attackerRosterId: 'initial',
      actions: [
        {
          id: 'selected-move',
          actor: 'attacker',
          type: 'move',
          pokemonId: 'eevee',
          move: {
            name: 'Tackle',
            isCrit: false,
            hits: 1,
            isStellarFirstUse: false,
            timesUsed: 1,
          },
        },
      ],
    });

    expect(results[0].activePokemonId).toBe('eevee');
    expect(results[0].activePokemonLabel).toBe('Eevee');
  });

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
    const defender = { ...team.defender, types: ['Normal'] as const, currentHp: 100, moves: ['Tackle'] };
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

  it('consumes a resist berry on the first super effective hit only', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Thunderbolt'] };
    const defender = { ...team.defender, species: 'Squirtle', name: 'Squirtle', types: ['Water'] as const, item: 'Wacan Berry', currentHp: 0, moves: ['Tackle'] };
    const move = { name: 'Thunderbolt', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const withBerry = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'one', actor: 'attacker', type: 'move', move },
        { id: 'two', actor: 'attacker', type: 'move', move },
      ],
    });

    expect(withBerry[0].items['initial-defender']).toBe('consumed');
    expect(withBerry[0].itemEvents.join(' ')).toContain('Wacan Berry weakened the hit');
    expect(withBerry[1].damage.max).toBeGreaterThan(withBerry[0].damage.max * 1.8);
  });

  it('raises Defense when a Kee Berry holder survives a physical hit', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Tackle'] };
    const defender = { ...team.defender, item: 'Kee Berry', currentHp: 0, moves: ['Tackle'] };
    const [result] = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [{ id: 'hit', actor: 'attacker', type: 'move', move: { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 } }],
    });

    expect(result.items['initial-defender']).toBe('consumed');
    expect(result.boosts['initial-defender'].def).toBe(1);
  });

  it('makes the attacker lose HP to a Jaboca Berry on a physical hit', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, moves: ['Tackle'] };
    const defender = { ...team.defender, item: 'Jaboca Berry', currentHp: 0, moves: ['Tackle'] };
    const [result] = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [{ id: 'hit', actor: 'attacker', type: 'move', move: { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 } }],
    });

    expect(result.maxHp.attacker).toBeGreaterThan(0);
    expect(result.attackerHp.max).toBe(result.maxHp.attacker - Math.floor(result.maxHp.attacker / 8));
    expect(result.items['initial-defender']).toBe('consumed');
  });

  it('eats a Sitrus Berry right after the hit that crosses half HP', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, moves: ['Thunderbolt'] };
    const defender = { ...team.defender, types: ['Normal'] as const, currentHp: 0, moves: ['Tackle'] };
    const field = createBattleFieldDraft(9);
    const move = { name: 'Thunderbolt', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const plain = buildBattlePlanResults({ generation: 9, attacker, defender, field, actions: [{ id: 'hit', actor: 'attacker', type: 'move', move }] })[0];
    // Hit once for a bit over half of max HP via a state correction, then check the berry fires on the next hit.
    const maxHp = plain.maxHp.defender;
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender: { ...defender, item: 'Sitrus Berry' },
      field,
      actions: [
        { id: 'prime', actor: 'attacker', type: 'move', move },
        { id: 'set', actor: 'defender', type: 'state', hp: Math.floor(maxHp / 2) + 1 },
        { id: 'hit', actor: 'attacker', type: 'move', move },
      ],
    });

    expect(results[0].items['initial-defender']).toBe('held');
    expect(results[2].items['initial-defender']).not.toBe('held');
    expect(results[2].itemEvents.join(' ')).toContain('Sitrus Berry');
  });

  it('cures a status as soon as a move inflicts it', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Thunder Wave'] };
    const defender = { ...team.defender, types: ['Normal'] as const, item: 'Cheri Berry', currentHp: 100, moves: ['Tackle'] };
    const [result] = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [{ id: 'wave', actor: 'attacker', type: 'move', move: { name: 'Thunder Wave', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 } }],
    });

    expect(result.statuses['initial-defender']).toBeUndefined();
    expect(result.items['initial-defender']).toBe('consumed');
  });

  it('does not eat berries next to an Unnerve opponent', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, ability: 'Unnerve', currentHp: 0, moves: ['Tackle'] };
    const defender = { ...team.defender, item: 'Kee Berry', currentHp: 0, moves: ['Tackle'] };
    const [result] = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [{ id: 'hit', actor: 'attacker', type: 'move', move: { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 } }],
    });

    expect(result.items['initial-defender']).toBe('held');
  });

  it('heals with Cheek Pouch after a healing berry, without exceeding max HP', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Tackle'] };
    const defender = { ...team.defender, ability: 'Cheek Pouch', item: 'Sitrus Berry', currentHp: 0 };
    const move = { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const base = { generation: 9 as const, attacker, defender, field: createBattleFieldDraft(9) };
    const [probe] = buildBattlePlanResults({ ...base, actions: [{ id: 'probe', actor: 'attacker', type: 'move', move }] });
    const results = buildBattlePlanResults({
      ...base,
      actions: [
        { id: 'probe', actor: 'attacker', type: 'move', move },
        { id: 'set', actor: 'defender', type: 'state', hp: Math.floor(probe.maxHp.defender / 2) },
        { id: 'hit', actor: 'attacker', type: 'move', move },
      ],
    });
    const result = results[2];
    const maxHp = result.maxHp.defender;
    const initialHp = Math.floor(maxHp / 2);
    const heal = Math.floor(maxHp / 4) + Math.floor(maxHp / 3);
    expect(result.items['initial-defender']).toBe('consumed');
    expect(result.defenderHp).toEqual({
      min: Math.min(maxHp, initialHp - result.damage.max + heal),
      max: Math.min(maxHp, initialHp - result.damage.min + heal),
    });
    expect(result.itemEvents.join(' ')).toContain('Cheek Pouch restored');
  });

  it('keeps both HP outcomes when a healing berry with Cheek Pouch only possibly triggers', () => {
    const team = createTeamDraft(9);
    const base = {
      generation: 9 as const,
      attacker: { ...team.attacker, currentHp: 100 },
      defender: { ...team.defender, ability: 'Cheek Pouch', item: 'Sitrus Berry', currentHp: 0 },
      field: createBattleFieldDraft(9),
    };
    const move = { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const [probe] = buildBattlePlanResults({ ...base, actions: [{ id: 'hit', actor: 'attacker', type: 'move', move }] });
    const maxHp = probe.maxHp.defender;
    const threshold = Math.floor(maxHp / 2);
    const initialHp = threshold + probe.damage.max - 1;
    const [result] = buildBattlePlanResults({
      ...base,
      defender: { ...base.defender, currentHp: initialHp },
      actions: [{ id: 'hit', actor: 'attacker', type: 'move', move }],
    });
    const heal = Math.floor(maxHp / 4) + Math.floor(maxHp / 3);
    expect(result.items['initial-defender']).toBe('maybe-consumed');
    expect(result.defenderHp).toEqual({
      min: Math.min(threshold + 1, Math.min(maxHp, threshold - 1 + heal)),
      max: Math.max(initialHp - result.damage.min, Math.min(maxHp, threshold + heal)),
    });
    expect(result.itemEvents.join(' ')).toContain('Cheek Pouch possibly restored');
  });

  it('heals from Cheek Pouch when a status or hit berry is eaten, but not when blocked', () => {
    const team = createTeamDraft(9);
    const defender = { ...team.defender, ability: 'Cheek Pouch', item: 'Cheri Berry', currentHp: 30, types: ['Normal'] as const };
    const move = { name: 'Thunder Wave', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const base = {
      generation: 9 as const,
      attacker: { ...team.attacker, currentHp: 100, ability: 'Static' },
      defender,
      field: createBattleFieldDraft(9),
      actions: [{ id: 'wave', actor: 'attacker' as const, type: 'move' as const, move }],
    };
    const [cured] = buildBattlePlanResults(base);
    expect(cured.defenderHp.max).toBe(Math.min(cured.maxHp.defender, 30 + Math.floor(cured.maxHp.defender / 3)));
    expect(cured.statuses['initial-defender']).toBeUndefined();
    const [blocked] = buildBattlePlanResults({ ...base, attacker: { ...base.attacker, ability: 'Unnerve' } });
    expect(blocked.items['initial-defender']).toBe('held');
    expect(blocked.defenderHp.max).toBe(30);
    const [hit] = buildBattlePlanResults({
      ...base,
      defender: { ...defender, item: 'Kee Berry', currentHp: 100 },
      actions: [{ ...base.actions[0], move: { ...move, name: 'Tackle' } }],
    });
    expect(hit.items['initial-defender']).toBe('consumed');
    expect(hit.defenderHp.max).toBe(Math.min(hit.maxHp.defender, 100 - hit.damage.min + Math.floor(hit.maxHp.defender / 3)));
  });

  it('applies Cheek Pouch before damage when a resist berry is eaten', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Thunderbolt'] };
    const defender = { ...team.defender, species: 'Squirtle', name: 'Squirtle', types: ['Water'] as const, ability: 'Cheek Pouch', item: 'Wacan Berry', currentHp: 60 };
    const move = { name: 'Thunderbolt', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const base = { generation: 9 as const, attacker, defender, field: createBattleFieldDraft(9) };
    const [survives] = buildBattlePlanResults({ ...base, actions: [{ id: 'hit', actor: 'attacker', type: 'move', move }] });
    expect(survives.items['initial-defender']).toBe('consumed');
    expect(survives.defenderHp.max).toBe(Math.max(0, Math.min(
      survives.maxHp.defender, 60 + Math.floor(survives.maxHp.defender / 3),
    ) - survives.damage.min));
    expect(survives.itemEvents.join(' ')).toContain('Cheek Pouch restored');
  });

  it('applies Cheek Pouch to a status berry before end-of-turn damage', () => {
    const team = createTeamDraft(9);
    const defender = { ...team.defender, ability: 'Cheek Pouch', item: 'Pecha Berry', status: 'psn' as const, currentHp: 30 };
    const [result] = buildBattlePlanResults({
      generation: 9,
      attacker: { ...team.attacker, currentHp: 100 },
      defender,
      field: createBattleFieldDraft(9),
      actions: [{ id: 'end', actor: 'attacker', type: 'end-turn' }],
    });
    expect(result.statuses['initial-defender']).toBeUndefined();
    expect(result.defenderHp.max).toBe(Math.min(result.maxHp.defender, 30 + Math.floor(result.maxHp.defender / 3)));
    expect(result.itemEvents.join(' ')).toContain('Cheek Pouch restored');
  });

  it('activates Unburden after eating a berry for later damage and clears it on switching', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, moves: ['Tackle'] };
    const defender = { ...team.defender, ability: 'Unburden', abilityOn: false, item: 'Kee Berry', currentHp: 0, moves: ['Gyro Ball'] };
    const other = { ...defender, ability: 'Static', item: undefined, name: 'Other' };
    const tackle = { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const gyro = { ...tackle, name: 'Gyro Ball' };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      defenderRoster: [
        { id: 'd', label: 'Defender', source: 'trainer', combatant: defender, moves: [] },
        { id: 'other', label: 'Other', source: 'trainer', combatant: other, moves: [] },
      ],
      actions: [
        { id: 'hit', actor: 'attacker', type: 'move', move: tackle },
        { id: 'gyro-boosted', actor: 'defender', type: 'move', move: gyro },
        { id: 'out', actor: 'defender', type: 'switch', targetPokemonId: 'other' },
        { id: 'back', actor: 'defender', type: 'switch', targetPokemonId: 'd' },
        { id: 'gyro-normal', actor: 'defender', type: 'move', move: gyro },
      ],
    });
    expect(results[0].unburdenActive.d).toBe(true);
    expect(results[0].itemEvents.join(' ')).toContain('Unburden activated');
    expect(results[3].unburdenActive.d).toBe(false);
    expect(results[3].items.d).toBe('consumed');
    expect(results[1].damage.max).toBeLessThan(results[4].damage.max);
  });

  it('does not activate Unburden when a berry is blocked or only possibly eaten', () => {
    const team = createTeamDraft(9);
    const defender = { ...team.defender, ability: 'Unburden', abilityOn: false, item: 'Kee Berry', currentHp: 0 };
    const move = { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const base = {
      generation: 9 as const,
      attacker: { ...team.attacker, currentHp: 100, ability: 'Static' },
      defender,
      field: createBattleFieldDraft(9),
    };
    const [probe] = buildBattlePlanResults({ ...base, actions: [{ id: 'hit', actor: 'attacker', type: 'move', move }] });
    const possible = buildBattlePlanResults({
      ...base,
      actions: [
        { id: 'set', actor: 'defender', type: 'state', hp: probe.damage.max },
        { id: 'hit2', actor: 'attacker', type: 'move', move },
      ],
    });
    expect(possible[1].items['initial-defender']).toBe('maybe-consumed');
    expect(possible[1].unburdenActive['initial-defender']).toBe(false);
    const [blocked] = buildBattlePlanResults({
      ...base,
      attacker: { ...base.attacker, ability: 'Unnerve' },
      actions: [{ id: 'hit', actor: 'attacker', type: 'move', move }],
    });
    expect(blocked.unburdenActive['initial-defender']).toBe(false);
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