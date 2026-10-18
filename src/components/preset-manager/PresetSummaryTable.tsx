import type { ReactNode } from 'react';
import type { ImportedPokemonSet } from '../../import/pokemonSet';

type PresetSummaryTableProps<T extends ImportedPokemonSet> = {
  presets: readonly T[];
  renderActions?: (preset: T) => ReactNode;
  showBuildName?: boolean;
};

export default function PresetSummaryTable<T extends ImportedPokemonSet>({
  presets,
  renderActions,
  showBuildName,
}: PresetSummaryTableProps<T>) {
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th scope="col">Pokémon</th>
            <th scope="col">Lv</th>
            <th scope="col">Item</th>
            <th scope="col">Nature</th>
            <th scope="col">Moves</th>
            {renderActions && (
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <tr key={preset.id}>
              <td>
                <strong>{preset.species}</strong>
                {showBuildName && preset.buildName && (
                  <div className="small text-body-secondary">{preset.buildName}</div>
                )}
                {preset.nickname && (
                  <div className="small text-body-secondary">“{preset.nickname}”</div>
                )}
              </td>
              <td>{preset.level}</td>
              <td>{preset.item ?? '—'}</td>
              <td>{preset.nature}</td>
              <td>
                {preset.moves.length === 0 ? (
                  '—'
                ) : (
                  <span className="d-flex flex-wrap gap-1">
                    {preset.moves.map((move) => (
                      <span className="badge text-bg-light border fw-normal" key={move}>
                        {move}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              {renderActions && <td className="text-end text-nowrap">{renderActions(preset)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
