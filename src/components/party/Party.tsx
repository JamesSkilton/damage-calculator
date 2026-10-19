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
import {
  describeMatchupBadges,
  type BoxMatchup,
  type MatchupSettings,
  type MatchupTier,
  type SpeedRelation,
} from 'adapters/boxMatchup';

const PARTY_LIMIT = 6;

type PartyProps = {
  importedSets: ImportedPokemonSet[];
  onDeleteSet: (id: string) => void;
  onSelectSet: (set: ImportedPokemonSet) => void;
  onPartyChange?: () => void;
  matchups?: ReadonlyMap<string, BoxMatchup>;
  matchupTargetLabel?: string;
  matchupSettings?: MatchupSettings;
  onMatchupSettingsChange?: (settings: MatchupSettings) => void;
};

const TIER_BACKGROUND: Record<MatchupTier, string> = {
  excellent: 'bg-success-subtle',
  good: 'bg-info-subtle',
  neutral: '',
  poor: 'bg-danger-subtle',
  unknown: '',
};

const SPEED_LABEL: Record<SpeedRelation, string> = {
  faster: 'Outspeeds',
  tie: 'Does not outspeed',
  slower: 'Does not outspeed',
};

function matchupTitle(matchup: BoxMatchup, target?: string): string {
  const parts = [
    `${SPEED_LABEL[matchup.speed]} ${target ?? 'target'} (${matchup.candidateSpeed} vs ${matchup.targetSpeed})`,
  ];
  if (matchup.bestMove && matchup.hitsToKo !== undefined) {
    parts.push(`Best move: ${matchup.bestMove} (${matchup.hitsToKo}HKO)`);
  }
  if (matchup.threatMove && matchup.survivesHits !== undefined) {
    parts.push(
      `Strongest incoming: ${matchup.threatMove} (survives ${matchup.survivesHits})`,
    );
  }
  return parts.join('\n');
}

function displayName(set: ImportedPokemonSet): string {
  return set.nickname || set.species;
}

export default function Party({
  importedSets,
  onDeleteSet,
  onSelectSet,
  onPartyChange,
  matchups,
  matchupTargetLabel,
  matchupSettings,
  onMatchupSettingsChange,
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

      <section className="party-roster" aria-labelledby="party-roster-title">
        <div className="party-section-heading">
          <h3 id="party-roster-title">Your party</h3>
          <span>{partySets.length === PARTY_LIMIT ? 'Party full' : `${PARTY_LIMIT - partySets.length} slots open`}</span>
        </div>
        <div className={`party-slots${draggedSetId && !draggedFromParty ? ' is-dragging-in' : ''}`}>
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
                <button type="button" className="party-slot-remove" onClick={() => toggleParty(set.id)} aria-label={`Remove ${displayName(set)} from party`} title={`Remove ${displayName(set)} from party`}>
                  x
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
        {matchups && matchupSettings && onMatchupSettingsChange && (
          <details className="small">
            <summary>
              Matchups vs {matchupTargetLabel ?? 'current defender'}
            </summary>
            <p className="mb-1">
              A green border means it outspeeds; no green border means it
              doesn’t. Fill: green is excellent, blue is good, red is poor.
            </p>
            <div className="d-flex flex-wrap gap-2">
              {(
                [
                  ['surviveHits', 'Good if survives hits'],
                  ['comboSurviveHits', 'Excellent: survives hits'],
                  ['comboKoHits', 'Excellent: KOs in hits'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="d-flex align-items-center gap-1">
                  <span>{label}</span>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: '4rem' }}
                    min={1}
                    max={10}
                    value={matchupSettings[key]}
                    onChange={(event) => {
                      const value = Math.min(10, Math.max(1, Math.floor(Number(event.target.value)) || 1));
                      onMatchupSettingsChange({ ...matchupSettings, [key]: value });
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
        )}
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
              const matchup = matchups?.get(set.id);
              const badges =
                matchup && matchupSettings
                  ? describeMatchupBadges(matchup, matchupSettings)
                  : [];
              return (
                <article
                  key={set.id}
                  className={`party-card${isSelected ? ' selected' : ''}${
                    matchup
                      ? `${matchup.speed === 'faster' ? ' border-success border-2' : ''} ${TIER_BACKGROUND[matchup.tier]}`
                      : ''
                  }`}
                  title={matchup ? matchupTitle(matchup, matchupTargetLabel) : undefined}
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={`Load ${displayName(set)} into attacker`}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('button')) return;
                    onSelectSet(set);
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectSet(set);
                    }
                  }}
                  onDragStart={() => startDrag(set.id, isSelected)}
                  onDragEnd={finishDrag}
                >
                  <div className="party-card-content">
                    {!isSelected && (
                      <button type="button" className="party-card-party-toggle" onClick={() => toggleParty(set.id)} disabled={partyIds.length >= PARTY_LIMIT} aria-label={`Add ${displayName(set)} to party`} title={`Add ${displayName(set)} to party`}>
                        +
                      </button>
                    )}
                    <button type="button" className="party-card-select" onClick={() => onSelectSet(set)}>
                      <PokemonSprite name={set.species} alt="" />
                    </button>
                    <button type="button" className="party-card-delete" onClick={() => deleteSet(set.id)} aria-label={`Delete ${displayName(set)}`} title={`Delete ${displayName(set)}`}>
                      x
                    </button>
                    <div className="d-flex flex-column align-items-center">
                      <strong>{displayName(set)}</strong>
                      <div className="party-card-meta">
                        <span>{set.nickname ? set.species : `Lv. ${set.level}`}</span>
                        <span className="party-card-types">
                          <TypeBadges types={types} />
                        </span>
                      </div>
                      {badges.length > 0 && (
                        <div className="d-flex flex-wrap justify-content-center gap-1 mt-1">
                          {badges.map((badge, index) => (
                            <span
                              key={`${set.id}-${badge}-${index}`}
                              className="badge text-bg-secondary"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}