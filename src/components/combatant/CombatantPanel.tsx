import { useState } from 'react';
import type { BattleGeneration } from 'domain/index';
import type { BattleCombatant } from 'domain/index';
import type { MoveOption } from './moves/moveOptions';
import type { MoveDraft } from './moves/moveDraft';
import type { SpeciesOption } from './species/speciesOptions';
import type { ImportedPokemonSet } from '../../import/pokemonSet';
import CombatantBattleStateFields from './fields/CombatantBattleStateFields';
import CombatantIdentityFields from './fields/CombatantIdentityFields';
import CombatantMoveFields from './fields/CombatantMoveFields';
import CombatantStatGrids from './fields/CombatantStatGrids';
import CombatantTypeFields from './fields/CombatantTypeFields';
import { FieldGroup } from './shared/combatantPanel.helpers';
import TypeBadges from './shared/TypeBadges';
import PokemonSprite from '../shared/PokemonSprite';
import './CombatantPanel.scss';

type CombatantPanelProps = {
  title: string;
  description: string;
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
  generation: BattleGeneration;
  moves: readonly MoveDraft[];
  onMovesChange: (moves: readonly MoveDraft[]) => void;
  availableMoves: MoveOption[];
  availableSpecies?: SpeciesOption[];
  importedSets?: ImportedPokemonSet[];
  onImportedSet?: (set: ImportedPokemonSet) => void;
  onImportedSetCleared?: () => void;
  selectedImportedSetId?: string;
  onUpdateImportedSet?: () => void;
};

export default function CombatantPanel({
  title,
  description,
  combatant,
  onChange,
  generation,
  moves,
  onMovesChange,
  availableMoves,
  availableSpecies,
  importedSets = [],
  onImportedSet,
  onImportedSetCleared,
  selectedImportedSetId,
  onUpdateImportedSet,
}: CombatantPanelProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [isChoosingPokemon, setIsChoosingPokemon] = useState(false);
  const role = title.toLowerCase().includes('attacker') ? 'attacker' : 'defender';
  const displayName = combatant.species || combatant.name;

  return (
    <article
      className={`combatant-panel combatant-${role} combatant-mode-${mode}`}
      aria-label={`${title}: ${description}`}
    >
      <div className="combatant-panel-topline">
        <div className="combatant-mode-toggle" role="tablist" aria-label={`${title} view`}>
          {(['simple', 'advanced'] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              role="tab"
              aria-selected={mode === nextMode}
              className={mode === nextMode ? 'active' : ''}
              onClick={() => setMode(nextMode)}
            >
              {nextMode[0].toUpperCase() + nextMode.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <header className="combatant-header combatant-identity-header">
        <div
          key={displayName}
          className="combatant-sprite-placeholder"
        >
          {displayName !== title && (
            <PokemonSprite
              name={displayName}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                const fallback = event.currentTarget.nextElementSibling;
                if (fallback instanceof HTMLElement) {
                  fallback.style.display = 'block';
                }
              }}
            />
          )}
          <span aria-hidden="true">{displayName === title ? '◇' : displayName.slice(0, 1)}</span>
        </div>
        <div className="combatant-identity-copy">
          <h3>{displayName || 'Select a Pokémon'}</h3>
          <div className="combatant-type-summary">
            <TypeBadges types={[...combatant.types]} />
            <span>Lv. {combatant.level}</span>
          </div>
          <p className="combatant-loadout-summary">
            {combatant.nature} · {combatant.ability || 'No ability'} · {combatant.item || 'No item'}
          </p>
        </div>
        <div className="combatant-change-controls">
          {isChoosingPokemon && (
            <CombatantIdentityFields
              combatant={combatant}
              onChange={onChange}
              availableSpecies={availableSpecies}
              importedSets={importedSets}
              onImportedSet={onImportedSet}
              onImportedSetCleared={onImportedSetCleared}
              selectedImportedSetId={selectedImportedSetId}
              onUpdateImportedSet={onUpdateImportedSet}
              pokemonPickerOnly
              showItem
            />
          )}
          <button
            type="button"
            className="change-pokemon-button"
            onClick={() => setIsChoosingPokemon((current) => !current)}
          >
            {isChoosingPokemon ? 'Done' : 'Change Pokémon'}
          </button>
        </div>
      </header>

      {mode === 'simple' ? (
        <>
          <FieldGroup>
            <CombatantIdentityFields combatant={combatant} onChange={onChange} availableSpecies={availableSpecies} importedSets={importedSets} onImportedSet={onImportedSet} onImportedSetCleared={onImportedSetCleared} selectedImportedSetId={selectedImportedSetId} onUpdateImportedSet={onUpdateImportedSet} showPokemonPicker={false} showShiny={false} showGender={false} showItem />
          </FieldGroup>
          <CombatantStatGrids combatant={combatant} onChange={onChange} />
        </>
      ) : (
        <>
          <FieldGroup>
            <CombatantIdentityFields combatant={combatant} onChange={onChange} availableSpecies={availableSpecies} importedSets={importedSets} onImportedSet={onImportedSet} onImportedSetCleared={onImportedSetCleared} selectedImportedSetId={selectedImportedSetId} onUpdateImportedSet={onUpdateImportedSet} showPokemonPicker={false} />
          </FieldGroup>
          <FieldGroup><CombatantTypeFields combatant={combatant} onChange={onChange} /></FieldGroup>
          <FieldGroup><CombatantBattleStateFields combatant={combatant} onChange={onChange} /></FieldGroup>
          <CombatantStatGrids combatant={combatant} onChange={onChange} />
        </>
      )}

      <CombatantMoveFields
        generation={generation}
        moves={moves}
        availableMoves={availableMoves}
        onChange={onMovesChange}
        mode={mode}
        attackerItem={combatant.item}
      />
    </article>
  );
}
