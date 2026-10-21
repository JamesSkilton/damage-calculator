import type {
  GameInput,
  NuzlockeGame,
  NuzlockeOverview,
  NuzlockeRun,
  RunPatch,
} from './types';

export class NuzlockeError extends Error {
  constructor(
    readonly kind:
      'network' | 'invalid-code' | 'conflict' | 'validation' | 'server',
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Revisions and write queues are shared so the encounter editor and the box sync never race each other.
const revisions = new Map<string, number>();
const queues = new Map<string, Promise<unknown>>();

export function rememberRunRevision(
  run: Pick<NuzlockeRun, 'id' | 'revision'>,
): void {
  revisions.set(run.id, run.revision);
}

export function createNuzlockeClient(
  baseUrl: string,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
) {
  const root = `${baseUrl.replace(/\/+$/, '')}/api/nuzlockes`;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      });
    } catch {
      throw new NuzlockeError(
        'network',
        'Could not reach the Nuzlocke service.',
      );
    }
    if (response.status === 204) return undefined as T;
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (response.ok) return body as T;
    const message = body.error ?? 'Request failed.';
    if (
      response.status === 404 ||
      response.status === 401 ||
      response.status === 403
    ) {
      throw new NuzlockeError('invalid-code', message, response.status);
    }
    if (response.status === 409)
      throw new NuzlockeError('conflict', message, response.status);
    if (response.status === 422 || response.status === 400) {
      throw new NuzlockeError('validation', message, response.status);
    }
    throw new NuzlockeError('server', message, response.status);
  }

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    body: JSON.stringify(body),
  });

  async function getRun(code: string, runId: string): Promise<NuzlockeRun> {
    const { run } = await request<{ run: NuzlockeRun }>(
      `/${code}/runs/${runId}`,
    );
    rememberRunRevision(run);
    return run;
  }

  async function sendPatch(
    code: string,
    runId: string,
    patch: RunPatch,
  ): Promise<NuzlockeRun> {
    const attempt = async () => {
      const revision =
        revisions.get(runId) ?? (await getRun(code, runId)).revision;
      const { run } = await request<{ run: NuzlockeRun }>(
        `/${code}/runs/${runId}`,
        json('PATCH', { ...patch, revision }),
      );
      rememberRunRevision(run);
      return run;
    };
    try {
      return await attempt();
    } catch (error) {
      if (error instanceof NuzlockeError && error.kind === 'conflict') {
        revisions.delete(runId);
        return attempt();
      }
      throw error;
    }
  }

  return {
    overview: (code: string) => request<NuzlockeOverview>(`/${code}`),
    getRun,
    createGame: async (
      ownerCode: string,
      input: GameInput,
    ): Promise<NuzlockeGame> =>
      (
        await request<{ game: NuzlockeGame }>(
          `/${ownerCode}/games`,
          json('POST', input),
        )
      ).game,
    updateGame: async (
      ownerCode: string,
      gameId: string,
      input: GameInput,
    ): Promise<NuzlockeGame> =>
      (
        await request<{ game: NuzlockeGame }>(
          `/${ownerCode}/games/${gameId}`,
          json('PUT', input),
        )
      ).game,
    deleteGame: (ownerCode: string, gameId: string) =>
      request<void>(`/${ownerCode}/games/${gameId}`, { method: 'DELETE' }),
    createRun: async (
      ownerCode: string,
      input: {
        title: string;
        gameId?: string;
        gameName?: string;
        generation?: number;
      },
    ): Promise<NuzlockeRun> => {
      const { run } = await request<{ run: NuzlockeRun }>(
        `/${ownerCode}/runs`,
        json('POST', input),
      );
      rememberRunRevision(run);
      return run;
    },
    deleteRun: async (ownerCode: string, runId: string) => {
      await request<void>(`/${ownerCode}/runs/${runId}`, { method: 'DELETE' });
      revisions.delete(runId);
    },
    // Writes to the same run are serialized so revisions stay in order.
    patchRun: (
      ownerCode: string,
      runId: string,
      patch: RunPatch,
    ): Promise<NuzlockeRun> => {
      const previous = queues.get(runId) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(() => sendPatch(ownerCode, runId, patch));
      queues.set(runId, next);
      return next;
    },
  };
}

export type NuzlockeClient = ReturnType<typeof createNuzlockeClient>;
