import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppShellContext } from '../AppShell';
import CombatantPanel from '../combatant/CombatantPanel';
import {
  createTeamDraft,
  setTeamGeneration,
} from '../combatant/shared/combatantDraft';
import { createBattleFieldDraft } from '../combatant/shared/battleFieldDraft';
import {
  createCombatantMovesState,
  applyCombatantMovesGeneration,
  setCombatantMoveSlot,
} from '../combatant/moves/combatantMovesState';
import { createMoveDraft, setMoveName, setMoveCrit } from '../combatant/moves/moveDraft';
import { applyImportedPokemonSet } from '../combatant/shared/combatantDraft';
import { parsePokemonSets } from '../../import/pokemonSetParser';
import { runtimeConfig } from '../../config/runtimeConfig';
import { createHttpPresetLibraryRepository } from '../../presets/remote/httpRepository';
import { useUserPresetLibrary } from '../../presets/remote/useUserPresetLibrary';
import { applyLibraryBaseStats } from '../../presets/baseStats';
import { groupPresetsByTrainer } from '../preset-manager/presetManagerUtils';
import { Link } from 'react-router-dom';
import { serializePokemonSet } from '../../import/pokemonSetSerializer';
import {
  loadImportedPokemonSets,
  loadPartyPokemonSetIds,
  removeImportedPokemonSet,
  saveImportedPokemonSets,
} from '../../import/pokemonSetStorage';
import type { ImportedPokemonSet } from '../../import/pokemonSet';
import type {
  PokemonPreset,
} from '../../import/legacySets/legacyPresetCatalog';
import {
  getPresetTrainerGroups,
  getPokemonPresets,
} from '../../import/legacySets/legacyPresetCatalog';
import { buildMoveCatalog } from '../combatant/moves/moveCatalog';
import { buildSpeciesCatalog } from '../combatant/species/speciesCatalog';
import BattleFieldControls from './BattleFieldControls';
import PokemonSetTools from './PokemonSetTools';
import BattleResultPanel from './BattleResultPanel';
import BattlePlanner from '../battle-planner/BattlePlanner';
import type { BattlePlanAction, BattlePlanRosterEntry } from 'domain/battlePlan';
import Party from '../party/Party';
import DefenderPresetRoster from './DefenderPresetRoster';
import { buildBattleCalcBreakdowns } from 'adapters/battleCalc';
import { evaluateBoxMatchup, type BoxMatchup } from 'adapters/boxMatchup';
import {
  loadMatchupSettings,
  saveMatchupSettings,
} from '../../import/matchupSettingsStorage';
import './OneVsOneMode.scss';

export default function OneVsOneMode() {
  const {
    generation,
    presetLibraryId,
    isUserLibrarySelected,
    selectedUserLibraryCode,
  } =
    useOutletContext<AppShellContext>();
  const [rawDraft, setDraft] = useState(() => createTeamDraft(generation));
  const [field, setField] = useState(() => createBattleFieldDraft(generation));
  const [attackerMoves, setAttackerMoves] = useState(() =>
    createCombatantMovesState(),
  );
  const [defenderMoves, setDefenderMoves] = useState(() =>
    createCombatantMovesState(),
  );
  const [isResultsSwapped, setIsResultsSwapped] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [plannerActions, setPlannerActions] =   useState<BattlePlanAction[]>([]);
  const [selectedImportedSetIds, setSelectedImportedSetIds] = useState<{
    attacker?: string;
    defender?: string;
  }>({});
  const [selectedPresetIds, setSelectedPresetIds] = useState<{
    attacker?: string;
    defender?: string;
  }>({});
  const [activeTrainerName, setActiveTrainerName] = useState<string>();
  const [importedSets, setImportedSets] = useState<ImportedPokemonSet[]>(() =>
    loadImportedPokemonSets(),
  );
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [exportText, setExportText] = useState('');
  const presetRepository = useMemo(
    () =>
      runtimeConfig.presetApiUrl
        ? createHttpPresetLibraryRepository(runtimeConfig.presetApiUrl)
        : undefined,
    [],
  );
  const userLibrary = useUserPresetLibrary(presetRepository);
  const { openLibrary } = userLibrary;
  const libraryBaseStats = isUserLibrarySelected ? userLibrary.baseStats : undefined;
  // Library base stat overrides are derived per render so they follow the species and library in use.
  const draft = useMemo(
    () => ({
      ...rawDraft,
      attacker: applyLibraryBaseStats(rawDraft.attacker, libraryBaseStats),
      defender: applyLibraryBaseStats(rawDraft.defender, libraryBaseStats),
    }),
    [libraryBaseStats, rawDraft],
  );
  useEffect(() => {
    if (isUserLibrarySelected && selectedUserLibraryCode) {
      void openLibrary(selectedUserLibraryCode);
    }
  }, [isUserLibrarySelected, openLibrary, selectedUserLibraryCode]);
  const selectableSets = useMemo(
    () =>
      isUserLibrarySelected
        ? userLibrary.presets.filter((preset) => preset.generation === generation)
        : importedSets,
    [generation, importedSets, isUserLibrarySelected, userLibrary.presets],
  );
  useEffect(() => {
    setDraft((current) => setTeamGeneration(current, generation));
    setAttackerMoves((current) =>
      applyCombatantMovesGeneration(current, generation),
    );
    setDefenderMoves((current) =>
      applyCombatantMovesGeneration(current, generation),
    );
    setField((current) => ({
      ...current,
      generation,
    }));
    setSelectedPresetIds({});
  }, [generation]);

  const availableMoves = useMemo(
    () => buildMoveCatalog(generation),
    [generation],
  );

  const availableSpecies = useMemo(
    () => buildSpeciesCatalog(generation),
    [generation],
  );

  const presets = useMemo(
    () =>
      isUserLibrarySelected
        ? []
        : getPokemonPresets(presetLibraryId, generation, availableSpecies),
    [availableSpecies, generation, isUserLibrarySelected, presetLibraryId],
  );

  const trainerGroups = useMemo(
    () =>
      isUserLibrarySelected
        ? []
        : getPresetTrainerGroups(presetLibraryId, generation, availableSpecies),
    [availableSpecies, generation, isUserLibrarySelected, presetLibraryId],
  );
  const userTrainerGroups = useMemo(
    () =>
      groupPresetsByTrainer(
        userLibrary.presets.filter((preset) => preset.generation === generation && preset.trainerName),
      ),
    [generation, userLibrary.presets],
  );
  const activeTrainerGroups = isUserLibrarySelected
    ? userTrainerGroups
    : trainerGroups;

  const plannerRosters = useMemo(() => {
    const partyIds = new Set(loadPartyPokemonSetIds());
    const attackerInitialId = selectedImportedSetIds.attacker ?? 'current-attacker';
    const attackerRoster: BattlePlanRosterEntry[] = [
      {
        id: attackerInitialId,
        label: draft.attacker.name || draft.attacker.species,
        source: selectedImportedSetIds.attacker
          ? partyIds.has(selectedImportedSetIds.attacker) ? 'party' : 'box'
          : 'current',
        combatant: draft.attacker,
        moves: attackerMoves.slots,
      },
      ...importedSets
        .filter((set) => set.id !== attackerInitialId)
        .map((set) => ({
          id: set.id,
          label: set.nickname || set.species,
          source: partyIds.has(set.id) ? 'party' : 'box',
          combatant: applyLibraryBaseStats(
            applyImportedPokemonSet(draft.attacker, set, availableSpecies),
            libraryBaseStats,
          ),
          moves: set.moves.map((name) => createMoveDraft(name)),
        })),
    ];

    const activeGroup = activeTrainerGroups.find(
      (group) => group.trainerName === activeTrainerName,
    );
    const defenderInitialId = selectedPresetIds.defender ?? 'current-defender';
    const defenderRoster: BattlePlanRosterEntry[] = [
      {
        id: defenderInitialId,
        label: draft.defender.name || draft.defender.species,
        source: selectedPresetIds.defender ? activeTrainerName ?? 'trainer' : 'current',
        combatant: draft.defender,
        moves: defenderMoves.slots,
      },
      ...(activeGroup?.presets ?? [])
        .filter((preset) => preset.id !== defenderInitialId)
        .map((preset) => ({
          id: preset.id,
          label: `${preset.species} · ${preset.buildName}`,
          source: activeGroup?.trainerName ?? 'trainer',
          combatant: applyLibraryBaseStats(
            applyImportedPokemonSet(draft.defender, preset, availableSpecies),
            libraryBaseStats,
          ),
          moves: preset.moves.map((name) => createMoveDraft(name)),
        })),
    ];

    return {
      attackerRoster,
      defenderRoster,
      attackerInitialId,
      defenderInitialId,
    };
  }, [activeTrainerGroups, activeTrainerName, attackerMoves.slots, availableSpecies, defenderMoves.slots, draft.attacker, draft.defender, importedSets, libraryBaseStats, selectedImportedSetIds.attacker, selectedPresetIds.defender]);

  const [matchupSettings, setMatchupSettings] = useState(() =>
    loadMatchupSettings(),
  );
  const matchupDefender = useMemo(() => {
    const roster = plannerRosters.defenderRoster;
    const switchedTo = isPlannerOpen
      ? plannerActions.reduce<string | undefined>(
          (active, action) =>
            action.actor === 'defender' && action.type === 'switch'
              ? action.targetPokemonId
              : active,
          undefined,
        )
      : undefined;
    const entry =
      roster.find((candidate) => candidate.id === switchedTo) ?? roster[0];
    return {
      label: entry.label,
      combatant: entry.combatant,
      moves: entry.moves,
    };
  }, [isPlannerOpen, plannerActions, plannerRosters.defenderRoster]);

  const boxMatchups = useMemo(() => {
    const target = {
      generation,
      defender: matchupDefender.combatant,
      defenderMoves: matchupDefender.moves,
      field,
    };
    const results = new Map<string, BoxMatchup>();
    for (const set of importedSets) {
      const matchup = evaluateBoxMatchup(
        target,
        {
          combatant: applyLibraryBaseStats(
            applyImportedPokemonSet(draft.attacker, set, availableSpecies),
            libraryBaseStats,
          ),
          moves: set.moves.map((name) => createMoveDraft(name)),
        },
        matchupSettings,
      );
      if (matchup) results.set(set.id, matchup);
    }
    return results;
  }, [availableSpecies, draft.attacker, field, generation, importedSets, libraryBaseStats, matchupDefender, matchupSettings]);

  useEffect(() => {
    setActiveTrainerName((current) =>
      activeTrainerGroups.some((group) => group.trainerName === current)
        ? current
        : activeTrainerGroups[0]?.trainerName,
    );
  }, [activeTrainerGroups]);

  useEffect(() => {
    setSelectedPresetIds({});
    setActiveTrainerName(undefined);
  }, [presetLibraryId]);

  const attackerResults = useMemo(
    () =>
      buildBattleCalcBreakdowns({
        generation,
        attacker: draft.attacker,
        defender: draft.defender,
        field,
        moves: attackerMoves.slots,
      }),
    [attackerMoves.slots, draft.attacker, draft.defender, field, generation],
  );

  const defenderResults = useMemo(
    () =>
      buildBattleCalcBreakdowns({
        generation,
        attacker: draft.defender,
        defender: draft.attacker,
        field,
        moves: defenderMoves.slots,
      }),
    [defenderMoves.slots, draft.attacker, draft.defender, field, generation],
  );

  const displayedAttacker = isResultsSwapped
    ? draft.defender
    : draft.attacker;
  const displayedDefender = isResultsSwapped
    ? draft.attacker
    : draft.defender;
  const displayedMoves = isResultsSwapped
    ? defenderMoves.slots
    : attackerMoves.slots;
  const displayedResults = isResultsSwapped
    ? defenderResults
    : attackerResults;

  const importSets = () => {
    const result = parsePokemonSets(importText, generation);
    setImportErrors(result.errors);
    if (result.sets.length === 0) return;
    const imported = result.sets.map((set, index) => ({
      ...set,
      id: `${set.id}-${Date.now()}-${index}`,
    }));
    setImportedSets((current) => {
      const next = [...current, ...imported];
      saveImportedPokemonSets(next);
      return next;
    });
    setImportText('');
  };

  const selectImportedSet = (role: 'attacker' | 'defender', set: ImportedPokemonSet) => {
    setSelectedImportedSetIds((current) => ({ ...current, [role]: set.id }));
    setSelectedPresetIds((current) => ({ ...current, [role]: undefined }));
    if (role === 'defender' && set.trainerName) {
      setActiveTrainerName(set.trainerName);
    }
    setDraft((current) => ({
      ...current,
      [role]: applyImportedPokemonSet(current[role], set, availableSpecies),
    }));
    const updateMoves = (current: ReturnType<typeof createCombatantMovesState>) => ({
      ...current,
      slots: current.slots.map((slot, index) =>
        setMoveName(slot, set.moves[index] || ''),
      ),
    });
    (role === 'attacker' ? setAttackerMoves : setDefenderMoves)(updateMoves);
  };

  const selectPreset = (role: 'attacker' | 'defender', preset: PokemonPreset) => {
    setExportText('');
    setSelectedPresetIds((current) => ({ ...current, [role]: preset.id }));
    setSelectedImportedSetIds((current) => ({ ...current, [role]: undefined }));
    if (role === 'defender' && preset.trainerName) {
      setActiveTrainerName(preset.trainerName);
    }
    setDraft((current) => ({
      ...current,
      [role]: applyImportedPokemonSet(current[role], preset, availableSpecies),
    }));
    const updateMoves = (current: ReturnType<typeof createCombatantMovesState>) => ({
      ...current,
      slots: current.slots.map((slot, index) =>
        setMoveName(slot, preset.moves[index] || ''),
      ),
    });
    (role === 'attacker' ? setAttackerMoves : setDefenderMoves)(updateMoves);
  };

  const updateImportedSet = (role: 'attacker' | 'defender') => {
    const setId = selectedImportedSetIds[role];
    if (!setId) return;

    const combatant = draft[role];
    const moves = (role === 'attacker' ? attackerMoves : defenderMoves).slots
      .map((slot) => slot.name.trim())
      .filter(Boolean);
    if (userLibrary.presets.some((preset) => preset.id === setId)) {
      void userLibrary.updatePreset(setId, {
        species: combatant.species,
        nickname: combatant.name !== combatant.species ? combatant.name : undefined,
        level: combatant.level,
        gender: combatant.gender,
        ability: combatant.ability,
        item: combatant.item,
        nature: combatant.nature,
        teraType: combatant.teratype,
        evs: combatant.evs,
        ivs: combatant.ivs,
        moves,
      });
      return;
    }
    setImportedSets((current) => {
      const existing = current.find((set) => set.id === setId);
      if (!existing) return current;
      const updated = current.map((set) =>
        set.id === setId
          ? {
              ...set,
              species: combatant.species,
              nickname: combatant.name !== combatant.species ? combatant.name : undefined,
              level: combatant.level,
              gender: combatant.gender,
              ability: combatant.ability,
              item: combatant.item,
              nature: combatant.nature,
              teraType: combatant.teratype,
              evs: combatant.evs,
              ivs: combatant.ivs,
              moves,
            }
          : set,
      );
      saveImportedPokemonSets(updated);
      return updated;
    });
  };

  // Pokémon added from a playthrough save automatically; other sets use the update button.
  useEffect(() => {
    const attackerId = selectedImportedSetIds.attacker;
    if (!attackerId?.startsWith('nuzlocke-')) return;
    const combatant = draft.attacker;
    const moves = attackerMoves.slots.map((slot) => slot.name.trim()).filter(Boolean);
    const fields = {
      species: combatant.species,
      level: combatant.level,
      gender: combatant.gender,
      ability: combatant.ability,
      item: combatant.item,
      nature: combatant.nature,
      teraType: combatant.teratype,
      evs: combatant.evs,
      ivs: combatant.ivs,
      moves,
    };
    const existing = importedSets.find((set) => set.id === attackerId);
    if (!existing) return;
    const unchanged = (Object.keys(fields) as (keyof typeof fields)[]).every(
      (key) => JSON.stringify(existing[key]) === JSON.stringify(fields[key]),
    );
    if (unchanged) return;
    const updated = importedSets.map((set) =>
      set.id === attackerId ? { ...set, ...fields } : set,
    );
    setImportedSets(updated);
    saveImportedPokemonSets(updated);
  }, [attackerMoves.slots, draft.attacker, importedSets, selectedImportedSetIds.attacker]);

  const clearSelectedImportedSet = (role: 'attacker' | 'defender') => {
    setSelectedImportedSetIds((current) => ({
      ...current,
      [role]: undefined,
    }));
  };

  const clearSelectedPreset = (role: 'attacker' | 'defender') => {
    setSelectedPresetIds((current) => ({
      ...current,
      [role]: undefined,
    }));
  };

  const navigateFight = (direction: -1 | 1) => {
    const currentIndex = activeTrainerGroups.findIndex(
      (group) => group.trainerName === activeTrainerName,
    );
    const nextGroup = activeTrainerGroups[currentIndex + direction];
    const nextPreset = nextGroup?.presets[0];
    if (!nextPreset) return;
    if (isUserLibrarySelected) {
      selectImportedSet('defender', nextPreset);
    } else {
      selectPreset('defender', nextPreset);
    }
  };

  const deleteImportedSet = (id: string) => {
    setImportedSets((current) => current.filter((set) => set.id !== id));
    removeImportedPokemonSet(id);
  };

  const exportSet = (role: 'attacker' | 'defender') => {
    const text = serializePokemonSet(role === 'attacker' ? draft.attacker : draft.defender);
    setExportText(text);
    void navigator.clipboard?.writeText(text);
  };

  return (
    <section className="one-vs-one-screen">
      {isPlannerOpen ? (
        <BattlePlanner
          generation={generation}
          attacker={draft.attacker}
          defender={draft.defender}
          field={field}
          availableMoves={availableMoves}
          attackerMoves={attackerMoves.slots}
          defenderMoves={defenderMoves.slots}
          attackerRoster={plannerRosters.attackerRoster}
          defenderRoster={plannerRosters.defenderRoster}
          attackerRosterId={plannerRosters.attackerInitialId}
          defenderRosterId={plannerRosters.defenderInitialId}
          actions={plannerActions}
          onActionsChange={setPlannerActions}
          onBack={() => setIsPlannerOpen(false)}
        />
      ) : (
        <>
          <BattleResultPanel
            title={isResultsSwapped ? 'Defender damage' : 'Attacker damage'}
            attacker={displayedAttacker}
            defender={displayedDefender}
            moves={displayedMoves}
            results={displayedResults}
            availableMoves={availableMoves}
            availableSpecies={availableSpecies}
            onSwapSides={() => setIsResultsSwapped((current) => !current)}
            onTogglePlanner={() => setIsPlannerOpen(true)}
            onAttackerChange={(combatant) =>
              setDraft((current) => ({
                ...current,
                [isResultsSwapped ? 'defender' : 'attacker']: combatant,
              }))
            }
            onDefenderChange={(combatant) =>
              setDraft((current) => ({
                ...current,
                [isResultsSwapped ? 'attacker' : 'defender']: combatant,
              }))
            }
            onMoveNameChange={(slotIndex, moveName) =>
              (isResultsSwapped ? setDefenderMoves : setAttackerMoves)((current) => {
                const existing = current.slots[slotIndex];
                if (!existing) {
                  return current;
                }
                return setCombatantMoveSlot(
                  current,
                  slotIndex,
                  setMoveName(existing, moveName),
                );
              })
            }
            onMoveCritChange={(slotIndex, isCrit) =>
              (isResultsSwapped ? setDefenderMoves : setAttackerMoves)((current) => {
                const existing = current.slots[slotIndex];
                if (!existing) {
                  return current;
                }
                return setCombatantMoveSlot(
                  current,
                  slotIndex,
                  setMoveCrit(existing, isCrit),
                );
              })
            }
          />
        </>
      )}

      <details className="party-manager">
        <summary>Manage party and imported Pokemon</summary>
        <Party
          importedSets={importedSets}
          onDeleteSet={deleteImportedSet}
          onSelectSet={(set) => selectImportedSet('attacker', set)}
          matchups={boxMatchups}
          matchupTargetLabel={matchupDefender.label}
          matchupSettings={matchupSettings}
          onMatchupSettingsChange={(settings) => {
            setMatchupSettings(settings);
            saveMatchupSettings(settings);
          }}
        />
      </details>

      <div className="one-vs-one-panels">
        <CombatantPanel
          title="Attacker panel"
          description="Edit the attacking combatant before calculating damage."
          combatant={draft.attacker}
          onChange={(attacker) =>
            setDraft((current) => ({
              ...current,
              attacker,
            }))
          }
          generation={generation}
          moves={attackerMoves.slots}
          availableMoves={availableMoves}
          availableSpecies={availableSpecies}
          importedSets={selectableSets}
          onImportedSet={(set) => selectImportedSet('attacker', set)}
          onImportedSetCleared={() => clearSelectedImportedSet('attacker')}
          selectedImportedSetId={selectedImportedSetIds.attacker}
          onUpdateImportedSet={() => updateImportedSet('attacker')}
          presets={presets}
          onPreset={(preset) => selectPreset('attacker', preset)}
          onPresetCleared={() => clearSelectedPreset('attacker')}
          selectedPresetId={selectedPresetIds.attacker}
          onMovesChange={(moves) =>
            setAttackerMoves((current) => ({
              ...current,
              slots: moves,
            }))
          }
        />
          <CombatantPanel
            title="Defender panel"
            description="Edit the defending combatant before calculating damage."
            combatant={draft.defender}
            onChange={(defender) => {
              setDraft((current) => ({
                ...current,
                defender,
              }));
              const matchingGroup = activeTrainerGroups.find((group) =>
                group.presets.some((preset) => preset.species === defender.species),
              );
              if (matchingGroup) {
                setActiveTrainerName(matchingGroup.trainerName);
              }
            }}
            generation={generation}
            moves={defenderMoves.slots}
            availableMoves={availableMoves}
            availableSpecies={availableSpecies}
            importedSets={selectableSets}
            onImportedSet={(set) => selectImportedSet('defender', set)}
            onImportedSetCleared={() => clearSelectedImportedSet('defender')}
            selectedImportedSetId={selectedImportedSetIds.defender}
            onUpdateImportedSet={() => updateImportedSet('defender')}
            presets={presets}
            onPreset={(preset) => selectPreset('defender', preset)}
            onPresetCleared={() => clearSelectedPreset('defender')}
            selectedPresetId={selectedPresetIds.defender}
            onMovesChange={(moves) =>
              setDefenderMoves((current) => ({
                ...current,
                slots: moves,
              }))
            }
            presetRoster={(
              <DefenderPresetRoster
                groups={activeTrainerGroups}
                availableSpecies={availableSpecies}
                activeTrainerName={activeTrainerName}
                selectedPresetId={
                  isUserLibrarySelected
                    ? selectedImportedSetIds.defender
                    : selectedPresetIds.defender
                }
                onSelect={(presetId) => {
                  if (isUserLibrarySelected) {
                    const preset = userLibrary.presets.find((entry) => entry.id === presetId);
                    if (preset) {
                      selectImportedSet('defender', preset);
                    }
                  } else {
                    const preset = presets.find((entry) => entry.id === presetId);
                    if (preset) {
                      selectPreset('defender', preset);
                    }
                  }
                }}
                onPreviousFight={() => navigateFight(-1)}
                onNextFight={() => navigateFight(1)}
              />
            )}
            />

          <div className="d-flex gap-3 flex-column">
          <BattleFieldControls
            field={field}
            onChange={setField}
          />
          <PokemonSetTools
            importText={importText}
            onImportTextChange={setImportText}
            onImport={importSets}
            importErrors={importErrors}
            exportText={exportText}
            onExport={exportSet}
            exportDisabledRoles={[
              ...(selectedPresetIds.attacker ? (['attacker'] as const) : []),
              ...(selectedPresetIds.defender ? (['defender'] as const) : []),
            ]}
          />
          {presetRepository && (
            <Link className="btn btn-outline-primary align-self-start" to="/presets">
              Manage user presets
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
