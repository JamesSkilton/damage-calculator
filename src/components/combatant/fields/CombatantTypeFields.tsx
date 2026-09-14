import type { BattleCombatant, BattleTypeName } from 'domain/index';
import { setCombatantField, setCombatantTypes } from '../shared/combatantDraft';
import { battleTypes } from '../shared/combatantPanel.constants';
import SearchableTypePicker from '../shared/SearchableTypePicker';

const typeOptions = battleTypes.map((type) => ({ name: type }));
const typeOptionsWithNone = [{ name: '' }, ...typeOptions];

type CombatantTypeFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
  includeTypes?: boolean;
};

export default function CombatantTypeFields({
  combatant,
  onChange,
  includeTypes = true,
}: CombatantTypeFieldsProps) {
  const [primaryType, secondaryType] = combatant.types;
  const getTypeBadge = (option: { name: string }) =>
    option.name ? [option.name] : [];
  const filterTypes = (
    options: { name: string }[],
    searchTerm: string,
  ) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return normalizedSearch
      ? options.filter((option) => option.name.toLowerCase().includes(normalizedSearch))
      : options;
  };

  return (
    <>
      {includeTypes && <label className="combatant-field col-12 col-md-6 col-xl-3">
        <span className="form-label">Primary type</span>
        <SearchableTypePicker
          value={primaryType}
          options={typeOptions}
          onSelect={(type) =>
            onChange(
              setCombatantTypes(
                combatant,
                type as BattleTypeName,
                secondaryType,
              ),
            )
          }
          ariaLabel="Primary type"
          filterOptions={filterTypes}
          getTypes={getTypeBadge}
        />
      </label>}
      {includeTypes && <label className="combatant-field col-12 col-md-6 col-xl-3">
        <span className="form-label">Secondary type</span>
        <SearchableTypePicker
          value={secondaryType ?? ''}
          options={typeOptionsWithNone}
          onSelect={(type) =>
            onChange(
              setCombatantTypes(
                combatant,
                primaryType,
                type ? (type as BattleTypeName) : undefined,
              ),
            )
          }
          ariaLabel="Secondary type"
          placeholder="None"
          filterOptions={filterTypes}
          getTypes={getTypeBadge}
          getDisplayName={(option) => option.name || 'None'}
        />
      </label>}
      <label className="combatant-field col-12 col-md-6 col-xl-3">
        <span className="form-label">Tera type</span>
        <SearchableTypePicker
          value={combatant.teratype ?? ''}
          options={typeOptionsWithNone}
          onSelect={(type) =>
            onChange(
              setCombatantField(
                combatant,
                'teratype',
                type ? (type as BattleTypeName) : undefined,
              ),
            )
          }
          ariaLabel="Tera type"
          placeholder="None"
          filterOptions={filterTypes}
          getTypes={getTypeBadge}
          getDisplayName={(option) => option.name || 'None'}
        />
      </label>
      <label className="combatant-checkbox-field form-check col-12 col-md-6 col-xl-3 d-flex align-items-center gap-2">
        <input
          className="form-check-input mt-0"
          type="checkbox"
          checked={combatant.isTerastallized}
          onChange={(event) =>
            onChange(
              setCombatantField(
                combatant,
                'isTerastallized',
                event.target.checked,
              ),
            )
          }
        />
        <span className="form-check-label">Terastallized</span>
      </label>
    </>
  );
}
