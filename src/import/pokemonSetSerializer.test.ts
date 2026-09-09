import { describe, expect, it } from 'vitest';
import { serializePokemonSet } from './pokemonSetSerializer';
import { createTeamDraft } from '../components/combatant/shared/combatantDraft';

describe('pokemon set serializer', () => {
  it('serializes a combatant in Showdown format', () => {
    const combatant = createTeamDraft(9).defender;
    const output = serializePokemonSet({
      ...combatant,
      name: 'Abomasnow',
      species: 'Abomasnow',
      gender: 'N',
      item: 'Eject Pack',
      ability: 'Snow Warning',
      nature: 'Timid',
      teratype: 'Ghost',
      evs: { hp: 0, atk: 0, def: 4, spa: 252, spd: 0, spe: 252 },
      moves: ['Leaf Storm', 'Blizzard', 'Earth Power', 'Aurora Veil'],
    });

    expect(output).toBe(`Abomasnow @ Eject Pack
Ability: Snow Warning
Tera Type: Ghost
EVs: 4 Def / 252 SpA / 252 Spe
Timid Nature
- Leaf Storm
- Blizzard
- Earth Power
- Aurora Veil`);
  });
});