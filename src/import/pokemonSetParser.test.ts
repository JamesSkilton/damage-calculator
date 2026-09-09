import { describe, expect, it } from 'vitest';
import { parsePokemonSets } from './pokemonSetParser';

describe('pokemon set parser', () => {
  it('parses a Showdown set', () => {
    const result = parsePokemonSets(`Abomasnow @ Eject Pack
Ability: Snow Warning
Tera Type: Ghost
EVs: 4 Def / 252 SpA / 252 Spe
Timid Nature
- Leaf Storm
- Blizzard
- Earth Power
- Aurora Veil`);

    expect(result.errors).toEqual([]);
    expect(result.sets[0]).toMatchObject({
      species: 'Abomasnow',
      item: 'Eject Pack',
      ability: 'Snow Warning',
      teraType: 'Ghost',
      nature: 'Timid',
      evs: { def: 4, spa: 252, spe: 252 },
      moves: ['Leaf Storm', 'Blizzard', 'Earth Power', 'Aurora Veil'],
    });
  });

  it('parses multiple sets and reports invalid fields', () => {
    const result = parsePokemonSets('Pikachu\n\nMissingno\n- Nope');
    expect(result.sets).toHaveLength(1);
    expect(result.errors).toEqual([
      'Set 2: unknown species "Missingno".',
    ]);
  });
});