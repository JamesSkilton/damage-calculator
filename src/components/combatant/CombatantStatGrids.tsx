import type { BattleCombatant } from 'domain/index';
import { StatGrid } from './combatantPanel.helpers';

type CombatantStatGridsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

export default function CombatantStatGrids({
  combatant,
  onChange,
}: CombatantStatGridsProps) {
  return (
    <>
      <div className="combatant-row">
        <StatGrid
          title="IVs"
          combatant={combatant}
          bucket="ivs"
          onChange={onChange}
          min={0}
          max={31}
        />
        <StatGrid
          title="EVs"
          combatant={combatant}
          bucket="evs"
          onChange={onChange}
          min={0}
          max={252}
        />
      </div>
      <StatGrid
        title="Boosts"
        combatant={combatant}
        bucket="boosts"
        onChange={onChange}
        min={-6}
        max={6}
      />
    </>
  );
}
