import sql from 'mssql/msnodesqlv8';

export type Db = sql.ConnectionPool;
export type Queryable = sql.ConnectionPool | sql.Transaction;
export type Params = Record<string, unknown>;

export const DEFAULT_CONNECTION_STRING =
  'Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\\ProjectModels;Database=Pokemans;Trusted_Connection=yes;';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE preset_libraries (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    name NVARCHAR(80) NOT NULL,
    read_code_hash CHAR(64) NOT NULL,
    owner_code_hash CHAR(64) NOT NULL,
    revision INT NOT NULL DEFAULT 1,
    created_at DATETIME2(3) NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    CONSTRAINT UQ_preset_libraries_read UNIQUE (read_code_hash),
    CONSTRAINT UQ_preset_libraries_owner UNIQUE (owner_code_hash)
  );

  CREATE TABLE user_presets (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    library_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_user_presets_library REFERENCES preset_libraries(id) ON DELETE CASCADE,
    generation TINYINT NOT NULL,
    species NVARCHAR(100) COLLATE Latin1_General_100_CI_AS NOT NULL,
    build_name NVARCHAR(200) COLLATE Latin1_General_100_CI_AS NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL,
    source_format VARCHAR(10) NOT NULL,
    created_at DATETIME2(3) NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    CONSTRAINT UQ_user_presets_identity UNIQUE (library_id, generation, species, build_name)
  );
  CREATE INDEX IX_user_presets_library_species ON user_presets(library_id, species);

  CREATE TABLE idempotency_keys (
    library_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_idempotency_library REFERENCES preset_libraries(id) ON DELETE CASCADE,
    [key] NVARCHAR(128) NOT NULL,
    response_json NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2(3) NOT NULL,
    CONSTRAINT PK_idempotency_keys PRIMARY KEY (library_id, [key])
  );
  `,
  `
  IF COL_LENGTH('user_presets', 'trainer_name') IS NULL
    ALTER TABLE user_presets ADD trainer_name NVARCHAR(200) NULL;
  IF COL_LENGTH('user_presets', 'source_preset_id') IS NULL
    ALTER TABLE user_presets ADD source_preset_id NVARCHAR(300) NULL;
  IF COL_LENGTH('user_presets', 'source_library_id') IS NULL
    ALTER TABLE user_presets ADD source_library_id NVARCHAR(100) NULL;
  CREATE INDEX IX_user_presets_trainer_name ON user_presets(library_id, trainer_name);
  `,
  `
  IF COL_LENGTH('preset_libraries', 'base_stats_json') IS NULL
    ALTER TABLE preset_libraries ADD base_stats_json NVARCHAR(MAX) NULL;
  `,
];

export async function query<T = Record<string, unknown>>(
  target: Queryable,
  text: string,
  params: Params = {},
): Promise<{ rows: T[]; rowsAffected: number }> {
  const request = new sql.Request(target as sql.ConnectionPool);
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  const result = await request.query(text);
  return {
    rows: (result.recordset ?? []) as T[],
    rowsAffected: result.rowsAffected.reduce((total, count) => total + count, 0),
  };
}

export async function withTransaction<T>(
  db: Db,
  action: (tx: sql.Transaction) => Promise<T>,
): Promise<T> {
  const tx = new sql.Transaction(db);
  await tx.begin();
  try {
    const result = await action(tx);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Transaction may already have been rolled back by the server.
    }
    throw error;
  }
}

export function isUniqueViolation(error: unknown): boolean {
  const number = (error as { number?: number }).number;
  return number === 2601 || number === 2627;
}

export async function migrate(db: Db): Promise<void> {
  await query(
    db,
    `IF OBJECT_ID('schema_migrations') IS NULL
       CREATE TABLE schema_migrations (version INT NOT NULL PRIMARY KEY, applied_at DATETIME2(3) NOT NULL)`,
  );
  const applied = await query<{ version: number }>(db, 'SELECT version FROM schema_migrations');
  const done = new Set(applied.rows.map((row) => row.version));
  for (let index = 0; index < MIGRATIONS.length; index += 1) {
    const version = index + 1;
    if (done.has(version)) continue;
    await withTransaction(db, async (tx) => {
      await query(tx, MIGRATIONS[index]);
      await query(tx, 'INSERT INTO schema_migrations (version, applied_at) VALUES (@version, SYSUTCDATETIME())', {
        version,
      });
    });
  }
}

export function createPool(connectionString: string): Db {
  return new sql.ConnectionPool({ connectionString, driver: 'msnodesqlv8' } as unknown as sql.config);
}

export async function openDatabase(connectionString = DEFAULT_CONNECTION_STRING): Promise<Db> {
  const pool = createPool(connectionString);
  await pool.connect();
  await migrate(pool);
  return pool;
}
