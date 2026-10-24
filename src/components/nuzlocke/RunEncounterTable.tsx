import { useMemo } from 'react';
import SearchablePokemonPicker from '../combatant/species/SearchablePokemonPicker';
import type { SpeciesOption } from '../combatant/species/speciesOptions';
import {
  ENCOUNTER_STATUSES,
  createId,
  formatRate,
  spawnTables,
  summarizeEncounters,
  type EncounterRates,
  type EncounterStatus,
  type RunEncounter,
} from '../../nuzlocke/types';
import {
  adjustRates,
  claimedFamilies,
  familyOf,
} from '../../nuzlocke/dupesClause';

const STATUS_LABELS: Record<EncounterStatus, string> = {
  pending: 'Not visited',
  caught: 'Caught',
  missed: 'Missed / fled',
  dead: 'Dead',
  skipped: 'Skipped',
};

type Props = {
  encounters: readonly RunEncounter[];
  speciesOptions: SpeciesOption[];
  disabled: boolean;
  onChange: (encounters: RunEncounter[]) => void;
};

export default function RunEncounterTable({
  encounters,
  speciesOptions,
  disabled,
  onChange,
}: Props) {
  const counts = useMemo(() => summarizeEncounters(encounters), [encounters]);

  const optionsFor = (encounter: RunEncounter): SpeciesOption[] => {
    // Dupes clause: a species is blocked if its evolution line is already caught or dead.
    const claimed = claimedFamilies(encounters, encounter.id);
    const toOption = (
      name: string,
      rates: Record<string, number>,
      groups: { group?: string; subGroup?: string } = {},
    ): SpeciesOption => {
      const base = speciesOptions.find((option) => option.name === name) ?? {
        name,
        types: [],
      };
      if (claimed.has(familyOf(name)))
        return {
          ...base,
          displayName: `${name} (duplicate)`,
          disabled: true,
          className: 'text-body-secondary text-decoration-line-through',
          ...groups,
        };
      return {
        ...base,
        ...(rates[name]
          ? { displayName: `${name} (${formatRate(rates[name])})` }
          : {}),
        ...groups,
      };
    };
    // Blocked species sink to the bottom; the rest sort by their adjusted chance.
    const sorted = (names: readonly string[], rawRates: EncounterRates) => {
      const rates = adjustRates(names, rawRates, claimed);
      const rank = (name: string) =>
        claimed.has(familyOf(name)) ? -1 : (rates[name] ?? 0);
      return {
        rates,
        names: [...names].sort((a, b) => rank(b) - rank(a)),
      };
    };

    // One table per area/method; several tables are listed under their own headings.
    const tables = spawnTables(encounter);
    if (tables.length === 0)
      return speciesOptions.map((option) =>
        claimed.has(familyOf(option.name))
          ? {
              ...option,
              displayName: `${option.name} (duplicate)`,
              disabled: true,
              className: 'text-body-secondary text-decoration-line-through',
            }
          : option,
      );
    return tables.flatMap((table) => {
      const { rates, names } = sorted(table.species, table.rates);
      // Area heading with the method nested under it; method-only routes just get methods.
      const groups =
        tables.length > 1
          ? {
              group: table.area ?? table.method,
              ...(table.area && table.method ? { subGroup: table.method } : {}),
            }
          : {};
      return names.map((name) => toOption(name, rates, groups));
    });
  };

  const update = (id: string, changes: Partial<RunEncounter>) =>
    onChange(
      encounters.map((encounter) => {
        if (encounter.id !== id) return encounter;
        const next = { ...encounter, ...changes };
        // Caught and dead both need a species, so clearing it resets the status.
        return !next.species &&
          (next.status === 'caught' || next.status === 'dead')
          ? { ...next, status: 'pending' as const }
          : next;
      }),
    );

  const addRoute = (form: HTMLFormElement) => {
    const input = form.elements.namedItem('route') as HTMLInputElement;
    const route = input.value.trim();
    if (!route) return;
    onChange([...encounters, { id: createId(), route, status: 'pending' }]);
    input.value = '';
  };

  return (
    <div className="d-flex flex-column gap-2">
      <p className="mb-0 text-body-secondary">
        {encounters.length} routes · {counts.caught} caught · {counts.dead} dead
      </p>
      <div>
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col" className="w-50">
                Pokémon
              </th>
              <th scope="col">Nickname</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {encounters.map((encounter) => (
              <tr key={encounter.id}>
                <th scope="row" className="fw-normal">
                  {encounter.route}
                 
                </th>
                <td>
                  <SearchablePokemonPicker
                    value={encounter.species ?? ''}
                    options={optionsFor(encounter)}
                    ariaLabel={`Pokémon for ${encounter.route}`}
                    onSelect={(species) => {
                      if (species !== (encounter.species ?? '')) {
                        update(encounter.id, {
                          species: species || undefined,
                          status:
                            species && encounter.status === 'pending'
                              ? 'caught'
                              : encounter.status,
                        });
                      }
                    }}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    defaultValue={encounter.nickname ?? ''}
                    maxLength={40}
                    disabled={disabled}
                    aria-label={`Nickname for ${encounter.route}`}
                    onBlur={(event) => {
                      const nickname = event.target.value.trim();
                      if (nickname !== (encounter.nickname ?? '')) {
                        update(encounter.id, {
                          nickname: nickname || undefined,
                        });
                      }
                    }}
                  />
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={encounter.status}
                    disabled={disabled}
                    aria-label={`Status for ${encounter.route}`}
                    onChange={(event) =>
                      update(encounter.id, {
                        status: event.target.value as EncounterStatus,
                      })
                    }
                  >
                    {ENCOUNTER_STATUSES.map((status) => (
                      <option
                        key={status}
                        value={status}
                        disabled={
                          (status === 'caught' || status === 'dead') &&
                          !encounter.species
                        }
                      >
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={disabled}
                    aria-label={`Remove ${encounter.route}`}
                    onClick={() =>
                      onChange(
                        encounters.filter((entry) => entry.id !== encounter.id),
                      )
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {encounters.length === 0 && (
              <tr>
                <td colSpan={5} className="text-body-secondary">
                  No routes yet. Add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form
        className="input-group"
        onSubmit={(event) => {
          event.preventDefault();
          addRoute(event.currentTarget);
        }}
      >
        <input
          name="route"
          className="form-control"
          placeholder="Add a route, e.g. Route 3"
          aria-label="New route name"
          maxLength={80}
          disabled={disabled}
        />
        <button
          type="submit"
          className="btn btn-outline-primary"
          disabled={disabled}
        >
          Add route
        </button>
      </form>
    </div>
  );
}
