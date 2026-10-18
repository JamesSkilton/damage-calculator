import { useMemo, useState } from 'react';
import { presetLibraries, type PresetLibraryId } from '../../import/legacySets/legacyPresetCatalog';
import { summarizeBuiltInLibrary } from './builtInLibraries';
import type { LibraryStats } from './presetManagerUtils';

export type CatalogEntry = {
  id: string;
  name: string;
  stats: LibraryStats;
  canEdit: boolean;
  active: boolean;
};

type LibraryCatalogProps = {
  entries: readonly CatalogEntry[];
  busy: boolean;
  onSelect: (libraryId: string) => void;
  onSelectBuiltIn: (libraryId: PresetLibraryId) => void;
  onCreate: (name: string) => Promise<boolean>;
  onOpenWithCode: (code: string) => Promise<boolean>;
};

export default function LibraryCatalog({
  entries,
  busy,
  onSelect,
  onSelectBuiltIn,
  onCreate,
  onOpenWithCode,
}: LibraryCatalogProps) {
  const [libraryName, setLibraryName] = useState('');
  const [code, setCode] = useState('');
  const builtIns = useMemo(
    () => presetLibraries.map((library) => ({ library, stats: summarizeBuiltInLibrary(library) })),
    [],
  );

  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <form
            className="card card-body h-100"
            onSubmit={(event) => {
              event.preventDefault();
              if (libraryName.trim()) {
                void onCreate(libraryName.trim()).then((ok) => ok && setLibraryName(''));
              }
            }}
          >
            <h3 className="h6">Create a library</h3>
            <p className="small text-body-secondary">
              A library holds trainers and their Pokémon. Make one per game, hack or project.
            </p>
            <div className="input-group mt-auto">
              <input
                className="form-control"
                aria-label="Library name"
                placeholder="e.g. Emerald Kaizo"
                value={libraryName}
                onChange={(event) => setLibraryName(event.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={busy || !libraryName.trim()}>
                Create library
              </button>
            </div>
          </form>
        </div>
        <div className="col-12 col-lg-6">
          <form
            className="card card-body h-100"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim()) void onOpenWithCode(code.trim()).then((ok) => ok && setCode(''));
            }}
          >
            <h3 className="h6">Open a shared library</h3>
            <p className="small text-body-secondary">
              Paste a read code to browse someone else’s library, or an owner code to edit it.
            </p>
            <div className="input-group mt-auto">
              <input
                className="form-control"
                aria-label="Library code"
                placeholder="Read or owner code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <button className="btn btn-outline-primary" type="submit" disabled={busy || !code.trim()}>
                Open library
              </button>
            </div>
          </form>
        </div>
      </div>

      <section aria-labelledby="library-catalog-title">
        <h3 id="library-catalog-title" className="h6">
          Your libraries
        </h3>
        {entries.length === 0 ? (
          <p className="text-body-secondary mb-0">
            No libraries yet. Create one above to start adding trainers.
          </p>
        ) : (
          <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
            {entries.map((entry) => (
              <div className="col" key={entry.id}>
                <div className={`card h-100 ${entry.active ? 'border-primary' : ''}`}>
                  <div className="card-body d-flex flex-column gap-3">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <h4 className="h6 mb-0">{entry.name}</h4>
                      <span className={`badge ${entry.canEdit ? 'text-bg-primary' : 'text-bg-secondary'}`}>
                        {entry.canEdit ? 'Owner' : 'Read-only'}
                      </span>
                    </div>
                    <dl className="row text-center mb-0">
                      <div className="col-4">
                        <dd className="h4 mb-0">{entry.stats.trainers}</dd>
                        <dt className="small fw-normal text-body-secondary">Trainers</dt>
                      </div>
                      <div className="col-4">
                        <dd className="h4 mb-0">{entry.stats.pokemon}</dd>
                        <dt className="small fw-normal text-body-secondary">Pokémon</dt>
                      </div>
                      <div className="col-4">
                        <dd className="h4 mb-0">{entry.stats.generations.length}</dd>
                        <dt className="small fw-normal text-body-secondary">
                          {entry.stats.generations.length === 1
                            ? `Gen ${entry.stats.generations[0]}`
                            : 'Generations'}
                        </dt>
                      </div>
                    </dl>
                    <button
                      className="btn btn-outline-primary btn-sm mt-auto"
                      type="button"
                      disabled={busy}
                      aria-label={`Open ${entry.name}`}
                      onClick={() => onSelect(entry.id)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="builtin-catalog-title">
        <h3 id="builtin-catalog-title" className="h6">
          Built-in libraries
        </h3>
        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          {builtIns.map(({ library, stats }) => (
            <div className="col" key={library.id}>
              <div className="card h-100">
                <div className="card-body d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <h4 className="h6 mb-0">{library.label}</h4>
                    <span className="badge text-bg-secondary">Built-in</span>
                  </div>
                  <dl className="row text-center mb-0">
                    <div className="col-4">
                      <dd className="h4 mb-0">{stats.groups}</dd>
                      <dt className="small fw-normal text-body-secondary">{stats.groupLabel}</dt>
                    </div>
                    <div className="col-4">
                      <dd className="h4 mb-0">{stats.pokemon}</dd>
                      <dt className="small fw-normal text-body-secondary">Pokémon</dt>
                    </div>
                    <div className="col-4">
                      <dd className="h4 mb-0">{stats.generations.length}</dd>
                      <dt className="small fw-normal text-body-secondary">
                        {stats.generations.length === 1 ? `Gen ${stats.generations[0]}` : 'Generations'}
                      </dt>
                    </div>
                  </dl>
                  <button
                    className="btn btn-outline-primary btn-sm mt-auto"
                    type="button"
                    aria-label={`View ${library.label}`}
                    onClick={() => onSelectBuiltIn(library.id)}
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
