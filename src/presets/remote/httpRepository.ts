import {
  PresetLibraryError,
  type BatchUploadResult,
  type CreatedLibrary,
  type PresetInput,
  type PresetLibrary,
  type PresetLibraryRepository,
  type PresetLibrarySnapshot,
  type RotatedCodes,
  type UserPreset,
} from './types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertLibrary(value: unknown): PresetLibrary {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.revision !== 'number'
  ) {
    throw new PresetLibraryError('invalid-response', 'Unexpected library response.');
  }
  return value as unknown as PresetLibrary;
}

function normalizePreset(value: unknown): UserPreset {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    typeof value.species !== 'string' ||
    typeof value.buildName !== 'string' ||
    !Array.isArray(value.moves) ||
    !isObject(value.evs) ||
    !isObject(value.ivs)
  ) {
    throw new PresetLibraryError('invalid-response', 'Unexpected preset response.');
  }
  return { ...(value as unknown as UserPreset), remote: true };
}

function normalizePresets(value: unknown): UserPreset[] {
  if (!Array.isArray(value)) {
    throw new PresetLibraryError('invalid-response', 'Unexpected preset list response.');
  }
  return value.map(normalizePreset);
}

export function createHttpPresetLibraryRepository(
  baseUrl: string,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): PresetLibraryRepository {
  const root = `${baseUrl.replace(/\/+$/, '')}/api/preset-libraries`;

  async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      });
    } catch {
      throw new PresetLibraryError('network', 'Could not reach the preset service.');
    }
    if (response.status === 404 || response.status === 401 || response.status === 403) {
      throw new PresetLibraryError('invalid-code', 'That code is invalid or has been revoked.', response.status);
    }
    if (response.status === 409) {
      throw new PresetLibraryError('conflict', 'The library changed elsewhere. Refresh and try again.', 409);
    }
    if (!response.ok) {
      throw new PresetLibraryError('server', `Preset service error (${response.status}).`, response.status);
    }
    try {
      const body: unknown = await response.json();
      if (!isObject(body)) throw new Error('not an object');
      return body;
    } catch {
      throw new PresetLibraryError('invalid-response', 'Preset service returned invalid data.');
    }
  }

  const code = (value: string) => encodeURIComponent(value.trim());

  return {
    async create(name): Promise<CreatedLibrary> {
      const body = await request('', { method: 'POST', body: JSON.stringify({ name }) });
      if (typeof body.readCode !== 'string' || typeof body.ownerCode !== 'string') {
        throw new PresetLibraryError('invalid-response', 'Unexpected create response.');
      }
      return { library: assertLibrary(body.library), readCode: body.readCode, ownerCode: body.ownerCode };
    },

    async open(value): Promise<PresetLibrarySnapshot> {
      const body = await request(`/${code(value)}`);
      return {
        library: assertLibrary(body.library),
        presets: normalizePresets(body.presets),
        role: body.role === 'owner' || body.role === 'reader' ? body.role : undefined,
      };
    },

    async upload(ownerCode, presets, options): Promise<BatchUploadResult> {
      const body = await request(`/${code(ownerCode)}/presets`, {
        method: 'POST',
        headers: { 'Idempotency-Key': options.idempotencyKey },
        body: JSON.stringify({
          revision: options.revision,
          idempotencyKey: options.idempotencyKey,
          presets,
        }),
      });
      return {
        library: assertLibrary(body.library),
        created: normalizePresets(body.created ?? []),
        duplicates: Array.isArray(body.duplicates) ? (body.duplicates as BatchUploadResult['duplicates']) : [],
        errors: Array.isArray(body.errors) ? (body.errors as BatchUploadResult['errors']) : [],
      };
    },

    async update(ownerCode, presetId, changes: Partial<PresetInput>, revision) {
      const body = await request(`/${code(ownerCode)}/presets/${encodeURIComponent(presetId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ revision, changes }),
      });
      return { library: assertLibrary(body.library), preset: normalizePreset(body.preset) };
    },

    async remove(ownerCode, presetId, revision) {
      const body = await request(
        `/${code(ownerCode)}/presets/${encodeURIComponent(presetId)}?revision=${revision}`,
        { method: 'DELETE' },
      );
      return { library: assertLibrary(body.library) };
    },

    async reorder(ownerCode, order, revision) {
      const body = await request(`/${code(ownerCode)}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ revision, order }),
      });
      return { library: assertLibrary(body.library), presets: normalizePresets(body.presets) };
    },

    async rotateCodes(ownerCode): Promise<RotatedCodes> {
      const body = await request(`/${code(ownerCode)}/rotate-codes`, { method: 'POST' });
      if (typeof body.readCode !== 'string' || typeof body.ownerCode !== 'string') {
        throw new PresetLibraryError('invalid-response', 'Unexpected rotate response.');
      }
      return { readCode: body.readCode, ownerCode: body.ownerCode };
    },
  };
}
