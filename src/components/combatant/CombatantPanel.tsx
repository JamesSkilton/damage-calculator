import type { BattleGeneration } from 'domain/index';
import type { BattleCombatant } from 'domain/index';
import type { MoveDraft } from './moveDraft';
import CombatantBattleStateFields from './CombatantBattleStateFields';
import CombatantIdentityFields from './CombatantIdentityFields';
import CombatantMoveFields from './CombatantMoveFields';
import CombatantStatGrids from './CombatantStatGrids';
import CombatantTypeFields from './CombatantTypeFields';
import { FieldGroup } from './combatantPanel.helpers';

type CombatantPanelProps = {
  title: string;
  description: string;
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
  generation: BattleGeneration;
  moves: readonly MoveDraft[];
  onMovesChange: (moves: readonly MoveDraft[]) => void;
  availableMoves?: string[];
};

export default function CombatantPanel({
  title,
  description,
  combatant,
  onChange,
  generation,
  moves,
  onMovesChange,
  availableMoves,
}: CombatantPanelProps) {
  return (
    <article className="combatant-panel">
      <header className="combatant-header">
        <div>
          <p className="combatant-eyebrow">{title}</p>
          <h3>{combatant.name || combatant.species || title}</h3>
        </div>
        <p className="combatant-description">{description}</p>
      </header>

      <FieldGroup title="Identity">
        <CombatantIdentityFields combatant={combatant} onChange={onChange} />
      </FieldGroup>

      <FieldGroup title="Type profile">
        <CombatantTypeFields combatant={combatant} onChange={onChange} />
      </FieldGroup>

      <FieldGroup title="Battle state">
        <CombatantBattleStateFields combatant={combatant} onChange={onChange} />
      </FieldGroup>

      <CombatantStatGrids combatant={combatant} onChange={onChange} />

      <CombatantMoveFields
        generation={generation}
        moves={moves}
        availableMoves={availableMoves}
        onChange={onMovesChange}
      />
    </article>
  );
}
