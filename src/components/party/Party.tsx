import { useEffect, useMemo, useState } from 'react';
import type { SpeciesOption } from '../combatant/species/speciesOptions';
import { buildSpeciesCatalog } from '../combatant/species/speciesCatalog';
import TypeBadges from '../combatant/shared/TypeBadges';
import PokemonSprite from '../shared/PokemonSprite';
import type { ImportedPokemonSet } from '../../import/pokemonSet';
import {
  loadPartyPokemonSetIds,
  savePartyPokemonSetIds,
} from '../../import/pokemonSetStorage';
import './Party.scss';

const PARTY_LIMIT = 6;

type PartyProps = {
  importedSets: ImportedPokemonSet[];
  onDeleteSet: (id: string) => void;
  onSelectSet: (set: ImportedPokemonSet) => void;
  onPartyChange?: () => void;
};

function displayName(set: ImportedPokemonSet): string {
  return set.nickname || set.species;
}

export default function Party({
  importedSets,
  onDeleteSet,
  onSelectSet,
  onPartyChange,
}: PartyProps) {
  const [partyIds, setPartyIds] = useState<string[]>(() =>
    loadPartyPokemonSetIds(),
  );
  const [draggedSetId, setDraggedSetId] = useState<string>();
  const [draggedFromParty, setDraggedFromParty] = useState(false);
  const species = useMemo<SpeciesOption[]>(() => buildSpeciesCatalog(9), []);
  const typesBySpecies = useMemo(
    () => new Map(species.map((option) => [option.name, option.types])),
    [species],
  );

  useEffect(() => {
    const validIds = partyIds.filter((id) => importedSets.some((set) => set.id === id));
    if (validIds.length !== partyIds.length) {
      setPartyIds(validIds);
      savePartyPokemonSetIds(validIds);
    }
  }, [importedSets, partyIds]);

  const partySets = partyIds
    .map((id) => importedSets.find((set) => set.id === id))
    .filter((set): set is ImportedPokemonSet => Boolean(set));

  const toggleParty = (id: string) => {
    setPartyIds((current) => {
      const next = current.includes(id)
        ? current.filter((partyId) => partyId !== id)
        : current.length < PARTY_LIMIT
          ? [...current, id]
          : current;
      savePartyPokemonSetIds(next);
      onPartyChange?.();
      return next;
    });
  };

  const deleteSet = (id: string) => {
    setPartyIds((current) => {
      const next = current.filter((partyId) => partyId !== id);
      savePartyPokemonSetIds(next);
      onPartyChange?.();
      return next;
    });
    onDeleteSet(id);
  };

  const startDrag = (id: string, fromParty: boolean) => {
    setDraggedSetId(id);
    setDraggedFromParty(fromParty);
  };

  const finishDrag = () => {
    setDraggedSetId(undefined);
    setDraggedFromParty(false);
  };

  const addDraggedSetToParty = () => {
    if (!draggedSetId || draggedFromParty) return;
    setPartyIds((current) => {
      if (current.includes(draggedSetId) || current.length >= PARTY_LIMIT) {
        return current;
      }
      const next = [...current, draggedSetId];
      savePartyPokemonSetIds(next);
      onPartyChange?.();
      return next;
    });
  };

  const removeDraggedSetFromParty = () => {
    if (!draggedSetId || !draggedFromParty) return;
    setPartyIds((current) => {
      const next = current.filter((id) => id !== draggedSetId);
      savePartyPokemonSetIds(next);
      onPartyChange?.();
      return next;
    });
  };

  return (
    <section className="party-screen" aria-labelledby="party-title">
      <header className="party-header">
        <div>
          <p className="party-kicker">Imported Pokemon</p>
          <h2 id="party-title">Party</h2>
          <p>Select up to six imported sets for your active party.</p>
        </div>
        <strong className="party-count" aria-label={`${partySets.length} of ${PARTY_LIMIT} party slots selected`}>
          {partySets.length}/{PARTY_LIMIT}
        </strong>
      </header>

      <section className="party-roster" aria-labelledby="party-roster-title">
        <div className="party-section-heading">
          <h3 id="party-roster-title">Your party</h3>
          <span>{partySets.length === PARTY_LIMIT ? 'Party full' : `${PARTY_LIMIT - partySets.length} slots open`}</span>
        </div>
        <div className="party-slots">
          {Array.from({ length: PARTY_LIMIT }, (_, index) => {
            const set = partySets[index];
            return set ? (
              <div
                key={set.id}
                className="party-slot filled"
                draggable
                onDragStart={() => startDrag(set.id, true)}
                onDragEnd={finishDrag}
              >
                <button type="button" className="party-slot-select" onClick={() => onSelectSet(set)} aria-label={`Load ${displayName(set)} into attacker`}>
                  <PokemonSprite name={set.species} alt="" />
                  <span>{displayName(set)}</span>
                </button>
                <button type="button" className="party-slot-remove" onClick={() => toggleParty(set.id)} aria-label={`Remove ${displayName(set)} from party`}>
                  Remove
                </button>
              </div>
            ) : (
              <div
                key={`empty-${index}`}
                className="party-slot empty"
                aria-label={`Empty party slot ${index + 1}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  addDraggedSetToParty();
                  finishDrag();
                }}
              >
                <span>+</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="party-box" aria-labelledby="party-box-title">
        <div className="party-section-heading">
          <h3 id="party-box-title">Pokemon box</h3>
          <span>{importedSets.length} imported</span>
        </div>
        {importedSets.length === 0 ? (
          <p className="party-empty">Import Pokemon sets from the One vs One calculator to see them here.</p>
        ) : (
          <div
            className="party-grid"
            onDragOver={(event) => {
              if (draggedFromParty) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              removeDraggedSetFromParty();
              finishDrag();
            }}
          >
            {importedSets.map((set) => {
              const isSelected = partyIds.includes(set.id);
              const types = typesBySpecies.get(set.species) ?? [];
              return (
                <article
                  key={set.id}
                  className={`party-card${isSelected ? ' selected' : ''}`}
                  draggable
                  onDragStart={() => startDrag(set.id, isSelected)}
                  onDragEnd={finishDrag}
                >
                  <button type="button" className="party-card-select" onClick={() => onSelectSet(set)}>
                    <PokemonSprite name={set.species} alt="" />
                    <strong>{displayName(set)}</strong>
                    <span>{set.nickname ? set.species : `Lv. ${set.level}`}</span>
                    <TypeBadges types={types} />
                  </button>
                  <button type="button" className="party-card-party-toggle" onClick={() => toggleParty(set.id)} disabled={!isSelected && partyIds.length >= PARTY_LIMIT}>
                    {isSelected ? 'Remove from party' : 'Add to party'}
                  </button>
                  <button type="button" className="party-card-delete" onClick={() => deleteSet(set.id)} aria-label={`Delete ${displayName(set)}`}>
                    Delete
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}