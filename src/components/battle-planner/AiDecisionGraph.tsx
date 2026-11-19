import { useId, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import type {
  GraphMovePrediction,
  GraphPrediction,
  ViewNode,
} from 'ai/runAndBunGraph';
import FlowGraph from './FlowGraph';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function AiDecisionGraph({ graph }: { graph: GraphPrediction }) {
  const [detailMove, setDetailMove] = useState<string>();
  if (!graph.moves.length) {
    return graph.unsupported.length ? (
      <p className="small text-danger mb-0">
        AI graph unavailable: {graph.unsupported.join(', ')}.
      </p>
    ) : null;
  }
  return (
    <details className="mt-2 fw-normal text-body">
      <summary>Move probabilities and decision graph</summary>
      <p className="small mb-1">
        Exact probabilities for supported singles rules; some battle state is
        not modelled and recovery is approximated.
      </p>
      <div aria-label="AI move probabilities">
        {graph.moves.map((move) => (
          <div className="border-top py-1" key={move.name}>
            <div className="d-flex align-items-center justify-content-between gap-2">
              <strong>{move.name}</strong>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                aria-label={`View ${move.name} AI details`}
                onClick={() => setDetailMove(move.name)}
              >
                <span aria-hidden="true">ⓘ</span> Details
              </button>
            </div>
            <div>Graph {percent(move.chance)}</div>
            <div
              className="progress"
              role="img"
              aria-label={`${move.name} graph selection probability ${percent(move.chance)}`}
              style={{ height: '0.5rem' }}
            >
              <div
                className="progress-bar bg-success"
                style={{ width: percent(move.chance) }}
              />
            </div>
          </div>
        ))}
        {detailMove && (
          <GraphExplorer
            key={detailMove}
            initialMove={detailMove}
            moves={graph.moves}
            onClose={() => setDetailMove(undefined)}
          />
        )}
      </div>
    </details>
  );
}

function describe(node: ViewNode, reach: Record<string, number>): string {
  const reached = reach[node.id] ?? 0;
  if (reached === 0)
    return 'This rule is never reached in the current matchup.';
  const at = `Reached in ${percent(reached)} of outcomes.`;
  if (node.kind === 'condition') {
    const yes = (reach[`${node.id}:yes`] ?? 0) / reached;
    return `${at} Condition is true ${percent(yes)} of the time.`;
  }
  if (node.kind === 'add')
    return `${at} Adds ${node.score >= 0 ? '+' : ''}${node.score}.`;
  if (node.kind === 'never')
    return `${at} The move scores -20 and scoring stops.`;
  return `${at} Chance branches: ${node.branches
    .map((branch) => percent(branch.probability))
    .join(' / ')}.`;
}

function GraphExplorer({
  initialMove,
  moves,
  onClose,
}: {
  initialMove: string;
  moves: GraphMovePrediction[];
  onClose: () => void;
}) {
  const titleId = useId();
  const [moveName, setMoveName] = useState(initialMove);
  const [selected, setSelected] = useState<ViewNode>();
  const move = moves.find((entry) => entry.name === moveName) ?? moves[0];
  if (!move) return null;
  return (
    <Modal
      show
      onHide={onClose}
      size="xl"
      fullscreen="sm-down"
      scrollable
      animation={false}
      aria-labelledby={titleId}
    >
      <Modal.Header closeButton>
        <Modal.Title id={titleId}>AI decision breakdown</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-wrap gap-1 mb-3" aria-label="Choose a move">
          {moves.map((entry) => (
            <button
              key={entry.name}
              type="button"
              aria-pressed={entry.name === move.name}
              className={`btn btn-sm ${entry.name === move.name ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => {
                setMoveName(entry.name);
                setSelected(undefined);
              }}
            >
              {entry.name}
            </button>
          ))}
        </div>
        <div className="row g-3">
          <div className="col-lg-8">
            <h2 className="h5">Decision graph: {move.name}</h2>
            <div style={{ overflowX: 'auto' }}>
              <FlowGraph
                move={move}
                selected={selected?.id}
                onSelect={setSelected}
              />
            </div>
            <p className="small mb-0" role="status">
              {selected ? (
                <>
                  <strong>
                    {selected.kind === 'chance'
                      ? 'Chance node'
                      : selected.label}
                  </strong>
                  {' — '}
                  {describe(selected, move.reach)}
                </>
              ) : (
                'Select a node to see how often it applies. Blue paths are taken in at least one outcome; dimmed branches are never taken.'
              )}
            </p>
          </div>
          <div className="col-lg-4">
            <h2 className="h5">Score distribution and rules</h2>
            <p className="small">Graph {percent(move.chance)}</p>
            {move.name === 'Belch' && (
              <p className="small text-body-secondary">
                Belch is scored as unusable until the AI has eaten a Berry; this
                behavior has not been verified.
              </p>
            )}
            {move.scores.map(({ score, probability }) => (
              <div key={score} className="d-flex align-items-center gap-2">
                <span>
                  Score {score}: {percent(probability)}
                </span>
                <div
                  className="progress flex-grow-1"
                  role="img"
                  aria-label={`Score ${score} probability ${percent(probability)}`}
                  style={{ height: '0.5rem' }}
                >
                  <div
                    className="progress-bar"
                    style={{ width: percent(probability) }}
                  />
                </div>
              </div>
            ))}
            <ul className="small mt-2 mb-0">
              {move.traces.map((trace, index) => (
                <li key={index}>
                  {percent(trace.probability)}:{' '}
                  {trace.rules.join(', ') || 'No bonuses'} → {trace.score}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
