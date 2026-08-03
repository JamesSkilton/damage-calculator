import { describe, expect, it } from 'vitest';
import {
  createTeamDraft,
  setCombatantField,
  setCombatantMove,
  setCombatantStat,
  setCombatantStatus,
  setCombatantTypes,
  setTeamGeneration,
  toLegacyPokemonInput,
  statIds,
} from './combatantDraft';

describe('combatantDraft', () => {
  it('creates independent attacker and defender defaults', () => {
    const draft = createTeamDraft(9);

    expect(draft.attacker).toMatchObject({
      generation: 9,
      name: 'Attacker',
      species: 'Pikachu',
      level: 100,
      gender: 'M',
      ability: 'Static',
      item: 'Choice Band',
      nature: 'Adamant',
      currentHp: 100,
      toxicCounter: 0,
      abilityOn: false,
      isDynamaxed: false,
      teratype: 'Electric',
    });
    expect(draft.defender).toMatchObject({
      generation: 9,
      name: 'Defender',
      species: 'Bulbasaur',
      level: 100,
      gender: 'F',
      ability: 'Overgrow',
      item: 'Eviolite',
      nature: 'Bold',
      currentHp: 100,
      toxicCounter: 0,
      abilityOn: false,
      isDynamaxed: false,
      teratype: 'Grass',
    });
    expect(draft.attacker).not.toBe(draft.defender);
    expect(draft.attacker.ivs).not.toBe(draft.defender.ivs);
    expect(draft.attacker.evs).not.toBe(draft.defender.evs);
    expect(draft.attacker.boosts).not.toBe(draft.defender.boosts);
    expect(draft.attacker.moves).not.toBe(draft.defender.moves);
  });

  it('updates a single combatant field without mutating the original draft', () => {
    const draft = createTeamDraft(9);
    const nextAttacker = setCombatantField(draft.attacker, 'generation', 6);

    expect(nextAttacker.generation).toBe(6);
    expect(draft.attacker.generation).toBe(9);

    const nextDraft = setTeamGeneration(draft, 8);

    expect(nextDraft.attacker.generation).toBe(8);
    expect(nextDraft.defender.generation).toBe(8);
    expect(draft.attacker.generation).toBe(9);
    expect(draft.defender.generation).toBe(9);
  });

  it('preserves side-specific edits and panel edge cases', () => {
    const draft = createTeamDraft(9);

    const renamed = setCombatantField(draft.attacker, 'name', 'Raichu');
    const typed = setCombatantTypes(renamed, 'Electric');
    const retrained = setCombatantStat(typed, 'ivs', statIds[1], 0);
    const boosted = setCombatantStat(retrained, 'boosts', statIds[1], 2);
    const moved = setCombatantMove(boosted, 2, 'Thunderbolt');
    const statused = setCombatantStatus(moved, '');

    expect(renamed.name).toBe('Raichu');
    expect(typed.types).toEqual(['Electric']);
    expect(retrained.ivs.atk).toBe(0);
    expect(boosted.boosts.atk).toBe(2);
    expect(moved.moves[2]).toBe('Thunderbolt');
    expect(moved.moves[0]).toBe('');
    expect(statused.status).toBeUndefined();
    expect(draft.attacker.name).toBe('Attacker');
  });

  it('maps combatant drafts to legacy-compatible inputs', () => {
    const draft = createTeamDraft(9);
    const legacy = toLegacyPokemonInput({
      ...draft.attacker,
      ability: 'Static',
      item: 'Light Ball',
      moves: ['Thunderbolt', '', 'Protect', ''],
    });

    expect(legacy).toMatchObject({
      name: 'Attacker',
      ability: 'Static',
      item: 'Light Ball',
      moves: ['Thunderbolt', 'Protect'],
    });
  });
});
