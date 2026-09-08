import type { BattleCombatant } from 'domain/index';
import {
  setCombatantField,
  setCombatantSpecies,
} from '../shared/combatantDraft';
import { battleGenders } from '../shared/combatantPanel.constants';
import type { SpeciesOption } from '../species/speciesOptions';
import SearchablePokemonPicker from '../species/SearchablePokemonPicker';
import SearchableTypePicker from '../shared/SearchableTypePicker';
import { Generations } from 'calc-runtime/core/data';

type CombatantIdentityFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
  availableSpecies?: SpeciesOption[];
  showPokemonPicker?: boolean;
};

const STAT_LABELS: Record<string, string> = {
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

function formatNatureLabel(nature: {
  name: string;
  plus?: string;
  minus?: string;
}): string {
  if (!nature.plus || !nature.minus || nature.plus === nature.minus) {
    return nature.name;
  }
  const plus = STAT_LABELS[nature.plus] ?? nature.plus;
  const minus = STAT_LABELS[nature.minus] ?? nature.minus;
  return `${nature.name} (+${plus}, -${minus})`;
}

export default function CombatantIdentityFields({
  combatant,
  onChange,
  availableSpecies = [],
  showPokemonPicker = true,
}: CombatantIdentityFieldsProps) {
  const generation = Generations.get(9);
  const abilities = Array.from(generation.abilities).map((entry) => ({
    name: entry.name,
  }));
  const items = Array.from(generation.items).map((entry) => ({
    name: entry.name,
  }));
  const filterNamedOptions = (
    options: { name: string }[],
    searchTerm: string,
  ) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return normalizedSearch
      ? options.filter((option) =>
          option.name.toLowerCase().includes(normalizedSearch),
        )
      : options;
  };
  const natures = Array.from(generation.natures);

  return (
    <>
      {showPokemonPicker && (
        <label className="combatant-field">
          <span>Pokémon</span>
          <SearchablePokemonPicker
            value={combatant.species}
            options={availableSpecies}
            onSelect={(species) =>
              onChange(
                setCombatantSpecies(combatant, species, availableSpecies),
              )
            }
            ariaLabel="Pokémon species"
            placeholder="— Select a Pokémon —"
          />
        </label>
      )}
      <label className="combatant-field">
        <span>Gender</span>
        <select
          value={combatant.gender ?? 'N'}
          onChange={(event) =>
            onChange(
              setCombatantField(
                combatant,
                'gender',
                event.target.value as (typeof battleGenders)[number],
              ),
            )
          }
        >
          {battleGenders.map((gender) => (
            <option key={gender} value={gender}>
              {gender}
            </option>
          ))}
        </select>
      </label>
      <label className="combatant-field">
        <span>Level</span>
        <input
          type="number"
          min={1}
          max={100}
          value={combatant.level}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'level', event.target.value))
          }
        />
      </label>
      <label className="combatant-field">
        <span>Ability</span>
        <SearchableTypePicker
          value={combatant.ability ?? ''}
          options={abilities}
          onSelect={(ability) =>
            onChange(setCombatantField(combatant, 'ability', ability))
          }
          ariaLabel="Ability"
          placeholder="— Select ability —"
          filterOptions={filterNamedOptions}
          getTypes={() => []}
          emptyMessage="No abilities found"
        />
      </label>
      <label className="combatant-field">
        <span>Item</span>
        <SearchableTypePicker
          value={combatant.item ?? ''}
          options={items}
          onSelect={(item) =>
            onChange(setCombatantField(combatant, 'item', item))
          }
          ariaLabel="Item"
          placeholder="— Select item —"
          filterOptions={filterNamedOptions}
          getTypes={() => []}
          emptyMessage="No items found"
        />
      </label>
      <label className="combatant-field">
        <span>Nature</span>
        <select
          value={combatant.nature}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'nature', event.target.value))
          }
        >
          {natures.map((nature) => (
            <option key={nature.name} value={nature.name}>
              {formatNatureLabel(nature)}
            </option>
          ))}
        </select>
      </label>
      <label className="combatant-field checkbox-field">
        <input
          type="checkbox"
          checked={combatant.shiny ?? false}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'shiny', event.target.checked),
            )
          }
        />
        <span>Shiny</span>
      </label>
    </>
  );
}
