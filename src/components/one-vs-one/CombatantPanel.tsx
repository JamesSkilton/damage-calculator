import type { BattleCombatant } from 'domain/index';
import CombatantBattleStateFields from 'components/combatant/CombatantBattleStateFields';
import CombatantIdentityFields from 'components/combatant/CombatantIdentityFields';
import CombatantMoveFields from 'components/combatant/CombatantMoveFields';
import CombatantStatGrids from 'components/combatant/CombatantStatGrids';
import CombatantTypeFields from 'components/combatant/CombatantTypeFields';
import { FieldGroup } from 'components/combatant/combatantPanel.helpers';

type CombatantPanelProps = {
  title: string;
  description: string;
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

export default function CombatantPanel({
  title,
  description,
  combatant,
  onChange,
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

      <CombatantMoveFields combatant={combatant} onChange={onChange} />
    </article>
  );
}
