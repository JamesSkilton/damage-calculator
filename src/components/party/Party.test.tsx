import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BoxMatchup } from 'adapters/boxMatchup';
import { emptyStats, type ImportedPokemonSet } from '../../import/pokemonSet';
import Party from './Party';

describe('Pokemon box matchup highlights', () => {
  it('distinguishes KO and speed combinations and prioritizes faster OHKO threats', () => {
    const names = ['Pikachu', 'Raichu', 'Eevee', 'Mew', 'Bulbasaur', 'Squirtle', 'Charmander', 'Pidgey'];
    const sets: ImportedPokemonSet[] = names.map((species) => ({
      id: species,
      species,
      generation: 9,
      level: 50,
      nature: 'Serious',
      evs: emptyStats(0),
      ivs: emptyStats(31),
      moves: [],
    }));
    const matchup = (
      speed: BoxMatchup['speed'],
      hitsToKo?: number,
      survivesHits?: number,
    ): BoxMatchup => ({
      speed,
      candidateSpeed: 100,
      targetSpeed: 100,
      hitsToKo,
      survivesHits,
      tier: 'neutral',
    });
    const markup = renderToStaticMarkup(
      <Party
        importedSets={sets}
        onDeleteSet={() => {}}
        onSelectSet={() => {}}
        matchups={new Map([
          ['Pikachu', matchup('faster', 1, 0)],
          ['Raichu', matchup('tie', 1, 0)],
          ['Eevee', matchup('slower', 2, 1)],
          ['Mew', matchup('faster', 2, 1)],
          ['Bulbasaur', matchup('slower', 1, 0)],
          ['Squirtle', matchup('slower', 3, 1)],
          ['Charmander', matchup('faster', undefined, 0)],
        ])}
        matchupTargetLabel="Charizard"
      />,
    );
    const cards = markup.split('<article').slice(1);
    const card = (name: string) => cards.find((value) =>
      value.includes(`Load ${name} into attacker`),
    ) ?? '';

    expect(markup).toContain('Matchups vs Charizard:');
    expect(markup).toContain('green border = OHKO; blue border = 2HKO; matching fill = also outspeeds');
    expect(card('Pikachu')).toContain('party-card matchup-ohko-fast');
    expect(card('Raichu')).toContain('party-card matchup-ohko');
    expect(card('Eevee')).toContain('party-card matchup-two-hko');
    expect(card('Mew')).toContain('party-card matchup-two-hko-fast');
    expect(card('Bulbasaur')).toContain('party-card matchup-danger');
    expect(card('Squirtle')).toContain('class="party-card"');
    expect(card('Charmander')).toContain('class="party-card"');
    expect(card('Pidgey')).toContain('class="party-card"');
    expect(card('Bulbasaur')).toContain('Opponent is faster and can KO in one hit');
  });
});
