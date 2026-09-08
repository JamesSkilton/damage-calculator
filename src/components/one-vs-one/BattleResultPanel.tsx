import { useState, type CSSProperties } from 'react';
import type { BattleCombatant, BattleStatId } from 'domain/index';
import type { BattleCalcBreakdown } from 'adapters/battleCalc';
import type {
  BattleCalcDetails,
  BattleCalcKoBreakdownEntry,
} from 'adapters/battleCalc';
import type { MoveDraft } from '../combatant/moves/moveDraft';
import type { MoveOption } from '../combatant/moves/moveOptions';
import { resolveMoveOption } from '../combatant/moves/moveOptions';
import type { SpeciesOption } from '../combatant/species/speciesOptions';
import { setCombatantSpecies } from '../combatant/shared/combatantDraft';
import SearchableMovePicker from '../combatant/moves/SearchableMovePicker';
import SearchablePokemonPicker from '../combatant/species/SearchablePokemonPicker';
import HpRangeBar from '../shared/HpRangeBar';
import PokemonSprite from '../shared/PokemonSprite';
import TypeBadge from 'components/typeBadge/TypeBadge';
import './BattleResultPanel.scss';

type BattleResultPanelProps = {
  title?: string;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  moves: readonly MoveDraft[];
  results: readonly BattleCalcBreakdown[];
  availableMoves: MoveOption[];
  availableSpecies: SpeciesOption[];
  onAttackerChange: (combatant: BattleCombatant) => void;
  onDefenderChange: (combatant: BattleCombatant) => void;
  onMoveNameChange: (slotIndex: number, moveName: string) => void;
  onMoveCritChange?: (slotIndex: number, isCrit: boolean) => void;
  onSwapSides?: () => void;
};

const STAT_LABELS: Record<BattleStatId, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

function formatPercent(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

/**
 * Picks the single most relevant KO breakdown entry: the lowest hit count
 * with a non-zero chance (the "likely" KO scenario), or the highest hit
 * count considered (e.g. 4HKO) if a KO isn't likely within that window.
 */
function primaryKo(details: BattleCalcDetails): BattleCalcKoBreakdownEntry {
  return (
    details.koBreakdown.find((entry) => entry.chance > 0) ??
    details.koBreakdown[details.koBreakdown.length - 1]
  );
}

/** Physical moves care about Atk/Def, Special moves care about SpA/SpD. */
function relevantStatFor(
  category: string | undefined,
  side: 'attacker' | 'defender',
): BattleStatId | undefined {
  if (category === 'Physical') {
    return side === 'attacker' ? 'atk' : 'def';
  }
  if (category === 'Special') {
    return side === 'attacker' ? 'spa' : 'spd';
  }
  return undefined;
}

/**
 * Computes the defender's remaining-HP range after this attack, clamped to
 * [0, currentHp]. `remainingMax` is what's left after the weakest roll,
 * `remainingMin` is what's left after the strongest roll.
 */
function remainingHpRange(details: BattleCalcDetails): {
  remainingMin: number;
  remainingMax: number;
} {
  const { defenderCurrentHp, possibleDamage } = details;
  const minDamage = possibleDamage[0] ?? 0;
  const maxDamage = possibleDamage[possibleDamage.length - 1] ?? 0;

  return {
    remainingMin: Math.max(0, defenderCurrentHp - maxDamage),
    remainingMax: Math.max(0, defenderCurrentHp - minDamage),
  };
}

function HpRemainingBar({ details }: { details: BattleCalcDetails }) {
  const { defenderMaxHp } = details;

  if (defenderMaxHp <= 0) {
    return null;
  }

  const { remainingMin, remainingMax } = remainingHpRange(details);
  const toPercent = (value: number) => (value / defenderMaxHp) * 100;
  const primary = primaryKo(details);

  return (
    <div className="calc-hp-remaining">
      <div className="calc-hp-remaining-header">
        <div className="calc-hp-remaining-summary">
          <p className="calc-hp-remaining-label">Defender HP after this hit</p>
          <p className="calc-hp-remaining-value">
            {remainingMin === remainingMax
              ? `${remainingMin}`
              : `${remainingMin}–${remainingMax}`}{' '}
            / {defenderMaxHp}
            <span className="calc-hp-remaining-percent">
              ({toPercent(remainingMin).toFixed(1)}–
              {toPercent(remainingMax).toFixed(1)}%)
            </span>
          </p>
        </div>

        <div className="calc-hp-remaining-stats">
          <span className="calc-hp-stat">
            Avg.{' '}
            <strong>
              {details.averageDamage.toFixed(1)} (
              {details.averagePercent.toFixed(1)}%)
            </strong>
          </span>
          <span className="calc-summary-sep" aria-hidden="true">
            ·
          </span>
          <span className="calc-hp-stat">
            {primary.label} chance{' '}
            <strong>{formatPercent(primary.chance)}</strong>
          </span>
          <span className="calc-summary-sep" aria-hidden="true">
            ·
          </span>
          <span className="calc-hp-stat">
            Crit. OHKO <strong>{details.isCritOhko ? 'Yes' : 'No'}</strong>
          </span>
        </div>
      </div>

      <HpRangeBar
        min={remainingMin}
        max={remainingMax}
        maxHp={defenderMaxHp}
        label="Defender"
      />
    </div>
  );
}

type CombatantCardProps = {
  combatant: BattleCombatant;
  accent: 'attacker' | 'defender';
  statId?: BattleStatId;
  isEditing: boolean;
  onToggleEdit: () => void;
  availableSpecies: SpeciesOption[];
  onSelect: (speciesName: string) => void;
};

function CombatantCard({
  combatant,
  accent,
  statId,
  isEditing,
  onToggleEdit,
  availableSpecies,
  onSelect,
}: CombatantCardProps) {
  const label = accent === 'attacker' ? 'Attacker' : 'Defender';

  return (
    <div className={`calc-node calc-combatant calc-${accent}`}>
      <p className="calc-combatant-label">{label}</p>
      <PokemonSprite
        className="calc-sprite"
        name={combatant.species || combatant.name}
        alt={combatant.name || combatant.species}
      />

      {isEditing ? (
        <SearchablePokemonPicker
          value={combatant.species}
          options={availableSpecies}
          onSelect={onSelect}
          ariaLabel={`${label} species`}
          placeholder="— Select a Pokémon —"
        />
      ) : (
        <>
          <p className="calc-combatant-name">
            {combatant.name || combatant.species || '—'}
          </p>
          <div className="calc-type-row">
            {combatant.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
          <p className="calc-combatant-stat">
            {statId
              ? `${combatant.evs[statId]} ${STAT_LABELS[statId]} · ${combatant.nature}`
              : combatant.nature}
          </p>
        </>
      )}

      <button type="button" className="calc-change-link" onClick={onToggleEdit}>
        {isEditing ? 'Done' : 'Change'}
      </button>
    </div>
  );
}

export default function BattleResultPanel({
  title = 'Damage results',
  attacker,
  defender,
  moves,
  results,
  availableMoves,
  availableSpecies,
  onAttackerChange,
  onDefenderChange,
  onMoveNameChange,
  onMoveCritChange,
  onSwapSides,
}: BattleResultPanelProps) {
  const [editingAttacker, setEditingAttacker] = useState(false);
  const [editingDefender, setEditingDefender] = useState(false);
  const [editingMoveSlot, setEditingMoveSlot] = useState<number | null>(null);

  const rows = results.filter(
    (result): result is Extract<BattleCalcBreakdown, { result: unknown }> =>
      Boolean(result.result),
  );
  const errorRows = results.filter((result) => Boolean(result.error));

  const firstMoveOption =
    rows.length > 0
      ? resolveMoveOption(moves[rows[0].slotIndex]?.name ?? '', availableMoves)
      : undefined;
  const attackerStat = relevantStatFor(firstMoveOption?.category, 'attacker');
  const defenderStat = relevantStatFor(firstMoveOption?.category, 'defender');

  const rowCount = Math.max(rows.length, 1);
  const gridStyle = { '--calc-rows': rowCount } as CSSProperties;

  return (
    <section className="battle-results" aria-label={title}>
      <div className="calc-results-header">
        <h2 className="calc-results-title">{title}</h2>
        {onSwapSides && (
          <button
            type="button"
            className="calc-swap-button"
            onClick={onSwapSides}
            aria-label="Swap attacker and defender"
          >
            ⇄ <span>Swap sides</span>
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="calc-empty">
          Add a move to see the calculator breakdown.
        </p>
      ) : (
        <div className="calc-grid" style={gridStyle}>
          <CombatantCard
            combatant={attacker}
            accent="attacker"
            statId={attackerStat}
            isEditing={editingAttacker}
            onToggleEdit={() => setEditingAttacker((current) => !current)}
            availableSpecies={availableSpecies}
            onSelect={(species) => {
              onAttackerChange(
                setCombatantSpecies(attacker, species, availableSpecies),
              );
              setEditingAttacker(false);
            }}
          />

          <div className="calc-arrow calc-arrow-in" aria-hidden="true">
            →
          </div>

          {rows.map((row, index) => {
            const moveDraft = moves[row.slotIndex];
            const moveOption = resolveMoveOption(
              moveDraft?.name ?? '',
              availableMoves,
            );
            const isEditingMove = editingMoveSlot === row.slotIndex;
            const rowStyle = { '--calc-row': index + 1 } as CSSProperties;
            const details = row.details;

            return (
              <div
                key={row.slotIndex}
                className="calc-attack-row"
                style={rowStyle}
              >
                <div className="calc-node calc-move" style={rowStyle}>
                  <div className="calc-move-header">
                    <p className="calc-move-slot">Move {row.slotIndex + 1}</p>
                    <label className="calc-crit-toggle">
                      <input
                        type="checkbox"
                        checked={moveDraft?.isCrit ?? false}
                        onChange={(event) =>
                          onMoveCritChange?.(
                            row.slotIndex,
                            event.target.checked,
                          )
                        }
                        aria-label={`Move ${row.slotIndex + 1} critical hit`}
                      />
                      <span>Crit</span>
                    </label>
                  </div>

                  {isEditingMove ? (
                    <SearchableMovePicker
                      value={moveDraft?.name ?? ''}
                      options={availableMoves}
                      onSelect={(moveName) => {
                        onMoveNameChange(row.slotIndex, moveName);
                        setEditingMoveSlot(null);
                      }}
                      ariaLabel={`Move ${row.slotIndex + 1}`}
                      placeholder="— Select move —"
                    />
                  ) : (
                    <>
                      <p className="calc-move-name">{row.label}</p>
                      <p className="calc-move-meta">
                        {moveOption
                          ? `${moveOption.category} · ${moveOption.type}${moveOption.basePower > 0 ? ` · ${moveOption.basePower} BP` : ''}`
                          : '—'}
                      </p>
                    </>
                  )}

                  <button
                    type="button"
                    className="calc-change-link"
                    onClick={() =>
                      setEditingMoveSlot(isEditingMove ? null : row.slotIndex)
                    }
                  >
                    {isEditingMove ? 'Done' : 'Change Move'}
                  </button>
                </div>

                <div
                  className="calc-arrow calc-arrow-mid"
                  style={rowStyle}
                  aria-hidden="true"
                >
                  →
                </div>

                <div className="calc-node calc-damage" style={rowStyle}>
                  <p className="calc-damage-label">Damage range</p>
                  <p className="calc-damage-headline">
                    <span className="calc-damage-range">
                      {row.result.rangeText}
                    </span>
                    {details && (
                      <span className="calc-damage-percent">
                        ({details.percentRange.min.toFixed(1)}–
                        {details.percentRange.max.toFixed(1)}%)
                      </span>
                    )}
                    <span className="calc-damage-ko">
                      {row.result.koText ? capitalize(row.result.koText) : '—'}
                    </span>
                  </p>

                  {details && <HpRemainingBar details={details} />}

                  {details && details.damageRollFrequency.length > 1 && (
                    <div className="calc-roll-odds">
                      <p className="calc-roll-odds-label">Chance per roll</p>
                      <ul className="calc-roll-odds-list">
                        {details.damageRollFrequency.map(
                          ({ damage, count }) => (
                            <li key={damage} className="calc-roll-odds-item">
                              <span className="calc-roll-odds-damage">
                                {damage}
                              </span>
                              <span className="calc-roll-odds-chance">
                                {formatPercent(
                                  count / details.allDamageRolls.length,
                                )}
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="calc-arrow calc-arrow-out" aria-hidden="true">
            →
          </div>

          <CombatantCard
            combatant={defender}
            accent="defender"
            statId={defenderStat}
            isEditing={editingDefender}
            onToggleEdit={() => setEditingDefender((current) => !current)}
            availableSpecies={availableSpecies}
            onSelect={(species) => {
              onDefenderChange(
                setCombatantSpecies(defender, species, availableSpecies),
              );
              setEditingDefender(false);
            }}
          />
        </div>
      )}

      {errorRows.length > 0 && (
        <ul className="calc-error-list">
          {errorRows.map((row) => (
            <li key={row.slotIndex} className="calc-error-item">
              {row.label}: {row.error}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
