import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { BattleGeneration } from 'domain/index';
import type { AppShellContext } from './AppShell';
import GameManager from './nuzlocke/GameManager';
import { runtimeConfig } from '../config/runtimeConfig';
import { loadPresetLibraryCache } from '../presets/remote/presetLibraryCache';
import { createNuzlockeClient, NuzlockeError } from '../nuzlocke/httpClient';
import type {
  GameInput,
  NuzlockeGame,
  NuzlockeOverview,
} from '../nuzlocke/types';

function describe(error: unknown): string {
  return error instanceof NuzlockeError || error instanceof Error
    ? error.message
    : 'Something went wrong.';
}

export default function NuzlockeGamesPage() {
  const { generation } = useOutletContext<AppShellContext>();
  const client = useMemo(
    () =>
      runtimeConfig.presetApiUrl
        ? createNuzlockeClient(runtimeConfig.presetApiUrl)
        : undefined,
    [],
  );
  const [library, setLibrary] = useState(() => loadPresetLibraryCache());
  const [overview, setOverview] = useState<NuzlockeOverview>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const ownerCode = library?.ownerCode;
  const libraryId = library?.snapshot.library.id;

  useEffect(() => {
    const refreshLibrary = () => setLibrary(loadPresetLibraryCache());
    window.addEventListener('pokemans.preset-library-changed', refreshLibrary);
    return () =>
      window.removeEventListener(
        'pokemans.preset-library-changed',
        refreshLibrary,
      );
  }, []);

  const reload = useCallback(async () => {
    if (!client || !ownerCode) return;
    setOverview(await client.overview(ownerCode));
  }, [client, ownerCode]);

  useEffect(() => {
    setOverview(undefined);
    setError(undefined);
    if (!client || !ownerCode || !libraryId) return;
    setBusy(true);
    void reload()
      .catch((caught: unknown) => setError(describe(caught)))
      .finally(() => setBusy(false));
  }, [client, ownerCode, libraryId, reload]);

  const saveGame = async (
    gameId: string | undefined,
    input: GameInput,
  ): Promise<boolean> => {
    setBusy(true);
    setError(undefined);
    try {
      if (!client || !ownerCode) return false;
      if (gameId) await client.updateGame(ownerCode, gameId, input);
      else await client.createGame(ownerCode, input);
      await reload();
      return true;
    } catch (caught) {
      setError(describe(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const deleteGame = async (game: NuzlockeGame) => {
    setBusy(true);
    setError(undefined);
    try {
      if (!client || !ownerCode) return;
      await client.deleteGame(ownerCode, game.id);
      await reload();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!client) {
    return (
      <section className="card card-body">
        <h2 className="h4">Nuzlocke game manager</h2>
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
        <h2 className="h4">Nuzlocke game manager</h2>
        <p className="mb-0">
          Your games are saved to a preset library. Create or open a library you
          own in the <Link to="/presets">Preset manager</Link> first.
        </p>
      </section>
    );
  }

  return (
    <section className="d-flex flex-column gap-4">
      <div>
        <p className="eyebrow mb-1">Game setup</p>
        <h2 className="h3 mb-1">Nuzlocke game manager</h2>
        <p className="text-body-secondary mb-0">
          Create reusable game definitions with their routes and possible
          encounters. Choose one when you start a{' '}
          <Link to="/nuzlocke">playthrough</Link>.
        </p>
      </div>
      {error && (
        <div className="alert alert-danger mb-0" role="alert">
          {error}
        </div>
      )}
      <div className="card card-body d-flex flex-column gap-3">
        {overview ? (
          <GameManager
            games={overview.games}
            defaultGeneration={generation as BattleGeneration}
            disabled={busy}
            onSave={saveGame}
            onDelete={deleteGame}
          />
        ) : (
          <p className="mb-0 text-body-secondary">Loading games…</p>
        )}
      </div>
    </section>
  );
}
