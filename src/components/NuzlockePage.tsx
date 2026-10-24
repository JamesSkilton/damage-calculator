import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { BattleGeneration } from 'domain/index';
import type { AppShellContext } from './AppShell';
import { buildSpeciesCatalog } from './combatant/species/speciesCatalog';
import RunEncounterTable from './nuzlocke/RunEncounterTable';
import { runtimeConfig } from '../config/runtimeConfig';
import { loadPresetLibraryCache } from '../presets/remote/presetLibraryCache';
import { createNuzlockeClient, NuzlockeError } from '../nuzlocke/httpClient';
import {
  ACTIVE_RUN_CHANGED_EVENT,
  activateRun,
  deactivateRun,
  flushBoxSync,
  loadActiveRun,
  notifyActiveRunChanged,
  syncEncountersToBox,
} from '../nuzlocke/activeRun';
import {
  AI_PROFILES,
  AI_PROFILE_LABELS,
  type NuzlockeOverview,
  type NuzlockeRun,
  type RunEncounter,
} from '../nuzlocke/types';

function describe(error: unknown): string {
  return error instanceof NuzlockeError || error instanceof Error
    ? error.message
    : 'Something went wrong.';
}

export default function NuzlockePage() {
  const { generation } = useOutletContext<AppShellContext>();
  const client = useMemo(
    () =>
      runtimeConfig.presetApiUrl
        ? createNuzlockeClient(runtimeConfig.presetApiUrl)
        : undefined,
    [],
  );
  const [library, setLibrary] = useState(() => loadPresetLibraryCache());
  const [activeRunId, setActiveRunId] = useState(() => loadActiveRun()?.runId);
  const [overview, setOverview] = useState<NuzlockeOverview>();
  const [run, setRun] = useState<NuzlockeRun>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const ownerCode = library?.ownerCode;
  const libraryId = library?.snapshot.library.id;

  useEffect(() => {
    const refresh = () => {
      setLibrary(loadPresetLibraryCache());
      setActiveRunId(loadActiveRun()?.runId);
    };
    window.addEventListener('pokemans.preset-library-changed', refresh);
    window.addEventListener(ACTIVE_RUN_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener('pokemans.preset-library-changed', refresh);
      window.removeEventListener(ACTIVE_RUN_CHANGED_EVENT, refresh);
    };
  }, []);

  const guarded = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      setError(undefined);
      try {
        return await action();
      } catch (caught) {
        setError(describe(caught));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!client || !ownerCode) return;
    setOverview(await client.overview(ownerCode));
  }, [client, ownerCode]);

  useEffect(() => {
    setOverview(undefined);
    setRun(undefined);
    if (!client || !ownerCode || !libraryId) return;
    void guarded(async () => {
      await reload();
      const active = loadActiveRun();
      if (active?.libraryId === libraryId)
        setRun(await client.getRun(ownerCode, active.runId));
    });
  }, [client, ownerCode, libraryId, guarded, reload]);

  const speciesOptions = useMemo(
    () =>
      buildSpeciesCatalog((run?.generation ?? generation) as BattleGeneration),
    [run?.generation, generation],
  );

  if (!client) {
    return (
      <section className="card card-body">
        <h2 className="h4">Nuzlocke tracker</h2>
        <p className="mb-0">
          The preset service is not configured. Set{' '}
          <code>VITE_PRESET_API_URL</code> and restart the app.
        </p>
      </section>
    );
  }

  if (!ownerCode) {
    return (
      <section className="card card-body">
        <h2 className="h4">Nuzlocke tracker</h2>
        <p className="mb-0">
          Your Nuzlockes are saved to a preset library. Create or open a library
          you own in the Preset manager first, then come back here.
        </p>
      </section>
    );
  }

  const openRun = (runId: string) =>
    guarded(async () => {
      await flushBoxSync();
      const loaded = await client.getRun(ownerCode, runId);
      if (await activateRun(loaded)) setRun(loaded);
    });

  const createRun = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const gameId = String(data.get('game'));
    const title = String(data.get('title')).trim();
    void guarded(async () => {
      const created = await client.createRun(ownerCode, {
        title,
        gameId,
      });
      await reload();
      await flushBoxSync();
      if (await activateRun(created)) setRun(created);
      form.reset();
    });
  };

  const deleteRun = (id: string, title: string) => {
    if (
      !window.confirm(`Delete "${title}" and its box? This cannot be undone.`)
    )
      return;
    void guarded(async () => {
      if (id === activeRunId) {
        await deactivateRun();
        setRun(undefined);
      }
      await client.deleteRun(ownerCode, id);
      await reload();
    });
  };

  const saveEncounters = (encounters: RunEncounter[]) => {
    if (!run) return;
    setRun({ ...run, encounters });
    syncEncountersToBox(encounters, run.generation);
    void guarded(async () => {
      const saved = await client.patchRun(ownerCode, run.id, { encounters });
      setRun((current) =>
        current?.id === saved.id
          ? { ...current, revision: saved.revision }
          : current,
      );
      await reload();
    });
  };

  const saveAiProfile = (value: string) => {
    if (!run) return;
    const aiProfile = AI_PROFILES.find((profile) => profile === value) ?? null;
    void guarded(async () => {
      const saved = await client.patchRun(ownerCode, run.id, { aiProfile });
      setRun((current) =>
        current?.id === saved.id
          ? { ...current, aiProfile: saved.aiProfile, revision: saved.revision }
          : current,
      );
      notifyActiveRunChanged();
    });
  };

  const games = overview?.games ?? [];

  return (
    <section className="d-flex flex-column gap-4">
      <div>
        <p className="eyebrow mb-1">Playthroughs</p>
        <h2 className="h3 mb-1">Nuzlocke playthroughs</h2>
        <p className="text-body-secondary mb-0">
          Track each route and what you caught. Switching run also switches your
          Pokémon box and party. Set up reusable games in the{' '}
          <Link to="/nuzlocke/games">game manager</Link>.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger mb-0" role="alert">
          {error}
        </div>
      )}

      <div className="card card-body d-flex flex-column gap-3">
        <h3 className="h5 mb-0">Your runs</h3>
        {overview && overview.runs.length > 0 ? (
          <ul className="list-group">
            {overview.runs.map((summary) => (
              <li
                key={summary.id}
                className={`list-group-item d-flex align-items-center gap-2${summary.id === activeRunId ? ' active' : ''}`}
              >
                <span className="flex-grow-1">
                  <strong>{summary.title}</strong> · {summary.gameName} (Gen{' '}
                  {summary.generation})
                  <br />
                  <small>
                    {summary.caught}/{summary.encounterCount} caught ·{' '}
                    {summary.dead} dead
                  </small>
                </span>
                {summary.id === activeRunId ? (
                  <span className="badge text-bg-light">Active</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={busy}
                    onClick={() => void openRun(summary.id)}
                  >
                    Switch to
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={busy}
                  onClick={() => deleteRun(summary.id, summary.title)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-secondary mb-0">
            {overview ? 'No runs yet. Start one below.' : 'Loading…'}
          </p>
        )}

        <form
          className="row g-2 align-items-end"
          onSubmit={(event) => {
            event.preventDefault();
            createRun(event.currentTarget);
          }}
        >
          <div className="col-md-3">
            <label className="form-label" htmlFor="run-title">
              Run name
            </label>
            <input
              id="run-title"
              name="title"
              className="form-control"
              maxLength={80}
              required
            />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="run-game">
              Game
            </label>
            <select
              id="run-game"
              name="game"
              className="form-select"
              defaultValue=""
              required
              disabled={games.length === 0}
            >
              <option value="" disabled>
                {games.length === 0 ? 'Create a game first' : 'Select a game'}
              </option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || games.length === 0}
            >
              Start run
            </button>
          </div>
        </form>
        {games.length === 0 && (
          <p className="mb-0 text-body-secondary">
            Create a game and its routes in the{' '}
            <Link to="/nuzlocke/games">Nuzlocke game manager</Link> before
            starting a playthrough.
          </p>
        )}
      </div>

      {run && run.id === activeRunId && (
        <div className="card card-body d-flex flex-column gap-3">
          <div className="d-flex align-items-center gap-2">
            <h3 className="h5 mb-0 flex-grow-1">
              {run.title}{' '}
              <small className="text-body-secondary">{run.gameName}</small>
            </h3>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={busy}
              onClick={() =>
                void guarded(async () => {
                  await deactivateRun();
                  setRun(undefined);
                })
              }
            >
              Stop tracking
            </button>
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0" htmlFor="run-ai-profile">
              Opponent AI
            </label>
            <select
              id="run-ai-profile"
              className="form-select form-select-sm w-auto"
              disabled={busy}
              value={run.aiProfile ?? ''}
              onChange={(event) => saveAiProfile(event.target.value)}
            >
              <option value="">None</option>
              {AI_PROFILES.map((profile) => (
                <option key={profile} value={profile}>
                  {AI_PROFILE_LABELS[profile]}
                </option>
              ))}
            </select>
            <small className="text-body-secondary">
              Pre-fills the defender&apos;s move in the battle planner.
            </small>
          </div>
          <RunEncounterTable
            encounters={run.encounters}
            speciesOptions={speciesOptions}
            disabled={false}
            onChange={saveEncounters}
          />
        </div>
      )}
    </section>
  );
}
