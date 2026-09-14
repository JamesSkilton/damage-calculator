import { useMemo } from 'react';
import type { ImportedPokemonSet } from '../../import/pokemonSet';
import { loadPartyPokemonSetIds } from '../../import/pokemonSetStorage';
import PokemonSprite from '../shared/PokemonSprite';
import TypeBadges from '../combatant/shared/TypeBadges';
import { buildSpeciesCatalog } from '../combatant/species/speciesCatalog';
import type { SpeciesOption } from '../combatant/species/speciesOptions';
import './PartyPicker.scss';

type PartyPickerProps = {
  importedSets: ImportedPokemonSet[];
  onSelectSet: (set: ImportedPokemonSet) => void;
};

function displayName(set: ImportedPokemonSet): string {
  return set.nickname || set.species;
}

export default function PartyPicker({
  importedSets,
  onSelectSet,
}: PartyPickerProps) {
  const partyIds = loadPartyPokemonSetIds();
  const species = useMemo<SpeciesOption[]>(() => buildSpeciesCatalog(9), []);
  const typesBySpecies = useMemo(
    () => new Map(species.map((option) => [option.name, option.types])),
    [species],
  );
  const partySets = partyIds
    .map((id) => importedSets.find((set) => set.id === id))
    .filter((set): set is ImportedPokemonSet => Boolean(set));

  return (
    <section className="party-picker" aria-labelledby="party-picker-title">
      <div className="party-picker-heading">
        <div>
          <h2 id="party-picker-title">Attacker party</h2>
        </div>
        <span>Click a Pokemon to load it into the attacker</span>
      </div>
      {partySets.length === 0 ? (
        <p className="party-picker-empty">
          Add imported sets to your party below to switch attackers quickly.
        </p>
      ) : (
        <div className="party-picker-list">
          {partySets.map((set) => (
            <button
              key={set.id}
              type="button"
              className="party-picker-card"
              onClick={() => onSelectSet(set)}
              aria-label={`Load ${displayName(set)} into attacker`}
            >
              <PokemonSprite name={set.species} alt="" />
              <span className="party-picker-card-copy">
                <strong>{displayName(set)}</strong>
                <span>{set.nickname ? set.species : `Lv. ${set.level}`}</span>
                <TypeBadges types={typesBySpecies.get(set.species) ?? []} />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
