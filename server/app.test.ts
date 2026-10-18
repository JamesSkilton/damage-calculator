import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import sql from 'mssql/msnodesqlv8';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createPool, DEFAULT_CONNECTION_STRING, migrate, query, type Db } from './db';

const baseConnection = process.env.PRESET_TEST_CONNECTION ?? DEFAULT_CONNECTION_STRING;
const connectionFor = (database: string) => baseConnection.replace(/Database=[^;]*;?/i, '') + `Database=${database};`;
const testDatabase = `Pokemans_Test_${Date.now()}`;

const open = (database: string) => createPool(connectionFor(database));

// These tests need SQL Server (LocalDB by default); they are skipped when it is unreachable.
let master: sql.ConnectionPool | undefined;
try {
  master = open('master');
  await master.connect();
} catch {
  master = undefined;
}

describe.skipIf(!master)('preset library API', () => {
  let db: Db;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    await query(master!, `CREATE DATABASE [${testDatabase}]`);
    db = open(testDatabase);
    await db.connect();
    await migrate(db);
  });

  afterAll(async () => {
    await db?.close();
    await query(master!, `ALTER DATABASE [${testDatabase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
    await query(master!, `DROP DATABASE [${testDatabase}]`);
    await master!.close();
  });

  beforeEach(async () => {
    await query(db, 'DELETE FROM preset_libraries');
    const app = createApp(db, { allowedOrigins: ['http://app.test'] });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/preset-libraries`;
  });

  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

  async function call(method: string, path: string, body?: unknown) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: response.status, body: (await response.json().catch(() => ({}))) as any };
  }

  const preset = (buildName: string, extra: object = {}) => ({
    generation: 9,
    species: 'Venusaur',
    buildName,
    level: 100,
    nature: 'Timid',
    evs: { spa: 252, spe: 252, hp: 4 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['Growth', 'Giga Drain'],
    sourceFormat: 'json',
    ...extra,
  });

  async function createLibrary() {
    const created = await call('POST', '', { name: 'Test' });
    expect(created.status).toBe(201);
    return created.body as { readCode: string; ownerCode: string; library: { revision: number } };
  }

  it('creates a library and reads it with either code', async () => {
    const { readCode, ownerCode } = await createLibrary();
    const asReader = await call('GET', `/${readCode}`);
    expect(asReader.body.role).toBe('reader');
    expect(asReader.body.library.createdAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
    expect((await call('GET', `/${ownerCode}`)).body.role).toBe('owner');
    expect(JSON.stringify(asReader.body)).not.toMatch(/hash/i);
    expect((await call('GET', '/nope')).status).toBe(404);
  });

  it('uploads with partial success and reports duplicates and errors per index', async () => {
    const { ownerCode, readCode } = await createLibrary();
    const result = await call('POST', `/${ownerCode}/presets`, {
      revision: 1,
      idempotencyKey: 'a',
      presets: [preset('A'), { ...preset('B'), species: 'Notamon' }, preset('a'), preset('C')],
    });
    expect(result.status).toBe(200);
    expect(result.body.created).toHaveLength(2);
    expect(result.body.errors.map((e: { index: number }) => e.index)).toEqual([1]);
    expect(result.body.duplicates.map((e: { index: number }) => e.index)).toEqual([2]);
    expect(result.body.library.revision).toBe(2);
    expect((await call('GET', `/${readCode}`)).body.presets).toHaveLength(2);
  });

  it('is idempotent for a repeated key', async () => {
    const { ownerCode } = await createLibrary();
    const body = { revision: 1, idempotencyKey: 'same', presets: [preset('A')] };
    const first = await call('POST', `/${ownerCode}/presets`, body);
    const retry = await call('POST', `/${ownerCode}/presets`, body);
    expect(retry.status).toBe(200);
    expect(retry.body.library.revision).toBe(first.body.library.revision);
    expect((await call('GET', `/${ownerCode}`)).body.presets).toHaveLength(1);
  });

  it('rejects stale revisions and read-code mutations', async () => {
    const { ownerCode, readCode } = await createLibrary();
    expect((await call('POST', `/${ownerCode}/presets`, { revision: 5, presets: [preset('A')] })).status).toBe(409);
    expect((await call('POST', `/${readCode}/presets`, { revision: 1, presets: [preset('A')] })).status).toBe(403);
  });

  it('updates and deletes presets using revisions', async () => {
    const { ownerCode } = await createLibrary();
    const upload = await call('POST', `/${ownerCode}/presets`, { revision: 1, presets: [preset('A')] });
    const id = upload.body.created[0].id as string;

    const patched = await call('PATCH', `/${ownerCode}/presets/${id}`, {
      revision: 2,
      changes: { nature: 'Modest', id: 'hijack' },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.preset.nature).toBe('Modest');
    expect(patched.body.preset.id).toBe(id);
    expect(patched.body.library.revision).toBe(3);

    expect((await call('PATCH', `/${ownerCode}/presets/${id}`, { revision: 2, changes: {} })).status).toBe(409);
    expect(
      (await call('PATCH', `/${ownerCode}/presets/${id}`, { revision: 3, changes: { moves: ['Fakemove'] } })).status,
    ).toBe(422);

    expect((await call('DELETE', `/${ownerCode}/presets/${id}?revision=3`)).status).toBe(200);
    expect((await call('GET', `/${ownerCode}`)).body.presets).toHaveLength(0);
    expect((await call('DELETE', `/${ownerCode}/presets/not-a-guid?revision=4`)).status).toBe(404);
  });

  it('persists fight order and reorders in one revision', async () => {
    const { ownerCode } = await createLibrary();
    const upload = await call('POST', `/${ownerCode}/presets`, {
      revision: 1,
      presets: [preset('A', { index: 1 }), preset('B', { index: 2 })],
    });
    const [a, b] = upload.body.created as { id: string; index: number }[];
    expect([a.index, b.index]).toEqual([1, 2]);

    const reordered = await call('POST', `/${ownerCode}/reorder`, {
      revision: 2,
      order: [{ id: a.id, index: 2 }, { id: b.id, index: 1 }],
    });
    expect(reordered.status).toBe(200);
    expect(reordered.body.library.revision).toBe(3);
    const stored = (await call('GET', `/${ownerCode}`)).body.presets as { id: string; index: number }[];
    expect(stored.find((entry) => entry.id === a.id)?.index).toBe(2);

    expect((await call('POST', `/${ownerCode}/reorder`, { revision: 2, order: [{ id: a.id, index: 1 }] })).status).toBe(409);
    expect((await call('POST', `/${ownerCode}/reorder`, { revision: 3, order: [{ id: a.id, index: -1 }] })).status).toBe(400);
    const unknown = '00000000-0000-4000-8000-000000000000';
    expect((await call('POST', `/${ownerCode}/reorder`, { revision: 3, order: [{ id: unknown, index: 1 }] })).status).toBe(404);
  });

  it('rotates codes and revokes the old ones', async () => {
    const { ownerCode, readCode } = await createLibrary();
    const rotated = await call('POST', `/${ownerCode}/rotate-codes`);
    expect(rotated.status).toBe(200);
    expect((await call('GET', `/${readCode}`)).status).toBe(404);
    expect((await call('POST', `/${ownerCode}/presets`, { revision: 1, presets: [preset('A')] })).status).toBe(404);
    expect((await call('GET', `/${rotated.body.ownerCode}`)).body.role).toBe('owner');
  });

  it('answers CORS preflight for allowed origins', async () => {
    const response = await fetch(base, { method: 'OPTIONS', headers: { Origin: 'http://app.test' } });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://app.test');
  });
});
