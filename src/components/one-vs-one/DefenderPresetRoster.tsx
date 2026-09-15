import type { PresetTrainerGroup } from '../../import/legacySets/legacyPresetCatalog';
import type { SpeciesOption } from '../combatant/species/speciesOptions';
import TypeBadges from '../combatant/shared/TypeBadges';
import PokemonSprite from '../shared/PokemonSprite';

type DefenderPresetRosterProps = {
  groups: PresetTrainerGroup[];
  availableSpecies: readonly SpeciesOption[];
  activeTrainerName?: string;
  selectedPresetId?: string;
  onSelect: (presetId: string) => void;
};

export default function DefenderPresetRoster({
  groups,
  availableSpecies,
  activeTrainerName,
  selectedPresetId,
  onSelect,
}: DefenderPresetRosterProps) {
  if (groups.length === 0) {
    return null;
  }

  const activeGroup = groups.find(
    (group) => group.trainerName === activeTrainerName,
  ) ?? groups[0];
  const speciesByName = new Map(
    availableSpecies.map((species) => [species.name, species]),
  );

  return (
    <section className="defender-preset-roster" aria-label="Defender trainer roster">
      <div className="defender-preset-roster-header">
        <p className="defender-preset-roster-kicker">Defender roster</p>
      </div>
      <div className="defender-preset-roster-list">
        {activeGroup.presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={preset.id === selectedPresetId ? 'is-selected' : ''}
            aria-pressed={preset.id === selectedPresetId}
            onClick={() => onSelect(preset.id)}
          >
            <span className="defender-preset-roster-card-header">
              <PokemonSprite name={preset.species} alt="" />
              <span className="defender-preset-roster-card-content">
                <span className="defender-preset-roster-card-title">
                  <strong>{preset.species}</strong>
                  <small>Lv. {preset.level}</small>
                  <TypeBadges types={speciesByName.get(preset.species)?.types ?? []} />
                </span>
                <span className="defender-preset-roster-loadout">
                  {preset.ability || 'No ability'} · {preset.item || 'No item'} · {preset.nature}
                </span>
              </span>
            </span>
            {preset.moves.length > 0 && (
              <span className="defender-preset-roster-moves">
                {preset.moves.map((move) => (
                  <span key={move}>{move}</span>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}