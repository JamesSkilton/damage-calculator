import { useState } from 'react';
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
import type { ImportedPokemonSet } from '../../../import/pokemonSet';
import type { PokemonPreset } from '../../../import/legacySets/legacyPresetCatalog';

type CombatantIdentityFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
  availableSpecies?: SpeciesOption[];
  importedSets?: ImportedPokemonSet[];
  onImportedSet?: (set: ImportedPokemonSet) => void;
  onImportedSetCleared?: () => void;
  selectedImportedSetId?: string;
  onUpdateImportedSet?: () => void;
  presets?: PokemonPreset[];
  onPreset?: (preset: PokemonPreset) => void;
  onPresetCleared?: () => void;
  selectedPresetId?: string;
  showPokemonPicker?: boolean;
  showShiny?: boolean;
  showGender?: boolean;
  showItem?: boolean;
  pokemonPickerOnly?: boolean;
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
  importedSets = [],
  onImportedSet,
  onImportedSetCleared,
  selectedImportedSetId,
  onUpdateImportedSet,
  presets = [],
  onPreset,
  onPresetCleared,
  selectedPresetId,
  showPokemonPicker = true,
  showShiny = true,
  showGender = true,
  showItem = true,
  pokemonPickerOnly = false,
}: CombatantIdentityFieldsProps) {
  const [showOnlyImportedSets, setShowOnlyImportedSets] = useState(false);
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
  const speciesByName = new Map(
    availableSpecies.map((species) => [species.name, species]),
  );
  const presetsBySpecies = new Map<string, PokemonPreset[]>();
  for (const preset of presets) {
    const speciesPresets = presetsBySpecies.get(preset.species) ?? [];
    speciesPresets.push(preset);
    presetsBySpecies.set(preset.species, speciesPresets);
  }
  const speciesNames = Array.from(
    new Set([...speciesByName.keys(), ...presetsBySpecies.keys()]),
  ).sort((left, right) => left.localeCompare(right));
  const pokemonOptions: SpeciesOption[] = [
    ...importedSets.map((set) => ({
      name: `@imported:${set.id}`,
      displayName: `${set.nickname ? `${set.nickname} (${set.species})` : set.species} [Imported]`,
      types: availableSpecies.find((species) => species.name === set.species)?.types ?? [],
      group: 'Imported sets',
      importedSetId: set.id,
    })),
    ...speciesNames.flatMap((speciesName) => {
      const species = speciesByName.get(speciesName);
      const speciesOptions = species
        ? [{ ...species, group: species.name }]
        : [];
      const presetOptions = (presetsBySpecies.get(speciesName) ?? []).map(
        (preset) => ({
          name: `@preset:${preset.id}`,
          displayName: preset.buildName,
          types: species?.types ?? [],
          group: preset.species,
          presetId: preset.id,
        }),
      );
      return [...speciesOptions, ...presetOptions];
    }),
  ];
  const visiblePokemonOptions = showOnlyImportedSets
    ? pokemonOptions.filter((option) => option.importedSetId)
    : pokemonOptions;
  const selectedImportedSet = importedSets.find(
    (set) => set.id === selectedImportedSetId,
  );
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const pokemonPickerValue =
    selectedPreset?.species === combatant.species
      ? `@preset:${selectedPreset.id}`
      : selectedImportedSet?.species === combatant.species
      ? `@imported:${selectedImportedSet.id}`
      : combatant.species;

  return (
    <>
      {showPokemonPicker && (
        <div className="combatant-pokemon-picker">
          <label className="combatant-field">
            <span>Pokémon</span>
            <SearchablePokemonPicker
              value={pokemonPickerValue}
              options={visiblePokemonOptions}
              onSelect={(selection) => {
                const importedSet = importedSets.find(
                  (set) => selection === `@imported:${set.id}`,
                );
                if (importedSet) {
                  onPresetCleared?.();
                  onImportedSet?.(importedSet);
                  return;
                }
                const preset = presets.find(
                  (entry) => selection === `@preset:${entry.id}`,
                );
                if (preset) {
                  onImportedSetCleared?.();
                  onPreset?.(preset);
                  return;
                }
                onImportedSetCleared?.();
                onPresetCleared?.();
                onChange(setCombatantSpecies(combatant, selection, availableSpecies));
              }}
              ariaLabel="Pokémon"
              placeholder="— Select a Pokémon or imported set —"
            />
          </label>
          {(importedSets.length > 0 || (selectedImportedSetId && onUpdateImportedSet)) && (
            <div className="imported-set-actions">
              {importedSets.length > 0 && (
                <label className="form-check d-flex align-items-center gap-2">
                  <input
                    className="form-check-input mt-0"
                    type="checkbox"
                    checked={showOnlyImportedSets}
                    onChange={(event) => setShowOnlyImportedSets(event.target.checked)}
                  />
                  <span className="form-check-label">Only show imported sets</span>
                </label>
              )}
              {selectedImportedSetId && onUpdateImportedSet && (
                <button
                  className="update-imported-set-button"
                  type="button"
                  onClick={onUpdateImportedSet}
                >
                  Save changes
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {!pokemonPickerOnly && (
        <>
          {showGender && (
            <label className="combatant-field col-12 col-md-6 col-xl-3">
              <span className="form-label">Gender</span>
              <select
                className="form-select"
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
          )}
          <label className="combatant-field col-12 col-md-6 col-xl-3">
            <span className="form-label">Level</span>
            <input
              className="form-control"
              type="number"
              min={1}
              max={100}
              value={combatant.level}
              onChange={(event) =>
                onChange(setCombatantField(combatant, 'level', event.target.value))
              }
            />
          </label>
          <label className="combatant-field col-12 col-md-6 col-xl-3">
            <span className="form-label">Ability</span>
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
          {showItem && (
            <label className="combatant-field col-12 col-md-6 col-xl-3">
              <span className="form-label">Item</span>
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
          )}
          <label className="combatant-field col-12 col-md-6 col-xl-3">
            <span className="form-label">Nature</span>
            <select
              className="form-select"
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
          {showShiny && (
            <label className="combatant-checkbox-field form-check col-12 col-md-6 col-xl-3 d-flex align-items-center gap-2">
              <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={combatant.shiny ?? false}
                onChange={(event) =>
                  onChange(
                    setCombatantField(combatant, 'shiny', event.target.checked),
                  )
                }
              />
              <span className="form-check-label">Shiny</span>
            </label>
          )}
        </>
      )}
    </>
  );
}
