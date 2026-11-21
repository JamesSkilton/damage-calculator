import { describe, expect, it } from 'vitest';
import {
  buildBattlePlanResults,
  replaceActivePokemonInPlanSegment,
} from './battlePlan';
import { buildBattleCalcBreakdowns } from './battleCalc';
import { createBattleFieldDraft } from '../components/combatant/shared/battleFieldDraft';
import { createTeamDraft } from '../components/combatant/shared/combatantDraft';

describe('battle plan adapter', () => {
  it.each([
    ['Mega Drain', 1, 2],
    ['Draining Kiss', 3, 4],
  ])('heals the user of %s from actual damage', (name, numerator, denominator) => {
    const team = createTeamDraft(9);
    const [result] = buildBattlePlanResults({
      generation: 9,
      attacker: { ...team.attacker, currentHp: 50, item: undefined },
      defender: { ...team.defender, currentHp: 3 },
      field: createBattleFieldDraft(9),
      actions: [{ id: 'drain', actor: 'attacker', type: 'move', move: {
        name, isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1,
      } }],
    });
    const heal = Math.round(3 * numerator / denominator);
    expect(result.attackerHp).toEqual({ min: 50 + heal, max: 50 + heal });
    expect(result.healing).toContainEqual({
      pokemonId: 'initial-attacker', source: name, amount: { min: heal, max: heal },
    });
  });

  it('handles Big Root, immunity, and Liquid Ooze for drain moves', () => {
    const team = createTeamDraft(9);
    const move = { name: 'Mega Drain', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const input = {
      generation: 9 as const,
      attacker: { ...team.attacker, currentHp: 50, item: 'Big Root' },
      defender: { ...team.defender, currentHp: 3, ability: 'Liquid Ooze' },
      field: createBattleFieldDraft(9),
      actions: [{ id: 'drain', actor: 'attacker' as const, type: 'move' as const, move }],
    };
    const [ooze] = buildBattlePlanResults(input);
    expect(ooze.attackerHp).toEqual({ min: 48, max: 48 });
    expect(ooze.healing).toEqual([]);
    const [immune] = buildBattlePlanResults({
      ...input, defender: { ...input.defender, species: 'Bouffalant', ability: 'Sap Sipper' },
    });
    expect(immune.attackerHp).toEqual({ min: 50, max: 50 });
    expect(immune.healing).toEqual([]);
    const [protectedResult] = buildBattlePlanResults({
      ...input, field: { ...input.field, defenderSide: { ...input.field.defenderSide, isProtected: true } },
    });
    expect(protectedResult.attackerHp).toEqual({ min: 50, max: 50 });
    expect(protectedResult.healing).toEqual([]);
  });

  it('propagates drain damage rolls for the defending side and caps healing at full HP', () => {
    const team = createTeamDraft(9);
    const move = { name: 'Draining Kiss', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const base = {
      generation: 9 as const,
      attacker: { ...team.attacker, currentHp: 100 },
      defender: { ...team.defender, currentHp: 50, item: undefined },
      field: createBattleFieldDraft(9),
      actions: [{ id: 'drain', actor: 'defender' as const, type: 'move' as const, move }],
    };
    const [result] = buildBattlePlanResults(base);
    expect(result.defenderHp).toEqual({
      min: 50 + Math.round(result.damage.min * 3 / 4),
      max: 50 + Math.round(result.damage.max * 3 / 4),
    });
    const [capped] = buildBattlePlanResults({
      ...base, defender: { ...base.defender, currentHp: result.maxHp.defender - 1 },
    });
    expect(capped.defenderHp).toEqual({ min: result.maxHp.defender, max: result.maxHp.defender });
    expect(capped.healing).toContainEqual({
      pokemonId: 'initial-defender', source: 'Draining Kiss', amount: { min: 1, max: 1 },
    });
  });

  it('heals separately for each Parental Bond hit', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 50, ability: 'Parental Bond', item: undefined };
    const defender = { ...team.defender, currentHp: 200 };
    const field = createBattleFieldDraft(9);
    const move = { name: 'Mega Drain', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const [calc] = buildBattleCalcBreakdowns({ generation: 9, attacker, defender, field, moves: [move] });
    const hits = calc.details!.drainHitDamage!;
    expect(hits).toHaveLength(2);
    const [result] = buildBattlePlanResults({
      generation: 9, attacker, defender, field,
      actions: [{ id: 'drain', actor: 'attacker', type: 'move', move }],
    });
    expect(result.attackerHp).toEqual({
      min: 50 + hits.reduce((sum, hit) => sum + Math.max(1, Math.round(hit.min / 2)), 0),
      max: 50 + hits.reduce((sum, hit) => sum + Math.max(1, Math.round(hit.max / 2)), 0),
    });
  });

  it('increases draining move and Leech Seed healing with Big Root', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.defender, currentHp: 50, item: 'Big Root' };
    const defender = { ...team.attacker, currentHp: 200, item: undefined };
    const field = createBattleFieldDraft(9);
    const [hit, end] = buildBattlePlanResults({
      generation: 9, attacker, defender,
      field: { ...field, defenderSide: { ...field.defenderSide, isSeeded: true } },
      actions: [
        { id: 'hit', actor: 'attacker', type: 'move', move: {
          name: 'Mega Drain', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1,
        } },
        { id: 'end', actor: 'attacker', type: 'end-turn' },
      ],
    });
    const root = (amount: number) => Math.floor(amount * 5324 / 4096);
    expect(hit.attackerHp).toEqual({
      min: 50 + root(Math.round(hit.damage.min / 2)),
      max: 50 + root(Math.round(hit.damage.max / 2)),
    });
    const seedHealing = root(Math.floor(end.maxHp.defender / 8));
    expect(end.attackerHp).toEqual({
      min: hit.attackerHp.min + seedHealing,
      max: hit.attackerHp.max + seedHealing,
    });
  });

  it('applies Leech Seed to the target, transfers HP each turn, and clears it on switching', () => {
    const team = createTeamDraft(9);
    const defender = { ...team.attacker, name: 'Target', currentHp: 100, item: undefined };
    const replacement = { ...defender, name: 'Replacement' };
    const [seed, end, switched, endAfterSwitch] = buildBattlePlanResults({
      generation: 9,
      attacker: { ...team.defender, currentHp: 50, item: undefined },
      defender,
      defenderRoster: [
        { id: 'target', label: 'Target', source: 'current', combatant: defender, moves: [] },
        { id: 'replacement', label: 'Replacement', source: 'party', combatant: replacement, moves: [] },
      ],
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'seed', actor: 'attacker', type: 'move', move: {
          name: 'Leech Seed', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1,
        } },
        { id: 'end', actor: 'attacker', type: 'end-turn' },
        { id: 'switch', actor: 'defender', type: 'switch', targetPokemonId: 'replacement' },
        { id: 'end2', actor: 'attacker', type: 'end-turn' },
      ],
    });
    const amount = Math.floor(end.maxHp.defender / 8);
    expect(seed.field.defenderSide.isSeeded).toBe(true);
    expect(end.defenderHp).toEqual({ min: 100 - amount, max: 100 - amount });
    expect(end.attackerHp).toEqual({ min: 50 + amount, max: 50 + amount });
    expect(end.healing).toContainEqual({
      pokemonId: 'initial-attacker', source: 'Leech Seed', amount: { min: amount, max: amount },
    });
    expect(switched.field.defenderSide.isSeeded).toBe(false);
    expect(endAfterSwitch.healing).toEqual([]);
  });

  it('does not seed Grass types and applies Liquid Ooze to an existing seed', () => {
    const team = createTeamDraft(9);
    const field = createBattleFieldDraft(9);
    const [seed] = buildBattlePlanResults({
      generation: 9, attacker: team.attacker, defender: team.defender, field,
      actions: [{ id: 'seed', actor: 'attacker', type: 'move', move: {
        name: 'Leech Seed', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1,
      } }],
    });

    expect(seed.field.defenderSide.isSeeded).toBe(false);
    const [end] = buildBattlePlanResults({
      generation: 9,
      attacker: { ...team.attacker, currentHp: 50, item: 'Big Root' },
      defender: { ...team.defender, currentHp: 1, ability: 'Liquid Ooze' },
      field: { ...field, defenderSide: { ...field.defenderSide, isSeeded: true } },
      actions: [{ id: 'end', actor: 'attacker', type: 'end-turn' }],
    });
    expect(end.attackerHp).toEqual({ min: 49, max: 49 });
    expect(end.defenderHp).toEqual({ min: 0, max: 0 });
    expect(end.healing).toEqual([]);
  });

  it.each([[1, 16], [2, 8]] as const)('uses generation %i Leech Seed damage', (generation, divisor) => {
    const team = createTeamDraft(generation);
    const field = createBattleFieldDraft(generation);
    const [end] = buildBattlePlanResults({
      generation,
      attacker: { ...team.attacker, currentHp: 50, item: undefined },
      defender: { ...team.defender, currentHp: 100, item: undefined },
      field: { ...field, defenderSide: { ...field.defenderSide, isSeeded: true } },
      actions: [{ id: 'end', actor: 'attacker', type: 'end-turn' }],
    });
    const amount = Math.floor(end.maxHp.defender / divisor);
    expect(end.attackerHp).toEqual({ min: 50 + amount, max: 50 + amount });
    expect(end.defenderHp).toEqual({ min: 100 - amount, max: 100 - amount });
  });

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
    const alternateDefender = { ...defender, name: 'Alternate', species: 'Charizard', currentHp: 0 };
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
    expect(results[1].defenderHp).toEqual({
      min: results[1].maxHp.defender,
      max: results[1].maxHp.defender,
    });
    expect(results[2].cumulativeDamage.max).toBeGreaterThan(results[0].cumulativeDamage.max);
    expect(results[3].activePokemonId).toBe('d');
    expect(results[3].targetHp).toEqual(results[0].defenderHp);
  });

  it('skips residual damage on the end marker of a forced post-KO switch', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100, moves: ['Thunderbolt'] };
    const defender = { ...team.defender, currentHp: 100, moves: ['Tackle'] };
    const alternate = { ...defender, name: 'Alternate', species: 'Charizard', currentHp: 0 };
    const field = { ...createBattleFieldDraft(9), weather: 'Sand' as const };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field,
      attackerRoster: [{ id: 'a', label: 'Attacker', source: 'party', combatant: attacker, moves: [] }],
      defenderRoster: [
        { id: 'd', label: 'Defender', source: 'trainer', combatant: defender, moves: [] },
        { id: 'alt', label: 'Alternate', source: 'trainer', combatant: alternate, moves: [] },
      ],
      attackerRosterId: 'a',
      defenderRosterId: 'd',
      actions: [
        { id: 'faint', actor: 'defender', type: 'state', hp: 0 },
        { id: 'switch', actor: 'defender', type: 'switch', targetPokemonId: 'alt' },
        { id: 'end', actor: 'attacker', type: 'end-turn', replacement: true },
      ],
    });

    expect(results[2].residual).toBeUndefined();
    expect(results[2].isKo).toBe(false);
    expect(results[2].defenderHp.max).toBe(results[2].maxHp.defender);
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

  it('makes a successful Fake Out prevent the target from moving that turn', () => {
    const team = createTeamDraft(9);
    const fakeOut = {
      name: 'Fake Out',
      isCrit: false,
      hits: 1,
      isStellarFirstUse: false,
      timesUsed: 1,
    };
    const tackle = {
      name: 'Tackle',
      isCrit: false,
      hits: 1,
      isStellarFirstUse: false,
      timesUsed: 1,
    };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker: { ...team.attacker, currentHp: 100, moves: ['Fake Out'] },
      defender: { ...team.defender, currentHp: 100, moves: ['Tackle'] },
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'fake-out', actor: 'attacker', type: 'move', move: fakeOut },
        { id: 'tackle', actor: 'defender', type: 'move', move: tackle },
      ],
    });

    expect(results[0].damage.max).toBeGreaterThan(0);
    expect(
      results[1].action.type === 'move' && results[1].action.move.skipped,
    ).toBe(true);
    expect(results[1].damage).toEqual({ min: 0, max: 0 });
    expect(results[1].itemEvents).toContain(
      'Defender: flinched and could not move',
    );
  });

  it.each(['Inner Focus', 'Shield Dust'])(
    'does not make Fake Out flinch a target with %s',
    (ability) => {
      const team = createTeamDraft(9);
      const fakeOut = {
        name: 'Fake Out',
        isCrit: false,
        hits: 1,
        isStellarFirstUse: false,
        timesUsed: 1,
      };
      const tackle = {
        name: 'Tackle',
        isCrit: false,
        hits: 1,
        isStellarFirstUse: false,
        timesUsed: 1,
      };
      const results = buildBattlePlanResults({
        generation: 9,
        attacker: { ...team.attacker, currentHp: 100, moves: ['Fake Out'] },
        defender: {
          ...team.defender,
          currentHp: 100,
          ability,
          moves: ['Tackle'],
        },
        field: createBattleFieldDraft(9),
        actions: [
          { id: 'fake-out', actor: 'attacker', type: 'move', move: fakeOut },
          { id: 'tackle', actor: 'defender', type: 'move', move: tackle },
        ],
      });

      expect(
        results[1].action.type === 'move' && results[1].action.move.skipped,
      ).not.toBe(true);
      expect(results[1].damage.max).toBeGreaterThan(0);
    },
  );

  it('clears Fake Out flinch at the end of the turn', () => {
    const team = createTeamDraft(9);
    const fakeOut = {
      name: 'Fake Out',
      isCrit: false,
      hits: 1,
      isStellarFirstUse: false,
      timesUsed: 1,
    };
    const tackle = {
      name: 'Tackle',
      isCrit: false,
      hits: 1,
      isStellarFirstUse: false,
      timesUsed: 1,
    };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker: { ...team.attacker, currentHp: 100, moves: ['Fake Out'] },
      defender: { ...team.defender, currentHp: 100, moves: ['Tackle'] },
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'fake-out', actor: 'attacker', type: 'move', move: fakeOut },
        { id: 'end-turn', actor: 'attacker', type: 'end-turn' },
        {
          id: 'next-turn-tackle',
          actor: 'defender',
          type: 'move',
          move: tackle,
        },
      ],
    });

    expect(
    results[2].action.type === 'move' && results[2].action.move.skipped,
    ).not.toBe(true);
    expect(results[2].damage.max).toBeGreaterThan(0);
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

  it('fails Belch until the user has eaten a Berry', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, moves: ['Tackle'] };
    const defender = { ...team.defender, currentHp: 0, item: 'Leftovers', moves: ['Belch'] };
    const belch = { name: 'Belch', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const field = createBattleFieldDraft(9);
    const unavailable = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field,
      actions: [{ id: 'belch', actor: 'defender', type: 'move', move: belch }],
    })[0];
    const afterBerry = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender: { ...defender, item: 'Kee Berry' },
      field,
      actions: [
        {
          id: 'hit',
          actor: 'attacker',
          type: 'move',
          move: { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 },
        },
        { id: 'belch', actor: 'defender', type: 'move', move: belch },
      ],
    });

    expect(unavailable.damage).toEqual({ min: 0, max: 0 });
    expect(unavailable.itemEvents.join(' ')).toContain('Belch failed because no Berry has been eaten');
    expect(afterBerry[0].items['initial-defender']).toBe('consumed');
    expect(afterBerry[0].eatenBerries['initial-defender']).toBe('yes');
    expect(afterBerry[1].damage.max).toBeGreaterThan(0);
  });

  it('includes a failed Belch when a Berry was only possibly eaten', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, moves: ['Tackle'] };
    const defender = { ...team.defender, currentHp: 0, item: 'Sitrus Berry', moves: ['Belch'] };
    const tackle = { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const belch = { ...tackle, name: 'Belch' };
    const field = createBattleFieldDraft(9);
    const probe = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender: { ...defender, item: undefined },
      field,
      actions: [{ id: 'probe', actor: 'attacker', type: 'move', move: tackle }],
    })[0];
    const hpBeforeHit = Math.floor(probe.maxHp.defender / 2) + probe.damage.max;
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field,
      actions: [
        { id: 'set-hp', actor: 'defender', type: 'state', hp: hpBeforeHit },
        { id: 'hit', actor: 'attacker', type: 'move', move: tackle },
        { id: 'belch', actor: 'defender', type: 'move', move: belch },
      ],
    });

    expect(results[1].items['initial-defender']).toBe('maybe-consumed');
    expect(results[1].eatenBerries['initial-defender']).toBe('maybe');
    expect(results[2].damage.min).toBe(0);
    expect(results[2].damage.max).toBeGreaterThan(0);
  });

  it('consumes a Berry used by Natural Gift without counting it as eaten', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, item: 'Oran Berry', moves: ['Natural Gift', 'Belch'] };
    const defender = { ...team.defender, currentHp: 0, moves: ['Tackle'] };
    const gift = { name: 'Natural Gift', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const belch = { ...gift, name: 'Belch' };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'gift', actor: 'attacker', type: 'move', move: gift },
        { id: 'belch', actor: 'attacker', type: 'move', move: belch },
      ],
    });

    expect(results[0].damage.max).toBeGreaterThan(0);
    expect(results[0].items['initial-attacker']).toBe('consumed');
    expect(results[0].eatenBerries['initial-attacker']).toBeUndefined();
    expect(results[1].damage).toEqual({ min: 0, max: 0 });
  });

  it('consumes a Fling item and lets Recycle restore it for a later move', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, item: 'Sitrus Berry', moves: ['Fling', 'Recycle'] };
    const defender = { ...team.defender, currentHp: 0, moves: ['Tackle'] };
    const fling = { name: 'Fling', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const belch = { ...fling, name: 'Belch' };
    const recycle = { ...fling, name: 'Recycle' };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'fling', actor: 'attacker', type: 'move', move: fling },
        { id: 'belch', actor: 'attacker', type: 'move', move: belch },
        { id: 'recycle', actor: 'attacker', type: 'move', move: recycle },
        { id: 'fling-again', actor: 'attacker', type: 'move', move: fling },
      ],
    });

    expect(results[0].items['initial-attacker']).toBe('consumed');
    expect(results[1].damage).toEqual({ min: 0, max: 0 });
    expect(results[2].items['initial-attacker']).toBe('held');
    expect(results[3].damage.max).toBeGreaterThan(0);
    expect(results[3].items['initial-attacker']).toBe('consumed');
  });

  it('eats the user Berry with Stuff Cheeks and raises Defense', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, item: 'Kee Berry', moves: ['Stuff Cheeks', 'Belch'] };
    const defender = { ...team.defender, currentHp: 0, moves: ['Tackle'] };
    const cheeks = { name: 'Stuff Cheeks', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const belch = { ...cheeks, name: 'Belch' };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'cheeks', actor: 'attacker', type: 'move', move: cheeks },
        { id: 'belch', actor: 'attacker', type: 'move', move: belch },
      ],
    });

    expect(results[0].items['initial-attacker']).toBe('consumed');
    expect(results[0].boosts['initial-attacker'].def).toBe(2);
    expect(results[1].damage.max).toBeGreaterThan(0);
  });

  it('makes Teatime consume berries held by both active Pokemon', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, item: 'Oran Berry', moves: ['Teatime'] };
    const defender = { ...team.defender, currentHp: 0, item: 'Sitrus Berry', moves: ['Belch'] };
    const teatime = { name: 'Teatime', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const belch = { ...teatime, name: 'Belch' };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'tea', actor: 'attacker', type: 'move', move: teatime },
        { id: 'belch', actor: 'defender', type: 'move', move: belch },
      ],
    });

    expect(results[0].items['initial-attacker']).toBe('consumed');
    expect(results[0].items['initial-defender']).toBe('consumed');
    expect(results[1].damage.max).toBeGreaterThan(0);
  });

  it.each(['Bug Bite', 'Pluck'])('%s eats the target Berry and applies its effect to the user', (name) => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 0, moves: [name, 'Belch'] };
    const defender = { ...team.defender, currentHp: 0, item: 'Salac Berry', moves: ['Tackle'] };
    const bite = { name, isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const belch = { ...bite, name: 'Belch' };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'bite', actor: 'attacker', type: 'move', move: bite },
        { id: 'belch', actor: 'attacker', type: 'move', move: belch },
      ],
    });

    expect(results[0].items['initial-defender']).toBe('consumed');
    expect(results[0].boosts['initial-attacker'].spe).toBe(1);
    expect(results[1].damage.max).toBeGreaterThan(0);
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

  it('records healing from a berry triggered by a hit', () => {
    const team = createTeamDraft(9);
    const attacker = { ...team.attacker, currentHp: 100 };
    const defender = { ...team.defender, currentHp: 100, item: 'Oran Berry' };
    const move = { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 };
    const results = buildBattlePlanResults({
      generation: 9,
      attacker,
      defender,
      field: createBattleFieldDraft(9),
      actions: [
        { id: 'hit', actor: 'attacker', type: 'move', move },
        { id: 'end', actor: 'attacker', type: 'end-turn' },
      ],
    });

    expect(results[0].healing).toContainEqual({
      pokemonId: 'initial-defender',
      source: 'Oran Berry',
      amount: { min: 10, max: 10 },
    });
    expect(results[0].defenderHp).toEqual({
      min: 100 - results[0].damage.max + 10,
      max: 100 - results[0].damage.min + 10,
    });
    expect(results[1].healing).toEqual([]);
  });

  it('records capped end-of-turn recovery', () => {
    const team = createTeamDraft(9);
    const base = {
      generation: 9 as const,
      attacker: { ...team.attacker, item: 'Leftovers', currentHp: 100 },
      defender: team.defender,
      field: createBattleFieldDraft(9),
    };
    const [probe] = buildBattlePlanResults({
      ...base,
      actions: [{ id: 'end', actor: 'attacker', type: 'end-turn' }],
    });
    const [result] = buildBattlePlanResults({
      ...base,
      attacker: { ...base.attacker, currentHp: probe.maxHp.attacker - 1 },
      actions: [{ id: 'end', actor: 'attacker', type: 'end-turn' }],
    });

    expect(result.healing).toContainEqual({
      pokemonId: 'initial-attacker',
      source: 'Leftovers',
      amount: { min: 1, max: 1 },
    });
  });

  it('does not report berry healing when the hit is a knockout', () => {
    const team = createTeamDraft(9);
    const [result] = buildBattlePlanResults({
      generation: 9,
      attacker: team.attacker,
      defender: { ...team.defender, currentHp: 1, item: 'Oran Berry' },
      field: createBattleFieldDraft(9),
      actions: [{
        id: 'hit',
        actor: 'attacker',
        type: 'move',
        move: { name: 'Tackle', isCrit: false, hits: 1, isStellarFirstUse: false, timesUsed: 1 },
      }],
    });

    expect(result.isKo).toBe(true);
    expect(result.healing).toEqual([]);
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
    expect(result.healing).toContainEqual({
      pokemonId: 'initial-defender',
      source: 'Sitrus Berry',
      amount: { min: 0, max: Math.floor(maxHp / 4) },
    });
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