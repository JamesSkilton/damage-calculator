import type { ImportedPokemonSet } from '../../import/pokemonSet';
import type { SpeciesBaseStats } from '../baseStats';

export interface PresetLibrary {
  id: string;
  name: string;
  readCode?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  presetCount: number;
}

export interface UserPreset extends ImportedPokemonSet {
  libraryId: string;
  buildName: string;
  sourceFormat: 'showdown' | 'json';
  createdAt: string;
  updatedAt: string;
}

export interface PresetLibrarySnapshot {
  library: PresetLibrary;
  presets: UserPreset[];
  /** Per-library species base stat overrides; absent on caches written before this existed. */
  baseStats?: SpeciesBaseStats[];
  role?: 'owner' | 'reader';
}

export interface CreatedLibrary {
  library: PresetLibrary;
  readCode: string;
  ownerCode: string;
}

export type PresetInput = Omit<
  UserPreset,
  'id' | 'libraryId' | 'createdAt' | 'updatedAt' | 'remote'
> & { id?: string };

export interface BatchUploadResult {
  library: PresetLibrary;
  created: UserPreset[];
  duplicates: { index: number; message: string }[];
  errors: { index: number; message: string }[];
}

export interface RotatedCodes {
  readCode: string;
  ownerCode: string;
}

export interface PresetLibraryRepository {
  create(name: string): Promise<CreatedLibrary>;
  open(code: string): Promise<PresetLibrarySnapshot>;
  upload(
    ownerCode: string,
    presets: readonly PresetInput[],
    options: { revision: number; idempotencyKey: string },
  ): Promise<BatchUploadResult>;
  update(
    ownerCode: string,
    presetId: string,
    changes: Partial<PresetInput>,
    revision: number,
  ): Promise<{ library: PresetLibrary; preset: UserPreset }>;
  remove(ownerCode: string, presetId: string, revision: number): Promise<{ library: PresetLibrary }>;
  reorder(
    ownerCode: string,
    order: readonly { id: string; index: number }[],
    revision: number,
  ): Promise<{ library: PresetLibrary; presets: UserPreset[] }>;
  saveBaseStats(
    ownerCode: string,
    baseStats: readonly SpeciesBaseStats[],
    revision: number,
  ): Promise<{ library: PresetLibrary; baseStats: SpeciesBaseStats[] }>;
  rotateCodes(ownerCode: string): Promise<RotatedCodes>;
}

export type PresetLibraryErrorKind =
  | 'invalid-code'
  | 'conflict'
  | 'network'
  | 'server'
  | 'invalid-response';

export class PresetLibraryError extends Error {
  readonly kind: PresetLibraryErrorKind;
  readonly status?: number;

  constructor(kind: PresetLibraryErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'PresetLibraryError';
    this.kind = kind;
    this.status = status;
  }
}
