import { randomUUID } from 'node:crypto';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { hashCode } from './codes';
import { isUniqueViolation, query, withTransaction, type Db } from './db';
import {
  MAX_GAMES,
  MAX_RUNS,
  encountersForGame,
  summarizeEncounters,
  validateBox,
  validateEncounters,
  validateGeneration,
  validatePartyIds,
  validateRoutes,
  validateTitle,
  type NuzlockeGame,
  type NuzlockeOverview,
  type NuzlockeRun,
  type NuzlockeRunSummary,
  type RunBoxSet,
  type RunEncounter,
} from '../src/nuzlocke/types';

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface GameRow {
  id: string;
  name: string;
  generation: number;
  routes_json: string;
}

interface RunRow {
  id: string;
  game_id: string | null;
  game_name: string;
  title: string;
  generation: number;
  data_json: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

interface RunData {
  encounters: RunEncounter[];
  box: RunBoxSet[];
  partyIds: string[];
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (column: string) => `CONVERT(VARCHAR(23), ${column}, 126) + 'Z'`;
const RUN_SELECT = `
  SELECT id, game_id, game_name, title, generation, data_json, revision,
         ${iso('created_at')} AS created_at, ${iso('updated_at')} AS updated_at
  FROM nuzlocke_runs`;

const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

const guid = (value: string, what: string): string => {
  if (!GUID.test(value)) throw new HttpError(404, `${what} not found.`);
  return value;
};

const toGame = (row: GameRow): NuzlockeGame => ({
  id: row.id.toLowerCase(),
  name: row.name,
  generation: row.generation,
  routes: JSON.parse(row.routes_json) as NuzlockeGame['routes'],
});

const toRun = (row: RunRow): NuzlockeRun => {
  const data = JSON.parse(row.data_json) as RunData;
  return {
    id: row.id.toLowerCase(),
    title: row.title,
    gameId: row.game_id?.toLowerCase(),
    gameName: row.game_name,
    generation: row.generation,
    encounters: data.encounters,
    box: data.box,
    partyIds: data.partyIds,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const toSummary = (row: RunRow): NuzlockeRunSummary => {
  const run = toRun(row);
  return {
    id: run.id,
    title: run.title,
    gameName: run.gameName,
    generation: run.generation,
    encounterCount: run.encounters.length,
    updatedAt: run.updatedAt,
    ...summarizeEncounters(run.encounters),
  };
};

// Nuzlocke data hangs off a preset library, so the library's read/owner codes are the access model.
export function createNuzlockeRouter(db: Db) {
  const router = express.Router();

  const find = async (code: string) => {
    const hash = hashCode(code);
    const { rows } = await query<{ id: string; is_owner: number }>(
      db,
      `SELECT id, CASE WHEN owner_code_hash = @hash THEN 1 ELSE 0 END AS is_owner
       FROM preset_libraries WHERE read_code_hash = @hash OR owner_code_hash = @hash`,
      { hash },
    );
    if (!rows[0]) throw new HttpError(404, 'Library not found.');
    return { libraryId: rows[0].id, isOwner: rows[0].is_owner === 1 };
  };

  const owner = async (code: string): Promise<string> => {
    const found = await find(code);
    if (!found.isOwner)
      throw new HttpError(403, 'Invalid or insufficient code.');
    return found.libraryId;
  };

  const problems = (messages: string[]): never => {
    throw new HttpError(422, messages.join(' '));
  };

  const readGameInput = (body: Record<string, unknown> | undefined) => {
    const { title, message } = validateTitle(body?.name);
    if (!title) return problems([message ?? 'Invalid name.']);
    const generation = validateGeneration(body?.generation);
    if (!generation)
      return problems(['generation must be an integer from 1 to 9.']);
    const { routes, messages } = validateRoutes(body?.routes ?? []);
    if (!routes) return problems(messages);
    return {
      name: title as string,
      generation,
      routes: routes as NuzlockeGame['routes'],
    };
  };

  const getGame = async (libraryId: string, id: string) =>
    (
      await query<GameRow>(
        db,
        'SELECT id, name, generation, routes_json FROM nuzlocke_games WHERE id = @id AND library_id = @libraryId',
        { id, libraryId },
      )
    ).rows[0];

  router.get(
    '/:code',
    asyncHandler(async (req, res) => {
      const found = await find(req.params.code as string);
      const games = await query<GameRow>(
        db,
        'SELECT id, name, generation, routes_json FROM nuzlocke_games WHERE library_id = @id ORDER BY name',
        { id: found.libraryId },
      );
      const runs = await query<RunRow>(
        db,
        `${RUN_SELECT} WHERE library_id = @id ORDER BY updated_at DESC`,
        {
          id: found.libraryId,
        },
      );
      const overview: NuzlockeOverview = {
        role: found.isOwner ? 'owner' : 'reader',
        games: games.rows.map(toGame),
        runs: runs.rows.map(toSummary),
      };
      res.json(overview);
    }),
  );

  router.post(
    '/:ownerCode/games',
    asyncHandler(async (req, res) => {
      const libraryId = await owner(req.params.ownerCode as string);
      const input = readGameInput(req.body);
      const count = (
        await query<{ n: number }>(
          db,
          'SELECT COUNT(*) AS n FROM nuzlocke_games WHERE library_id = @libraryId',
          {
            libraryId,
          },
        )
      ).rows[0].n;
      if (count >= MAX_GAMES)
        throw new HttpError(409, `A library is limited to ${MAX_GAMES} games.`);
      const id = randomUUID();
      try {
        await query(
          db,
          `INSERT INTO nuzlocke_games (id, library_id, name, generation, routes_json, created_at, updated_at)
           VALUES (@id, @libraryId, @name, @generation, @routes, SYSUTCDATETIME(), SYSUTCDATETIME())`,
          {
            id,
            libraryId,
            name: input.name,
            generation: input.generation,
            routes: JSON.stringify(input.routes),
          },
        );
      } catch (error) {
        if (isUniqueViolation(error))
          throw new HttpError(
            409,
            `A game named "${input.name}" already exists.`,
          );
        throw error;
      }
      res.status(201).json({ game: toGame((await getGame(libraryId, id))!) });
    }),
  );

  router.put(
    '/:ownerCode/games/:gameId',
    asyncHandler(async (req, res) => {
      const libraryId = await owner(req.params.ownerCode as string);
      const id = guid(req.params.gameId as string, 'Game');
      const input = readGameInput(req.body);
      try {
        const updated = await query(
          db,
          `UPDATE nuzlocke_games
             SET name = @name, generation = @generation, routes_json = @routes, updated_at = SYSUTCDATETIME()
           WHERE id = @id AND library_id = @libraryId`,
          {
            id,
            libraryId,
            name: input.name,
            generation: input.generation,
            routes: JSON.stringify(input.routes),
          },
        );
        if (updated.rowsAffected === 0)
          throw new HttpError(404, 'Game not found.');
      } catch (error) {
        if (isUniqueViolation(error))
          throw new HttpError(
            409,
            `A game named "${input.name}" already exists.`,
          );
        throw error;
      }
      res.json({ game: toGame((await getGame(libraryId, id))!) });
    }),
  );

  // Runs keep their own copy of the routes, so deleting a game never alters existing runs.
  router.delete(
    '/:ownerCode/games/:gameId',
    asyncHandler(async (req, res) => {
      const libraryId = await owner(req.params.ownerCode as string);
      const id = guid(req.params.gameId as string, 'Game');
      await withTransaction(db, async (tx) => {
        const removed = await query(
          tx,
          'DELETE FROM nuzlocke_games WHERE id = @id AND library_id = @libraryId',
          {
            id,
            libraryId,
          },
        );
        if (removed.rowsAffected === 0)
          throw new HttpError(404, 'Game not found.');
        await query(
          tx,
          'UPDATE nuzlocke_runs SET game_id = NULL WHERE game_id = @id AND library_id = @libraryId',
          {
            id,
            libraryId,
          },
        );
      });
      res.status(204).end();
    }),
  );

  router.post(
    '/:ownerCode/runs',
    asyncHandler(async (req, res) => {
      const libraryId = await owner(req.params.ownerCode as string);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { title, message } = validateTitle(body.title);
      if (!title) return problems([message ?? 'Invalid title.']);

      let game: NuzlockeGame | undefined;
      if (body.gameId !== undefined && body.gameId !== null) {
        if (typeof body.gameId !== 'string' || !GUID.test(body.gameId))
          throw new HttpError(404, 'Game not found.');
        const row = await getGame(libraryId, body.gameId);
        if (!row) throw new HttpError(404, 'Game not found.');
        game = toGame(row);
      }
      const gameName = game?.name ?? validateTitle(body.gameName).title;
      if (!gameName) return problems(['Choose a game or enter a game name.']);
      const generation =
        game?.generation ?? validateGeneration(body.generation);
      if (!generation)
        return problems(['generation must be an integer from 1 to 9.']);

      const count = (
        await query<{ n: number }>(
          db,
          'SELECT COUNT(*) AS n FROM nuzlocke_runs WHERE library_id = @libraryId',
          {
            libraryId,
          },
        )
      ).rows[0].n;
      if (count >= MAX_RUNS)
        throw new HttpError(409, `A library is limited to ${MAX_RUNS} runs.`);

      const id = randomUUID();
      const data: RunData = {
        encounters: game ? encountersForGame(game) : [],
        box: [],
        partyIds: [],
      };
      await query(
        db,
        `INSERT INTO nuzlocke_runs
           (id, library_id, game_id, game_name, title, generation, data_json, revision, created_at, updated_at)
         VALUES (@id, @libraryId, @gameId, @gameName, @title, @generation, @data, 1, SYSUTCDATETIME(), SYSUTCDATETIME())`,
        {
          id,
          libraryId,
          gameId: game?.id ?? null,
          gameName,
          title,
          generation,
          data: JSON.stringify(data),
        },
      );
      const created = await query<RunRow>(db, `${RUN_SELECT} WHERE id = @id`, {
        id,
      });
      res.status(201).json({ run: toRun(created.rows[0]) });
    }),
  );

  router.get(
    '/:code/runs/:runId',
    asyncHandler(async (req, res) => {
      const found = await find(req.params.code as string);
      const id = guid(req.params.runId as string, 'Run');
      const { rows } = await query<RunRow>(
        db,
        `${RUN_SELECT} WHERE id = @id AND library_id = @libraryId`,
        {
          id,
          libraryId: found.libraryId,
        },
      );
      if (!rows[0]) throw new HttpError(404, 'Run not found.');
      res.json({ run: toRun(rows[0]) });
    }),
  );

  // Partial update: only supplied fields change, guarded by the run's revision.
  router.patch(
    '/:ownerCode/runs/:runId',
    asyncHandler(async (req, res) => {
      const libraryId = await owner(req.params.ownerCode as string);
      const id = guid(req.params.runId as string, 'Run');
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (
        typeof body.revision !== 'number' ||
        !Number.isInteger(body.revision)
      ) {
        throw new HttpError(400, 'revision is required.');
      }

      let title: string | undefined;
      if (body.title !== undefined) {
        const checked = validateTitle(body.title);
        if (!checked.title)
          return problems([checked.message ?? 'Invalid title.']);
        title = checked.title;
      }
      const encounters =
        body.encounters === undefined
          ? undefined
          : validateEncounters(body.encounters);
      if (encounters && !encounters.encounters)
        return problems(encounters.messages);
      const box = body.box === undefined ? undefined : validateBox(body.box);
      if (box && !box.box) return problems(box.messages);
      const party =
        body.partyIds === undefined
          ? undefined
          : validatePartyIds(body.partyIds);
      if (party && !party.partyIds) return problems(party.messages);

      const run = await withTransaction(db, async (tx) => {
        const existing = await query<RunRow>(
          tx,
          `${RUN_SELECT.replace('FROM nuzlocke_runs', 'FROM nuzlocke_runs WITH (UPDLOCK, ROWLOCK)')}
           WHERE id = @id AND library_id = @libraryId`,
          { id, libraryId },
        );
        const row = existing.rows[0];
        if (!row) throw new HttpError(404, 'Run not found.');
        if (row.revision !== body.revision)
          throw new HttpError(409, 'Stale revision.');
        const data = JSON.parse(row.data_json) as RunData;
        const next: RunData = {
          encounters: encounters?.encounters ?? data.encounters,
          box: box?.box ?? data.box,
          partyIds: party?.partyIds ?? data.partyIds,
        };
        await query(
          tx,
          `UPDATE nuzlocke_runs
             SET title = @title, data_json = @data, revision = revision + 1, updated_at = SYSUTCDATETIME()
           WHERE id = @id`,
          { id, title: title ?? row.title, data: JSON.stringify(next) },
        );
        return (await query<RunRow>(tx, `${RUN_SELECT} WHERE id = @id`, { id }))
          .rows[0];
      });
      res.json({ run: toRun(run) });
    }),
  );

  router.delete(
    '/:ownerCode/runs/:runId',
    asyncHandler(async (req, res) => {
      const libraryId = await owner(req.params.ownerCode as string);
      const id = guid(req.params.runId as string, 'Run');
      const removed = await query(
        db,
        'DELETE FROM nuzlocke_runs WHERE id = @id AND library_id = @libraryId',
        {
          id,
          libraryId,
        },
      );
      if (removed.rowsAffected === 0)
        throw new HttpError(404, 'Run not found.');
      res.status(204).end();
    }),
  );

  router.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    },
  );

  return router;
}
