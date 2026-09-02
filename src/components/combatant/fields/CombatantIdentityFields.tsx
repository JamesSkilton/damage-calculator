import type { BattleCombatant, BattleTypeName } from 'domain/index';
import { setCombatantField, setCombatantTypes } from '../shared/combatantDraft';
import { battleGenders } from '../shared/combatantPanel.constants';
import type { SpeciesOption } from '../species/speciesOptions';
import SearchablePokemonPicker from '../species/SearchablePokemonPicker';

type CombatantIdentityFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
  availableSpecies?: SpeciesOption[];
};

export default function CombatantIdentityFields({
  combatant,
  onChange,
  availableSpecies = [],
}: CombatantIdentityFieldsProps) {
  return (
    <>
      <label className="combatant-field">
        <span>Pokémon</span>
        <SearchablePokemonPicker
          value={combatant.species}
          options={availableSpecies}
          onSelect={(species) => {
            const withSpecies = setCombatantField(
              combatant,
              'species',
              species,
            );
            const withName = setCombatantField(withSpecies, 'name', species);

            const matchedSpecies = availableSpecies.find(
              (option) => option.name === species,
            );
            if (!matchedSpecies) {
              onChange(withName);
              return;
            }

            const [primaryType, secondaryType] = matchedSpecies.types as [
              BattleTypeName,
              BattleTypeName | undefined,
            ];
            onChange(setCombatantTypes(withName, primaryType, secondaryType));
          }}
          ariaLabel="Pokémon species"
          placeholder="— Select a Pokémon —"
        />
      </label>
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
        <input
          type="text"
          value={combatant.ability ?? ''}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'ability', event.target.value),
            )
          }
        />
      </label>
      <label className="combatant-field">
        <span>Item</span>
        <input
          type="text"
          value={combatant.item ?? ''}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'item', event.target.value))
          }
        />
      </label>
      <label className="combatant-field">
        <span>Nature</span>
        <input
          type="text"
          value={combatant.nature}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'nature', event.target.value))
          }
        />
      </label>
    </>
  );
}
