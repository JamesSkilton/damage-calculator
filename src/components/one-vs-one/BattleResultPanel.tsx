import type { BattleCombatant, BattleField } from 'domain/index';
import type { BattleCalcBreakdown } from 'adapters/battleCalc';
import './BattleResultPanel.scss';

type BattleResultPanelProps = {
  generationLabel: string;
  field: BattleField;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  results: readonly BattleCalcBreakdown[];
};

function formatCombatantSummary({
  name,
  species,
  level,
  status,
  currentHp,
}: BattleCombatant) {
  return `${name} (${species}) — Lv. ${level}, HP ${currentHp}${
    status ? `, ${status}` : ''
  }`;
}

function formatFieldSummary(field: BattleField) {
  const weather = field.weather ?? 'Clear';
  const terrain = field.terrain ?? 'No terrain';

  return `${weather} weather, ${terrain}`;
}

export default function BattleResultPanel({
  generationLabel,
  field,
  attacker,
  defender,
  results,
}: BattleResultPanelProps) {
  return (
    <section className="battle-results" aria-label="Damage results">
      <div className="battle-results-header">
        <div>
          <p className="battle-preview-label">Live result</p>
          <h3>Calc breakdown</h3>
          <p className="battle-preview-copy">
            Results update as the attacker, defender, moves, and field change.
          </p>
        </div>
        <div className="battle-control-chip" aria-label="Result count">
          {results.length > 0 ? `${results.length} move results` : 'No results'}
        </div>
      </div>

      {results.length > 0 ? (
        <div className="battle-result-list">
          {results.map((result) => (
            <article key={result.slotIndex} className="battle-result-card">
              <header className="battle-result-card-header">
                <p className="battle-result-slot">Move {result.slotIndex + 1}</p>
                <h4>{result.label}</h4>
              </header>

              {result.error ? (
                <p className="battle-result-error">{result.error}</p>
              ) : result.result ? (
                <div className="battle-result-body">
                  <p className="battle-result-summary">
                    {result.result.summary}
                  </p>
                  <dl className="battle-result-breakdown">
                    <div>
                      <dt>Damage range</dt>
                      <dd>{result.result.rangeText}</dd>
                    </div>
                    <div>
                      <dt>KO chance</dt>
                      <dd>{result.result.koText || '—'}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="battle-result-error">
                  Result data is unavailable.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="battle-result-empty">
          Add a move to see the calculator breakdown.
        </p>
      )}

      <dl className="battle-preview-grid">
        <div>
          <dt>Attacker</dt>
          <dd>{formatCombatantSummary(attacker)}</dd>
        </div>
        <div>
          <dt>Defender</dt>
          <dd>{formatCombatantSummary(defender)}</dd>
        </div>
        <div>
          <dt>Generation</dt>
          <dd>{generationLabel}</dd>
        </div>
        <div>
          <dt>Field</dt>
          <dd>{formatFieldSummary(field)}</dd>
        </div>
      </dl>
    </section>
  );
}
