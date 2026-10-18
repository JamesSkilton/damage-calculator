import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { isUniqueViolation, query, withTransaction, type Db, type Queryable } from './db';
import { generateCode, hashCode } from './codes';
import { corsMiddleware, rateLimit } from './middleware';
import {
  MAX_BATCH_PRESETS,
  MAX_LIBRARY_PRESETS,
  MAX_NAME_LENGTH,
  MAX_PRESET_INDEX,
  validatePreset,
  type StoredPreset,
} from './validation';

export interface AppOptions {
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
  trustProxy?: boolean;
}

interface LibraryRow {
  id: string;
  name: string;
  revision: number;
  created_at: string;
  updated_at: string;
  preset_count: number;
}

interface PresetRow {
  id: string;
  library_id: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
}

interface Problem {
  index: number;
  message: string;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const PROTECTED_FIELDS = ['id', 'libraryId', 'createdAt', 'updatedAt', 'remote'];
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (column: string) => `CONVERT(VARCHAR(23), ${column}, 126) + 'Z'`;

const LIBRARY_SELECT = `
  SELECT l.id, l.name, l.revision,
         ${iso('l.created_at')} AS created_at,
         ${iso('l.updated_at')} AS updated_at,
         (SELECT COUNT(*) FROM user_presets p WHERE p.library_id = l.id) AS preset_count
  FROM preset_libraries l`;

const PRESET_SELECT = `
  SELECT id, library_id, payload_json,
         ${iso('created_at')} AS created_at,
         ${iso('updated_at')} AS updated_at
  FROM user_presets`;

const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

export function createApp(db: Db, options: AppOptions = {}) {
  const app = express();
  if (options.trustProxy) app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(corsMiddleware(options.allowedOrigins ?? []));
  app.use(rateLimit(options.rateLimitPerMinute ?? 120, 60_000));
  app.use(express.json({ limit: '2mb' }));

  const toLibrary = (row: LibraryRow) => ({
    id: row.id.toLowerCase(),
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
    presetCount: row.preset_count,
  });

  const toPreset = (row: PresetRow) => ({
    ...(JSON.parse(row.payload_json) as StoredPreset),
    id: row.id.toLowerCase(),
    libraryId: row.library_id.toLowerCase(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const getLibrary = async (target: Queryable, id: string): Promise<LibraryRow> =>
    (await query<LibraryRow>(target, `${LIBRARY_SELECT} WHERE l.id = @id`, { id })).rows[0];

  const findByCode = async (code: string) => {
    const hash = hashCode(code);
    const { rows } = await query<LibraryRow & { is_owner: number }>(
      db,
      `SELECT x.*, CASE WHEN o.id IS NULL THEN 0 ELSE 1 END AS is_owner
       FROM (${LIBRARY_SELECT} WHERE l.read_code_hash = @hash OR l.owner_code_hash = @hash) x
       LEFT JOIN preset_libraries o ON o.id = x.id AND o.owner_code_hash = @hash`,
      { hash },
    );
    return rows[0] ? { row: rows[0], isOwner: rows[0].is_owner === 1 } : undefined;
  };

  const ownerLibrary = async (code: string): Promise<LibraryRow> => {
    const found = await findByCode(code);
    if (!found) throw new HttpError(404, 'Invalid or insufficient code.');
    if (!found.isOwner) throw new HttpError(403, 'Invalid or insufficient code.');
    return found.row;
  };

  const readRevision = (value: unknown): number => {
    const revision = typeof value === 'string' ? Number(value) : value;
    if (typeof revision !== 'number' || !Number.isInteger(revision)) {
      throw new HttpError(400, 'revision is required.');
    }
    return revision;
  };

  const presetIdParam = (value: string): string => {
    if (!GUID.test(value)) throw new HttpError(404, 'Preset not found.');
    return value;
  };

  // Serializes writers per library and verifies the caller's revision.
  const lockAndCheck = async (tx: Queryable, libraryId: string, revision: number) => {
    const { rows } = await query<{ revision: number }>(
      tx,
      'SELECT revision FROM preset_libraries WITH (UPDLOCK, ROWLOCK) WHERE id = @id',
      { id: libraryId },
    );
    if (rows[0]?.revision !== revision) throw new HttpError(409, 'Stale revision.');
  };

  const bump = (tx: Queryable, libraryId: string) =>
    query(tx, 'UPDATE preset_libraries SET revision = revision + 1, updated_at = SYSUTCDATETIME() WHERE id = @id', {
      id: libraryId,
    });

  const router = express.Router();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > MAX_NAME_LENGTH) {
        throw new HttpError(400, `name is required (max ${MAX_NAME_LENGTH} characters).`);
      }
      const readCode = generateCode('reader');
      const ownerCode = generateCode('owner');
      const id = randomUUID();
      await query(
        db,
        `INSERT INTO preset_libraries (id, name, read_code_hash, owner_code_hash, revision, created_at, updated_at)
         VALUES (@id, @name, @read, @owner, 1, SYSUTCDATETIME(), SYSUTCDATETIME())`,
        { id, name, read: hashCode(readCode), owner: hashCode(ownerCode) },
      );
      res.status(201).json({ library: toLibrary(await getLibrary(db, id)), readCode, ownerCode });
    }),
  );

  router.get(
    '/:code',
    asyncHandler(async (req, res) => {
      const found = await findByCode(req.params.code as string);
      if (!found) throw new HttpError(404, 'Library not found.');
      const { rows } = await query<PresetRow>(
        db,
        `${PRESET_SELECT} WHERE library_id = @id ORDER BY species, build_name`,
        { id: found.row.id },
      );
      res.json({
        role: found.isOwner ? 'owner' : 'reader',
        library: toLibrary(found.row),
        presets: rows.map(toPreset),
      });
    }),
  );

  // Partial success: valid presets are stored, invalid or duplicate ones are reported per index.
  router.post(
    '/:ownerCode/presets',
    asyncHandler(async (req, res) => {
      const library = await ownerLibrary(req.params.ownerCode as string);
      const body = req.body ?? {};
      const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 128) : undefined;
      const revision = readRevision(body.revision);
      if (!Array.isArray(body.presets) || body.presets.length === 0) {
        throw new HttpError(400, 'presets must be a non-empty array.');
      }
      if (body.presets.length > MAX_BATCH_PRESETS) {
        throw new HttpError(413, `At most ${MAX_BATCH_PRESETS} presets per batch.`);
      }
      const inputs = body.presets as unknown[];

      const result = await withTransaction(db, async (tx) => {
        if (key) {
          await query(tx, 'SELECT 1 FROM preset_libraries WITH (UPDLOCK, ROWLOCK) WHERE id = @id', { id: library.id });
          const stored = await query<{ response_json: string }>(
            tx,
            'SELECT response_json FROM idempotency_keys WHERE library_id = @id AND [key] = @key',
            { id: library.id, key },
          );
          if (stored.rows[0]) return JSON.parse(stored.rows[0].response_json);
        }
        await lockAndCheck(tx, library.id, revision);

        let total = (
          await query<{ n: number }>(tx, 'SELECT COUNT(*) AS n FROM user_presets WHERE library_id = @id', {
            id: library.id,
          })
        ).rows[0].n;
        const createdIds: string[] = [];
        const duplicates: Problem[] = [];
        const errors: Problem[] = [];

        for (const [index, input] of inputs.entries()) {
          const { preset, messages } = validatePreset(input);
          if (!preset) {
            errors.push({ index, message: messages.join(' ') });
            continue;
          }
          if (total >= MAX_LIBRARY_PRESETS) {
            errors.push({ index, message: `Library is limited to ${MAX_LIBRARY_PRESETS} presets.` });
            continue;
          }
          const id = randomUUID();
          const inserted = await query(
            tx,
            `INSERT INTO user_presets
               (id, library_id, generation, species, build_name, payload_json, source_format,
                trainer_name, source_preset_id, source_library_id, created_at, updated_at)
             SELECT @id, @libraryId, @generation, @species, @buildName, @payload, @sourceFormat,
                    @trainerName, @sourcePresetId, @sourceLibraryId,
                    SYSUTCDATETIME(), SYSUTCDATETIME()
             WHERE NOT EXISTS (
               SELECT 1 FROM user_presets
               WHERE library_id = @libraryId AND generation = @generation
                 AND species = @species AND build_name = @buildName)`,
            {
              id,
              libraryId: library.id,
              generation: preset.generation,
              species: preset.species,
              buildName: preset.buildName,
              payload: JSON.stringify(preset),
              sourceFormat: preset.sourceFormat,
              trainerName: preset.trainerName ?? null,
              sourcePresetId: preset.sourcePresetId ?? null,
              sourceLibraryId: preset.sourceLibraryId ?? null,
            },
          );
          if (inserted.rowsAffected === 0) {
            duplicates.push({ index, message: `${preset.species} / ${preset.buildName} already exists.` });
            continue;
          }
          total += 1;
          createdIds.push(id);
        }

        if (createdIds.length > 0) await bump(tx, library.id);
        const created: ReturnType<typeof toPreset>[] = [];
        for (const id of createdIds) {
          const entry = await query<PresetRow>(tx, `${PRESET_SELECT} WHERE id = @id`, { id });
          created.push(toPreset(entry.rows[0]));
        }
        const response = { library: toLibrary(await getLibrary(tx, library.id)), created, duplicates, errors };
        if (key) {
          await query(
            tx,
            `INSERT INTO idempotency_keys (library_id, [key], response_json, created_at)
             VALUES (@id, @key, @json, SYSUTCDATETIME())`,
            { id: library.id, key, json: JSON.stringify(response) },
          );
        }
        return response;
      });

      res.json(result);
    }),
  );

  router.patch(
    '/:ownerCode/presets/:presetId',
    asyncHandler(async (req, res) => {
      const library = await ownerLibrary(req.params.ownerCode as string);
      const presetId = presetIdParam(req.params.presetId as string);
      const revision = readRevision(req.body?.revision);
      const changes = req.body?.changes;
      if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) {
        throw new HttpError(400, 'changes must be an object.');
      }

      const result = await withTransaction(db, async (tx) => {
        await lockAndCheck(tx, library.id, revision);
        const existing = await query<PresetRow>(tx, `${PRESET_SELECT} WHERE id = @id AND library_id = @libraryId`, {
          id: presetId,
          libraryId: library.id,
        });
        const row = existing.rows[0];
        if (!row) throw new HttpError(404, 'Preset not found.');
        const merged: Record<string, unknown> = {
          ...JSON.parse(row.payload_json),
          ...(changes as Record<string, unknown>),
        };
        for (const field of PROTECTED_FIELDS) delete merged[field];
        const { preset, messages } = validatePreset(merged);
        if (!preset) throw new HttpError(422, messages.join(' '));
        try {
          await query(
            tx,
            `UPDATE user_presets
               SET generation = @generation, species = @species, build_name = @buildName,
                   payload_json = @payload, source_format = @sourceFormat,
                   trainer_name = @trainerName, source_preset_id = @sourcePresetId,
                   source_library_id = @sourceLibraryId, updated_at = SYSUTCDATETIME()
             WHERE id = @id`,
            {
              id: presetId,
              generation: preset.generation,
              species: preset.species,
              buildName: preset.buildName,
              payload: JSON.stringify(preset),
              sourceFormat: preset.sourceFormat,
              trainerName: preset.trainerName ?? null,
              sourcePresetId: preset.sourcePresetId ?? null,
              sourceLibraryId: preset.sourceLibraryId ?? null,
            },
          );
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          throw new HttpError(422, `${preset.species} / ${preset.buildName} already exists.`);
        }
        await bump(tx, library.id);
        const updated = await query<PresetRow>(tx, `${PRESET_SELECT} WHERE id = @id`, { id: presetId });
        return {
          library: toLibrary(await getLibrary(tx, library.id)),
          preset: toPreset(updated.rows[0]),
        };
      });

      res.json(result);
    }),
  );

  // Rewrites fight order for many presets at once so a move costs one revision, not one per preset.
  router.post(
    '/:ownerCode/reorder',
    asyncHandler(async (req, res) => {
      const library = await ownerLibrary(req.params.ownerCode as string);
      const revision = readRevision(req.body?.revision);
      const order: unknown = req.body?.order;
      if (!Array.isArray(order) || order.length === 0 || order.length > MAX_LIBRARY_PRESETS) {
        throw new HttpError(400, `order must be an array of 1-${MAX_LIBRARY_PRESETS} entries.`);
      }
      const seen = new Set<string>();
      const entries = order.map((entry: unknown) => {
        const { id, index } = (entry ?? {}) as { id?: unknown; index?: unknown };
        if (
          typeof id !== 'string' ||
          !GUID.test(id) ||
          typeof index !== 'number' ||
          !Number.isInteger(index) ||
          index < 0 ||
          index > MAX_PRESET_INDEX
        ) {
          throw new HttpError(400, 'Each order entry needs a preset id and an integer index.');
        }
        if (seen.has(id.toLowerCase())) throw new HttpError(400, 'Duplicate preset id in order.');
        seen.add(id.toLowerCase());
        return { id, index };
      });

      const result = await withTransaction(db, async (tx) => {
        await lockAndCheck(tx, library.id, revision);
        const updatedIds: string[] = [];
        for (const { id, index } of entries) {
          const existing = await query<PresetRow>(tx, `${PRESET_SELECT} WHERE id = @id AND library_id = @libraryId`, {
            id,
            libraryId: library.id,
          });
          const row = existing.rows[0];
          if (!row) throw new HttpError(404, 'Preset not found.');
          const payload = { ...JSON.parse(row.payload_json), index };
          await query(tx, 'UPDATE user_presets SET payload_json = @payload, updated_at = SYSUTCDATETIME() WHERE id = @id', {
            id,
            payload: JSON.stringify(payload),
          });
          updatedIds.push(id);
        }
        await bump(tx, library.id);
        const presets: ReturnType<typeof toPreset>[] = [];
        for (const id of updatedIds) {
          const updated = await query<PresetRow>(tx, `${PRESET_SELECT} WHERE id = @id`, { id });
          presets.push(toPreset(updated.rows[0]));
        }
        return { library: toLibrary(await getLibrary(tx, library.id)), presets };
      });

      res.json(result);
    }),
  );

  router.delete(
    '/:ownerCode/presets/:presetId',
    asyncHandler(async (req, res) => {
      const library = await ownerLibrary(req.params.ownerCode as string);
      const presetId = presetIdParam(req.params.presetId as string);
      const revision = readRevision(req.query.revision);
      const result = await withTransaction(db, async (tx) => {
        await lockAndCheck(tx, library.id, revision);
        const removed = await query(tx, 'DELETE FROM user_presets WHERE id = @id AND library_id = @libraryId', {
          id: presetId,
          libraryId: library.id,
        });
        if (removed.rowsAffected === 0) throw new HttpError(404, 'Preset not found.');
        await bump(tx, library.id);
        return { library: toLibrary(await getLibrary(tx, library.id)) };
      });
      res.json(result);
    }),
  );

  // Old read and owner codes stop working immediately.
  router.post(
    '/:ownerCode/rotate-codes',
    asyncHandler(async (req, res) => {
      const library = await ownerLibrary(req.params.ownerCode as string);
      const readCode = generateCode('reader');
      const ownerCode = generateCode('owner');
      await query(
        db,
        `UPDATE preset_libraries
           SET read_code_hash = @read, owner_code_hash = @owner, updated_at = SYSUTCDATETIME()
         WHERE id = @id`,
        { read: hashCode(readCode), owner: hashCode(ownerCode), id: library.id },
      );
      res.json({ readCode, ownerCode });
    }),
  );

  app.use('/api/preset-libraries', router);

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    const status = (error as { status?: number }).status;
    if (status === 400 || status === 413) {
      res.status(status).json({ error: 'Invalid request body.' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
