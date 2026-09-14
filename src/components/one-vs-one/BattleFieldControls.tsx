import type { BattleField } from 'domain/index';
import { FieldGroup } from '../combatant/shared/combatantPanel.helpers';
import {
  battleTerrainOptions,
  battleWeatherOptions,
  setBattleFieldField,
  setBattleFieldSideCondition,
} from '../combatant/shared/battleFieldDraft';
import './BattleFieldControls.scss';

type BattleFieldControlsProps = {
  field: BattleField;
  onChange: (field: BattleField) => void;
};

const commonFieldToggles = [
  { key: 'isMagicRoom', label: 'Magic Room' },
  { key: 'isWonderRoom', label: 'Wonder Room' },
  { key: 'isGravity', label: 'Gravity' },
] as const;

const advancedFieldToggles = [
  { key: 'isAuraBreak', label: 'Aura Break' },
  { key: 'isFairyAura', label: 'Fairy Aura' },
  { key: 'isDarkAura', label: 'Dark Aura' },
  { key: 'isBeadsOfRuin', label: 'Beads of Ruin' },
  { key: 'isSwordOfRuin', label: 'Sword of Ruin' },
  { key: 'isTabletsOfRuin', label: 'Tablets of Ruin' },
  { key: 'isVesselOfRuin', label: 'Vessel of Ruin' },
] as const;

const screenToggles = [
  { key: 'isReflect', label: 'Reflect' },
  { key: 'isLightScreen', label: 'Light Screen' },
  { key: 'isAuroraVeil', label: 'Aurora Veil' },
] as const;

const sideToggles = [
  { key: 'isSR', label: 'Stealth Rock' },
  { key: 'steelsurge', label: 'Steelsurge' },
  { key: 'vinelash', label: 'Vine Lash' },
  { key: 'wildfire', label: 'Wildfire' },
  { key: 'cannonade', label: 'Cannonade' },
  { key: 'volcalith', label: 'Volcalith' },
  { key: 'isProtected', label: 'Protect' },
  { key: 'isSeeded', label: 'Leech Seed' },
  { key: 'isSaltCured', label: 'Salt Cure' },
  { key: 'isForesight', label: 'Foresight' },
  { key: 'isTailwind', label: 'Tailwind' },
  { key: 'isHelpingHand', label: 'Helping Hand' },
  { key: 'isFlowerGift', label: 'Flower Gift' },
  { key: 'isPowerTrick', label: 'Power Trick' },
  { key: 'isFriendGuard', label: 'Friend Guard' },
  { key: 'isBattery', label: 'Battery' },
  { key: 'isPowerSpot', label: 'Power Spot' },
  { key: 'isSteelySpirit', label: 'Steely Spirit' },
] as const;

const activeClassName = (isActive: boolean) =>
  isActive
    ? 'combatant-field form-check checkbox-field is-active col-12 col-md-4 d-flex align-items-center gap-2'
    : 'combatant-field form-check checkbox-field col-12 col-md-4 d-flex align-items-center gap-2';

function BattleSideControls({
  label,
  sideKey,
  field,
  onChange,
}: {
  label: string;
  sideKey: 'attackerSide' | 'defenderSide';
  field: BattleField;
  onChange: (field: BattleField) => void;
}) {
  const side = field[sideKey];

  return (
    <FieldGroup title={label}>
      <label className="combatant-field">
        <span>Spikes</span>
        <select
          value={side.spikes}
          onChange={(event) =>
            onChange(
              setBattleFieldSideCondition(
                field,
                sideKey,
                'spikes',
                event.target.value,
              ),
            )
          }
        >
          {[0, 1, 2, 3].map((spikes) => (
            <option key={spikes} value={spikes}>
              {spikes}
            </option>
          ))}
        </select>
      </label>

      <label className="combatant-field">
        <span>Switching</span>
        <select
          value={side.isSwitching ?? ''}
          onChange={(event) =>
            onChange(
              setBattleFieldSideCondition(
                field,
                sideKey,
                'isSwitching',
                event.target.value,
              ),
            )
          }
        >
          <option value="">None</option>
          <option value="out">Out</option>
          <option value="in">In</option>
        </select>
      </label>

      {screenToggles.map((toggle) => (
        <label
          key={toggle.key}
          className={activeClassName(side[toggle.key])}
        >
          <input
            className="form-check-input mt-0"
            type="checkbox"
            checked={side[toggle.key]}
            onChange={(event) =>
              onChange(
                setBattleFieldSideCondition(
                  field,
                  sideKey,
                  toggle.key,
                  event.target.checked,
                ),
              )
            }
          />
          <span>{toggle.label}</span>
        </label>
      ))}
    </FieldGroup>
  );
}

function AdvancedSideControls({
  sideKey,
  field,
  onChange,
}: {
  sideKey: 'attackerSide' | 'defenderSide';
  field: BattleField;
  onChange: (field: BattleField) => void;
}) {
  const side = field[sideKey];

  return (
    <FieldGroup title={sideKey === 'attackerSide' ? 'Attacker effects' : 'Defender effects'}>
      {sideToggles.map((toggle) => (
        <label key={toggle.key} className={activeClassName(side[toggle.key])}>
          <input
            className="form-check-input mt-0"
            type="checkbox"
            checked={side[toggle.key]}
            onChange={(event) =>
              onChange(
                setBattleFieldSideCondition(
                  field,
                  sideKey,
                  toggle.key,
                  event.target.checked,
                ),
              )
            }
          />
          <span>{toggle.label}</span>
        </label>
      ))}
    </FieldGroup>
  );
}

export default function BattleFieldControls({
  field,
  onChange,
}: BattleFieldControlsProps) {
  return (
    <section className="battle-field-controls" aria-labelledby="battle-context-title">
      <div className="battle-field-header">
        <div>
          <p className="battle-field-eyebrow">Battlefield</p>
          <h2 id="battle-context-title">Battle Context</h2>
        </div>
        <p className="battle-field-summary">
          {field.weather || 'Clear'} weather, {field.terrain || 'No'} terrain
        </p>
      </div>

      <div className="battle-field-quick">
        <FieldGroup>
          <label className="combatant-field col-12 col-md-6">
            <span>Weather</span>
            <select
              value={field.weather ?? ''}
              onChange={(event) =>
                onChange(
                  setBattleFieldField(field, 'weather', event.target.value),
                )
              }
            >
              {battleWeatherOptions.map((option) => (
                <option key={option.value || 'clear'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="combatant-field col-12 col-md-6">
            <span>Terrain</span>
            <select
              value={field.terrain ?? ''}
              onChange={(event) =>
                onChange(
                  setBattleFieldField(field, 'terrain', event.target.value),
                )
              }
            >
              {battleTerrainOptions.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </FieldGroup>

        <FieldGroup>
          {commonFieldToggles.map((toggle) => (
            <label
              key={toggle.key}
              className={activeClassName(field[toggle.key])}
            >
              <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={field[toggle.key]}
                onChange={(event) =>
                  onChange(
                    setBattleFieldField(field, toggle.key, event.target.checked),
                  )
                }
              />
              <span>{toggle.label}</span>
            </label>
          ))}
        </FieldGroup>

        <BattleSideControls
          label="Screens and hazards: Attacker side"
          sideKey="attackerSide"
          field={field}
          onChange={onChange}
        />
        <BattleSideControls
          label="Screens and hazards: Defender side"
          sideKey="defenderSide"
          field={field}
          onChange={onChange}
        />
      </div>

      <details className="battle-field-advanced">
        <summary>Advanced Context</summary>
        <div className="battle-field-advanced-content">
          <FieldGroup title="Auras and Ruin abilities">
            {advancedFieldToggles.map((toggle) => (
              <label
                key={toggle.key}
                className={activeClassName(field[toggle.key])}
              >
                <input
                  className="form-check-input mt-0"
                  type="checkbox"
                  checked={field[toggle.key]}
                  onChange={(event) =>
                    onChange(
                      setBattleFieldField(field, toggle.key, event.target.checked),
                    )
                  }
                />
                <span>{toggle.label}</span>
              </label>
            ))}
          </FieldGroup>
          <div className="battle-field-sides">
            <AdvancedSideControls sideKey="attackerSide" field={field} onChange={onChange} />
            <AdvancedSideControls sideKey="defenderSide" field={field} onChange={onChange} />
          </div>
        </div>
      </details>
    </section>
  );
}
