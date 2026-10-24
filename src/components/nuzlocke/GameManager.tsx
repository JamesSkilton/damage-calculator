import { useState } from 'react';
import type { BattleGeneration } from 'domain/index';
import { battleGenerations } from '../combatant/shared/combatantPanel.constants';
import { parseRoutesText, routesToText } from '../../nuzlocke/gameText';
import type { GameInput, NuzlockeGame } from '../../nuzlocke/types';

type Props = {
  games: readonly NuzlockeGame[];
  defaultGeneration: BattleGeneration;
  disabled: boolean;
  onSave: (gameId: string | undefined, input: GameInput) => Promise<boolean>;
  onDelete: (game: NuzlockeGame) => Promise<void>;
};

export default function GameManager({
  games,
  defaultGeneration,
  disabled,
  onSave,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const editing = games.find((game) => game.id === editingId);
  const open = creating || editing !== undefined;

  const close = () => {
    setCreating(false);
    setEditingId(undefined);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <p className="text-body-secondary mb-0">
        Games are reusable route lists. Starting a run from a game pre-fills its
        routes and possible encounters.
      </p>
      {games.length > 0 && (
        <ul className="list-group">
          {games.map((game) => (
            <li
              key={game.id}
              className="list-group-item d-flex align-items-center gap-2"
            >
              <span className="flex-grow-1">
                <strong>{game.name}</strong>{' '}
                <span className="text-body-secondary">
                  Gen {game.generation} · {game.routes.length} routes
                </span>
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={disabled}
                onClick={() => {
                  setCreating(false);
                  setEditingId(game.id);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                disabled={disabled}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete "${game.name}"? Existing runs keep their routes.`,
                    )
                  ) {
                    if (game.id === editingId) close();
                    void onDelete(game);
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form
          key={editing?.id ?? 'new'}
          className="card card-body d-flex flex-column gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const saved = await onSave(editing?.id, {
              name: String(form.get('name')).trim(),
              generation: Number(form.get('generation')),
              routes: parseRoutesText(
                String(form.get('routes')),
                editing?.routes,
              ),
            });
            if (saved) close();
          }}
        >
          <h3 className="h6 mb-0">
            {editing ? `Edit ${editing.name}` : 'New game'}
          </h3>
          <div className="row g-2">
            <div className="col-sm-8">
              <label className="form-label" htmlFor="game-name">
                Game title
              </label>
              <input
                id="game-name"
                name="name"
                className="form-control"
                defaultValue={editing?.name}
                maxLength={80}
                required
              />
            </div>
            <div className="col-sm-4">
              <label className="form-label" htmlFor="game-generation">
                Generation
              </label>
              <select
                id="game-generation"
                name="generation"
                className="form-select"
                defaultValue={editing?.generation ?? defaultGeneration}
              >
                {battleGenerations.map((generation) => (
                  <option key={generation} value={generation}>
                    Gen {generation}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="game-routes">
              Routes and possible encounters
            </label>
            <textarea
              id="game-routes"
              name="routes"
              className="form-control font-monospace"
              rows={10}
              defaultValue={editing ? routesToText(editing.routes) : ''}
              placeholder={
                'Route 101: Zigzagoon 45%, Wurmple 45%, Poochyena 10%\nRoute 119 [Grass]: Zigzagoon 45%, Oddish 55%\nRoute 119 [Surfing]: Tentacool 60%, Wingull 40%\nRoute 119 [Fishing]: Magikarp 70%, Barboach 30%\nMeteor Falls > 1F1 [Grass]: Zubat 50%, Lunatone 10%\nMeteor Falls > 1F1 [Surfing]: Golbat 100%\nMeteor Falls > 1F2 [Grass]: Golbat 30%, Solrock 10%\nRustboro City'
              }
            />
            <div className="form-text">
              One route per line, in the order you reach them. After a colon,
              list the species that can appear (comma separated); leave it off
              to allow any species. Add a percentage to a species (Pidgey 40%)
              to show its encounter chance. For linked areas that count as one
              encounter, repeat the route name with an area, e.g. Meteor Falls
              &gt; 1F1: Zubat 50%, Lunatone 10%. Put a method in square brackets
              (Route 119 [Grass]: …, [Surfing], [Fishing]) to give each method
              its own percentages that add up together.
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={disabled}
            >
              Save game
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button
            type="button"
            className="btn btn-outline-primary"
            disabled={disabled}
            onClick={() => setCreating(true)}
          >
            New game
          </button>
        </div>
      )}
    </div>
  );
}
