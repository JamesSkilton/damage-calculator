# Preset Upload and Synchronization Plan

## 1. Goal

Allow users to upload, manage, and use custom Pokemon presets across different browsers.

The current application can parse Showdown text and save imported sets in browser `sessionStorage`. That is suitable for temporary, single-browser use, but it cannot provide cross-browser persistence. Cross-browser synchronization requires a remote service and database.

The first release should provide:

- Showdown text and JSON uploads
- Private user-owned preset libraries
- Access through share/import codes
- Preset editing and deletion
- Use of remote presets in the existing calculator
- Local caching for offline calculations
- Explicit migration from existing browser-local imports

Public discovery, community catalogs, comments, and social features are outside the first release.

## 2. Architectural Direction

### 2.1 Remote library, local cache

The source of truth should be a backend service. The frontend may cache the active library locally, but browser storage must not be treated as the authoritative store.

```text
Browser A                 Backend                  Browser B
    |                        |                        |
    |-- upload/update ------>|                        |
    |<-- normalized data ----|                        |
    |                        |<-- open share code ----|
    |                        |-- library data ------->|
    |<-- cached copy --------|                        |
```

Existing build-time preset libraries remain read-only application data. Existing `sessionStorage` imports remain supported and are migrated only through an explicit user action.

### 2.2 Access model

There is currently no authentication system in the application. The initial proposal therefore uses unguessable share codes:

- A read code allows a library to be opened and used.
- An owner code allows uploads, edits, deletes, and code rotation.
- Libraries are private by default and are not listed publicly.
- Codes are bearer credentials. Anyone with an owner code can modify the library.
- Owner codes should be shown only once, stored hashed by the server, and revocable/rotatable.

This is a useful first release, but it is not equivalent to account-based privacy. An authentication provider should replace or augment this model if stronger ownership or access control becomes necessary.

## 3. Data Model

The API should expose a stable model that is separate from the calculator's internal combatant state.

### 3.1 Preset library

```ts
interface PresetLibrary {
  id: string;
  name: string;
  readCode?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  presetCount: number;
}
```

The owner code should not be returned in normal library responses after creation.

### 3.2 User preset

The calculator-facing fields should remain compatible with `ImportedPokemonSet` and `PokemonPreset`:

```ts
interface UserPreset {
  id: string;
  libraryId: string;
  generation: BattleGeneration;
  species: string;
  buildName: string;
  nickname?: string;
  level: number;
  gender?: BattleGender;
  ability?: string;
  item?: string;
  nature: string;
  teraType?: BattleTypeName;
  evs: BattleStats;
  ivs: BattleStats;
  moves: readonly string[];
  sourceFormat: 'showdown' | 'json';
  createdAt: string;
  updatedAt: string;
}
```

The server should store normalized preset fields and a versioned payload where necessary. Raw uploaded files should not be the canonical database representation.

### 3.3 Database shape

Use separate library and preset records rather than storing one large JSON document:

```sql
preset_libraries
----------------
id
name
read_code_hash
owner_code_hash
revision
created_at
updated_at

user_presets
------------
id
library_id
 generation
species
build_name
payload_json
source_format
created_at
updated_at

UNIQUE (library_id, generation, species, build_name)
INDEX (library_id)
INDEX (library_id, species)
```

The exact database technology can be chosen with the backend deployment, but the frontend should depend only on a typed API client.

## 4. API Contract

The initial API should support:

```text
POST   /api/preset-libraries
GET    /api/preset-libraries/{readCode}
POST   /api/preset-libraries/{ownerCode}/presets
PATCH  /api/preset-libraries/{ownerCode}/presets/{presetId}
DELETE /api/preset-libraries/{ownerCode}/presets/{presetId}
POST   /api/preset-libraries/{ownerCode}/rotate-codes
```

Recommended behavior:

- Return a library revision with every successful read or mutation.
- Reject updates made against a stale revision with a conflict response.
- Use an idempotency key for batch uploads so retrying a request does not create duplicates.
- Validate the full normalized schema on the server, even when the client has already validated it.
- Return per-record errors for mixed-validity uploads.
- Decide and document whether batch uploads are partial-success or atomic. Partial success is recommended so one invalid preset does not discard an otherwise valid batch.
- Never expose code hashes or owner credentials in ordinary responses.

## 5. Frontend Changes

### 5.1 Import pipeline

Create a format-neutral upload pipeline that:

1. Detects Showdown text versus JSON.
2. Parses one or more sets.
3. Validates species, moves, abilities, items, types, natures, levels, and stat ranges for the selected generation.
4. Normalizes ids, names, defaults, and stat keys.
5. Detects duplicates within the upload and against the active library.
6. Produces valid presets plus structured per-set errors.

Reuse the existing Showdown behavior from [src/import/pokemonSetParser.ts](../src/import/pokemonSetParser.ts) rather than creating a second parser with different rules.

The JSON format must be versioned. Example:

```json
{
  "schemaVersion": 1,
  "generation": 9,
  "presets": [
    {
      "species": "Venusaur",
      "buildName": "Sun Sweeper",
      "level": 100,
      "nature": "Timid",
      "evs": { "spa": 252, "spe": 252, "hp": 4 },
      "ivs": { "hp": 31, "atk": 31, "def": 31, "spa": 31, "spd": 31, "spe": 31 },
      "moves": ["Growth", "Giga Drain", "Sludge Bomb", "Weather Ball"]
    }
  ]
}
```

### 5.2 Remote repository and cache

Add a typed client or repository abstraction with operations for:

- Creating a library
- Opening a library by read code
- Uploading a batch
- Updating a preset
- Deleting a preset
- Rotating/revoking codes

Keep this separate from [src/import/pokemonSetStorage.ts](../src/import/pokemonSetStorage.ts). The existing storage module owns current session imports and should not become a mixture of browser storage and network behavior.

Persist the active library cache using `localStorage` or IndexedDB. Cache entries must include the server revision. Failed writes must not silently replace newer remote data.

### 5.3 UI integration

Extend [src/components/one-vs-one/PokemonSetTools.tsx](../src/components/one-vs-one/PokemonSetTools.tsx) with:

- File selection for `.txt` and `.json`
- Drag-and-drop support
- Paste import retained as an alternative
- Upload preview with valid and invalid counts
- Per-preset validation errors
- Duplicate handling
- Upload progress, retry, and failure states
- Export support for Showdown and JSON where appropriate

Add library controls near the existing preset-library controls:

- Create a library
- Open a library by code
- Copy read and owner codes/links
- Show active library and revision state
- Rotate or revoke owner access
- Refresh the cached library

Add a user-preset management view or panel for editing and deleting presets. Reuse existing combatant/set fields where possible instead of introducing a second form model.

### 5.4 Calculator integration

Update [src/components/one-vs-one/OneVsOneMode.tsx](../src/components/one-vs-one/OneVsOneMode.tsx) to:

- Load the active remote library
- Expose remote presets to both combatant panels
- Refresh after mutations
- Fall back to the last valid cache when offline
- Handle invalid codes, loading, empty, conflict, and server-error states
- Keep generation changes explicit rather than inferring generation from the current combatant

Update [src/components/combatant/fields/CombatantIdentityFields.tsx](../src/components/combatant/fields/CombatantIdentityFields.tsx) to show a distinct `User presets` source/group. Preserve the existing legacy preset grouping and imported-set behavior.

Keep [src/components/combatant/CombatantPanel.tsx](../src/components/combatant/CombatantPanel.tsx) limited to prop plumbing. Persistence and network behavior should remain above the combatant panel boundary.

Continue using [src/components/combatant/shared/combatantDraft.ts](../src/components/combatant/shared/combatantDraft.ts) to apply a selected preset to a combatant.

## 6. Migration

Current imported sets are stored under `pokemans.imported-pokemon-sets.v1` in `sessionStorage`.

Add an explicit `Migrate to library` action that:

1. Reads the current local imported sets.
2. Shows a preview and duplicate warnings.
3. Uploads only after the user confirms.
4. Retains the local sets until the server confirms success.
5. Reports any records that could not be migrated.

Do not automatically upload existing user data when the remote feature is first enabled.

Legacy build-time libraries should remain read-only and should not be silently copied into a user's library.

## 7. Implementation Phases

### Phase 1: Contract and backend boundary

- Decide where the backend will live.
- Define the API and JSON schema.
- Define code generation, hashing, revocation, and revision semantics.
- Create database migrations and API contract tests.

### Phase 2: Frontend domain and client

- Add format detection and JSON parsing.
- Extract reusable validation and normalization.
- Add typed API client/repository.
- Add cache and revision handling.
- Add runtime API configuration in [src/config/runtimeConfig.ts](../src/config/runtimeConfig.ts).

### Phase 3: Upload and management UI

- Add file upload and drag/drop.
- Add preview and validation errors.
- Add library creation/opening and code management.
- Add user-preset edit/delete controls.

### Phase 4: Calculator integration and migration

- Load remote presets in `OneVsOneMode`.
- Add user-preset picker grouping.
- Add offline fallback.
- Add explicit local-to-remote migration.

### Phase 5: Rollout

- Add a feature flag or opt-in library control.
- Test two separate browser profiles against the same library.
- Monitor failed uploads, conflicts, storage usage, and API errors.
- Remove the flag after migration and conflict behavior are stable.

## 8. Testing Strategy

### Unit tests

- Showdown and JSON format detection
- JSON schema validation
- Unknown species, moves, abilities, items, and types
- Stat defaults and range validation
- Duplicate identity handling
- Mixed valid/invalid batches
- Stable id generation and source metadata

### Repository and API tests

- Cache round trips
- Revision conflict behavior
- Stale cache handling
- Retry and idempotency behavior
- Read-code access
- Owner-code mutations
- Invalid and revoked codes
- Code rotation
- Batch partial-success behavior

### Component and integration tests

- Upload preview
- Error aggregation
- Create/open library flow
- Edit and delete
- Remote preset selection in both combatants
- Offline calculation using cached presets
- Explicit migration from session storage

### Manual verification

1. Create a library in one browser profile.
2. Open it in a second browser profile using the read code.
3. Upload a mixed-validity batch.
4. Confirm valid presets appear in the calculator.
5. Edit and delete a preset with the owner code.
6. Refresh both profiles and confirm the revision is synchronized.
7. Revoke or rotate the owner code and confirm the old code no longer mutates data.
8. Disable the network and confirm the last valid cached presets still work in calculations.

Run the existing project checks after implementation:

```text
npm run typecheck
npm test
npm run lint
npm run build
```

## 9. Open Decisions

1. Where should the backend be hosted and deployed?
2. Should this repository contain the backend, or should it be a separate service?
3. Should share-code access eventually be replaced by account authentication?
4. Should a library support multiple generations, or require one generation per library?
5. Should duplicate uploads update existing presets, skip them, or create copies?
6. Should user presets be eligible for the existing Party feature?
7. Should exports include the remote library metadata or only portable preset data?
8. What database limits and upload-size limits are appropriate?

## 10. Recommendation

Start with a private remote library and a narrow API contract, while preserving the current local import flow. Build the upload parser and client-side UI behind an opt-in feature flag. Use local caching to preserve responsiveness and offline calculation, but keep the server as the source of truth for cross-browser persistence.
