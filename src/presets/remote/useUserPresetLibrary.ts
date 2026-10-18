import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PresetLibraryError,
  type PresetInput,
  type PresetLibraryRepository,
  type PresetLibrarySnapshot,
  type UserPreset,
} from './types';
import { activateKnownPresetLibrary, loadPresetLibraryCache, savePresetLibraryCache } from './presetLibraryCache';
import type { SpeciesBaseStats } from '../baseStats';

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'offline' | 'error';

export interface UploadOutcome {
  created: number;
  createdPresets: UserPreset[];
  duplicates: number;
  errors: { index: number; message: string }[];
}

export interface UserPresetLibraryState {
  status: LibraryStatus;
  snapshot?: PresetLibrarySnapshot;
  presets: UserPreset[];
  baseStats: SpeciesBaseStats[];
  readCode?: string;
  ownerCode?: string;
  canEdit: boolean;
  error?: string;
  busy: boolean;
  createLibrary: (name: string) => Promise<boolean>;
  openLibrary: (code: string) => Promise<boolean>;
  switchLibrary: (libraryId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  uploadPresets: (presets: readonly PresetInput[]) => Promise<UploadOutcome | undefined>;
  updatePreset: (id: string, changes: Partial<PresetInput>) => Promise<boolean>;
  deletePreset: (id: string) => Promise<boolean>;
  reorderPresets: (order: readonly { id: string; index: number }[]) => Promise<boolean>;
  saveBaseStats: (baseStats: readonly SpeciesBaseStats[]) => Promise<boolean>;
  rotateCodes: () => Promise<boolean>;
}

const EMPTY: UserPreset[] = [];
const EMPTY_BASE_STATS: SpeciesBaseStats[] = [];

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useUserPresetLibrary(
  repository: PresetLibraryRepository | undefined,
): UserPresetLibraryState {
  const [initial] = useState(() => (repository ? loadPresetLibraryCache() : undefined));
  const [snapshot, setSnapshot] = useState(initial?.snapshot);
  const [accessCode, setAccessCode] = useState(initial?.accessCode);
  const [ownerCode, setOwnerCode] = useState(initial?.ownerCode);
  const [readCode, setReadCodeState] = useState(initial?.readCode);
  const readCodeRef = useRef(initial?.readCode);
  const setReadCode = (value: string | undefined) => {
    readCodeRef.current = value;
    setReadCodeState(value);
  };
  const [status, setStatus] = useState<LibraryStatus>(initial ? 'offline' : 'idle');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const apply = useCallback(
    (incoming: PresetLibrarySnapshot, codes: { access: string; owner?: string }) => {
      const current = snapshotRef.current;
      if (
        current &&
        current.library.id === incoming.library.id &&
        current.library.revision > incoming.library.revision
      ) {
        return;
      }
      // Preset mutations don't resend base stats, so carry them over for the same library.
      const next =
        incoming.baseStats === undefined && current?.library.id === incoming.library.id
          ? { ...incoming, baseStats: current.baseStats }
          : incoming;
      snapshotRef.current = next;
      setSnapshot(next);
      setAccessCode(codes.access);
      setOwnerCode(codes.owner);
      savePresetLibraryCache({
        accessCode: codes.access,
        ownerCode: codes.owner,
        readCode: readCodeRef.current,
        snapshot: next,
      });
    },
    [],
  );

  const fail = useCallback((cause: unknown, hasCache: boolean) => {
    const message = cause instanceof Error ? cause.message : 'Unexpected error.';
    setError(message);
    setStatus(
      cause instanceof PresetLibraryError && cause.kind === 'network' && hasCache ? 'offline' : 'error',
    );
  }, []);

  const load = useCallback(
    async (code: string, owner?: string): Promise<boolean> => {
      if (!repository) return false;
      setStatus('loading');
      setError(undefined);
      try {
        const next = await repository.open(code);
        const resolvedOwner = next.role === 'owner' ? code : owner;
        if (next.role === 'reader') setReadCode(code);
        else if (snapshotRef.current?.library.id !== next.library.id) setReadCode(undefined);
        apply(next, { access: code, owner: resolvedOwner });
        setStatus('ready');
        return true;
      } catch (cause) {
        fail(cause, Boolean(snapshotRef.current));
        return false;
      }
    },
    [apply, fail, repository],
  );

  useEffect(() => {
    if (repository && initial) void load(initial.accessCode, initial.ownerCode);
    // Initial cache revalidation only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guarded = async <T,>(
    action: () => Promise<T>,
    onConflict?: T,
  ): Promise<T | undefined> => {
    setBusy(true);
    setError(undefined);
    try {
      return await action();
    } catch (cause) {
      if (cause instanceof PresetLibraryError && cause.kind === 'conflict' && accessCode) {
        void load(accessCode, ownerCode);
        setError(cause.message);
        return onConflict;
      }
      fail(cause, Boolean(snapshotRef.current));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const requireOwner = (): { owner: string; snap: PresetLibrarySnapshot } | undefined => {
    if (!repository || !ownerCode || !snapshotRef.current) {
      setError('An owner code is required to change this library.');
      return undefined;
    }
    return { owner: ownerCode, snap: snapshotRef.current };
  };
  const openLibrary = useCallback(
    async (code: string) => (code.trim() ? load(code.trim()) : false),
    [load],
  );

  return {
    status,
    snapshot,
    presets: snapshot?.presets ?? EMPTY,
    baseStats: snapshot?.baseStats ?? EMPTY_BASE_STATS,
    readCode,
    ownerCode,
    canEdit: Boolean(ownerCode),
    error,
    busy,

    createLibrary: async (name) => {
      if (!repository) return false;
      const created = await guarded(() => repository.create(name));
      if (!created) return false;
      setReadCode(created.readCode);
      apply({ library: created.library, presets: [] }, { access: created.ownerCode, owner: created.ownerCode });
      setStatus('ready');
      return true;
    },

    openLibrary,

    switchLibrary: async (libraryId) => {
      const entry = activateKnownPresetLibrary(libraryId);
      if (!entry) return false;
      readCodeRef.current = entry.readCode;
      setReadCodeState(entry.readCode);
      snapshotRef.current = entry.snapshot;
      setSnapshot(entry.snapshot);
      setAccessCode(entry.accessCode);
      setOwnerCode(entry.ownerCode);
      setError(undefined);
      setStatus('offline');
      return load(entry.accessCode, entry.ownerCode);
    },
    refresh: async () => {
      if (accessCode) await load(accessCode, ownerCode);
    },

    uploadPresets: async (presets) => {
      const ctx = requireOwner();
      if (!ctx || !repository) return undefined;
      const key = newIdempotencyKey();
      const result = await guarded(() =>
        repository.upload(ctx.owner, presets, { revision: ctx.snap.library.revision, idempotencyKey: key }),
      );
      if (!result) return undefined;
      apply(
        {
          library: result.library,
          presets: [...ctx.snap.presets, ...result.created],
        },
        { access: accessCode ?? ctx.owner, owner: ctx.owner },
      );
      return {
        created: result.created.length,
        createdPresets: result.created,
        duplicates: result.duplicates.length,
        errors: result.errors,
      };
    },

    updatePreset: async (id, changes) => {
      const ctx = requireOwner();
      if (!ctx || !repository) return false;
      const result = await guarded(() =>
        repository.update(ctx.owner, id, changes, ctx.snap.library.revision),
      );
      if (!result) return false;
      apply(
        {
          library: result.library,
          presets: ctx.snap.presets.map((preset) => (preset.id === id ? result.preset : preset)),
        },
        { access: accessCode ?? ctx.owner, owner: ctx.owner },
      );
      return true;
    },

    deletePreset: async (id) => {
      const ctx = requireOwner();
      if (!ctx || !repository) return false;
      const result = await guarded(() => repository.remove(ctx.owner, id, ctx.snap.library.revision));
      if (!result) return false;
      apply(
        { library: result.library, presets: ctx.snap.presets.filter((preset) => preset.id !== id) },
        { access: accessCode ?? ctx.owner, owner: ctx.owner },
      );
      return true;
    },

    reorderPresets: async (order) => {
      const ctx = requireOwner();
      if (!ctx || !repository || order.length === 0) return false;
      const result = await guarded(() =>
        repository.reorder(ctx.owner, order, ctx.snap.library.revision),
      );
      if (!result) return false;
      const updated = new Map(result.presets.map((preset) => [preset.id, preset]));
      apply(
        {
          library: result.library,
          presets: ctx.snap.presets.map((preset) => updated.get(preset.id) ?? preset),
        },
        { access: accessCode ?? ctx.owner, owner: ctx.owner },
      );
      return true;
    },

    saveBaseStats: async (baseStats) => {
      const ctx = requireOwner();
      if (!ctx || !repository) return false;
      const result = await guarded(() =>
        repository.saveBaseStats(ctx.owner, baseStats, ctx.snap.library.revision),
      );
      if (!result) return false;
      apply(
        { library: result.library, presets: ctx.snap.presets, baseStats: result.baseStats },
        { access: accessCode ?? ctx.owner, owner: ctx.owner },
      );
      return true;
    },

    rotateCodes: async () => {
      const ctx = requireOwner();
      if (!ctx || !repository) return false;
      const codes = await guarded(() => repository.rotateCodes(ctx.owner));
      if (!codes) return false;
      setReadCode(codes.readCode);
      apply(ctx.snap, { access: codes.ownerCode, owner: codes.ownerCode });
      return true;
    },
  };
}
