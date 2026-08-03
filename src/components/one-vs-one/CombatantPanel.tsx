import type {
  BattleCombatant,
  BattleGender,
  BattleStatusName,
  BattleTypeName,
} from 'domain/index';
import type { ReactNode } from 'react';
import {
  setCombatantField,
  setCombatantMove,
  setCombatantStat,
  setCombatantStatus,
  setCombatantTypes,
  statIds,
} from './combatantDraft';

const battleTypes: readonly BattleTypeName[] = [
  'Normal',
  'Fighting',
  'Flying',
  'Poison',
  'Ground',
  'Rock',
  'Bug',
  'Ghost',
  'Steel',
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Psychic',
  'Ice',
  'Dragon',
  'Dark',
  'Fairy',
  'Stellar',
  '???',
];

const battleGenders: readonly BattleGender[] = ['M', 'F', 'N'];
const battleStatuses: readonly (BattleStatusName | '')[] = [
  '',
  'slp',
  'psn',
  'brn',
  'frz',
  'par',
  'tox',
];

type CombatantPanelProps = {
  title: string;
  description: string;
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

type StatBucket = 'ivs' | 'evs' | 'boosts';

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="combatant-fieldset">
      <legend>{title}</legend>
      <div className="combatant-grid">{children}</div>
    </fieldset>
  );
}

function StatGrid({
  title,
  combatant,
  bucket,
  onChange,
  min,
  max,
}: {
  title: string;
  combatant: BattleCombatant;
  bucket: StatBucket;
  onChange: (combatant: BattleCombatant) => void;
  min: number;
  max: number;
}) {
  return (
    <fieldset className="combatant-fieldset">
      <legend>{title}</legend>
      <div className="combatant-stat-grid">
        {statIds.map((statId: (typeof statIds)[number]) => (
          <label key={statId} className="combatant-field">
            <span>{statId.toUpperCase()}</span>
            <input
              type="number"
              min={min}
              max={max}
              value={combatant[bucket][statId]}
              onChange={(event) =>
                onChange(
                  setCombatantStat(
                    combatant,
                    bucket,
                    statId,
                    Number(event.target.value),
                  ),
                )
              }
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function CombatantPanel({
  title,
  description,
  combatant,
  onChange,
}: CombatantPanelProps) {
  const [primaryType, secondaryType] = combatant.types;

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
        <label className="combatant-field">
          <span>Name</span>
          <input
            type="text"
            value={combatant.name}
            onChange={(event) =>
              onChange(setCombatantField(combatant, 'name', event.target.value))
            }
          />
        </label>

        <label className="combatant-field">
          <span>Species</span>
          <input
            type="text"
            value={combatant.species}
            onChange={(event) =>
              onChange(
                setCombatantField(combatant, 'species', event.target.value),
              )
            }
          />
        </label>

        <label className="combatant-field">
          <span>Gender</span>
          <select
            value={combatant.gender ?? 'N'}
            onChange={(event) =>
              onChange(
                setCombatantField(
                  combatant,
                  'gender',
                  event.target.value as BattleGender,
                ),
              )
            }
          >
            {battleGenders.map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>
        </label>

        <label className="combatant-field">
          <span>Level</span>
          <input
            type="number"
            min={1}
            max={100}
            value={combatant.level}
            onChange={(event) =>
              onChange(
                setCombatantField(
                  combatant,
                  'level',
                  Number(event.target.value),
                ),
              )
            }
          />
        </label>

        <label className="combatant-field">
          <span>Ability</span>
          <input
            type="text"
            value={combatant.ability ?? ''}
            onChange={(event) =>
              onChange(
                setCombatantField(
                  combatant,
                  'ability',
                  event.target.value,
                ),
              )
            }
          />
        </label>

        <label className="combatant-field">
          <span>Item</span>
          <input
            type="text"
            value={combatant.item ?? ''}
            onChange={(event) =>
              onChange(setCombatantField(combatant, 'item', event.target.value))
            }
          />
        </label>

        <label className="combatant-field">
          <span>Nature</span>
          <input
            type="text"
            value={combatant.nature}
            onChange={(event) =>
              onChange(
                setCombatantField(combatant, 'nature', event.target.value),
              )
            }
          />
        </label>
      </FieldGroup>

      <FieldGroup title="Type profile">
        <label className="combatant-field">
          <span>Primary type</span>
          <select
            value={primaryType}
            onChange={(event) =>
              onChange(
                setCombatantTypes(
                  combatant,
                  event.target.value as BattleTypeName,
                  secondaryType,
                ),
              )
            }
          >
            {battleTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="combatant-field">
          <span>Secondary type</span>
          <select
            value={secondaryType ?? ''}
            onChange={(event) =>
              onChange(
                setCombatantTypes(
                  combatant,
                  primaryType,
                  event.target.value === ''
                    ? undefined
                    : (event.target.value as BattleTypeName),
                ),
              )
            }
          >
            <option value="">None</option>
            {battleTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="combatant-field">
          <span>Tera type</span>
          <select
            value={combatant.teratype ?? ''}
            onChange={(event) =>
              onChange(
                setCombatantField(
                  combatant,
                  'teratype',
                  event.target.value === ''
                    ? undefined
                    : (event.target.value as BattleTypeName),
                ),
              )
            }
          >
            <option value="">None</option>
            {battleTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </FieldGroup>

      <FieldGroup title="Battle state">
        <label className="combatant-field">
          <span>Current HP</span>
          <input
            type="number"
            min={0}
            max={9999}
            value={combatant.currentHp}
            onChange={(event) =>
              onChange(
                setCombatantField(
                  combatant,
                  'currentHp',
                  Number(event.target.value),
                ),
              )
            }
          />
        </label>

        <label className="combatant-field">
          <span>Status</span>
          <select
            value={combatant.status ?? ''}
            onChange={(event) =>
              onChange(
                setCombatantStatus(
                  combatant,
                  event.target.value as BattleStatusName | '',
                ),
              )
            }
          >
            {battleStatuses.map((status) => (
              <option key={status || 'clear'} value={status}>
                {status === '' ? 'Healthy' : status}
              </option>
            ))}
          </select>
        </label>

        <label className="combatant-field">
          <span>Toxic counter</span>
          <input
            type="number"
            min={0}
            max={15}
            value={combatant.toxicCounter}
            onChange={(event) =>
              onChange(
                setCombatantField(
                  combatant,
                  'toxicCounter',
                  Number(event.target.value),
                ),
              )
            }
          />
        </label>

        <label className="combatant-field checkbox-field">
          <input
            type="checkbox"
            checked={combatant.abilityOn}
            onChange={(event) =>
              onChange(
                setCombatantField(combatant, 'abilityOn', event.target.checked),
              )
            }
          />
          <span>Ability active</span>
        </label>

        <label className="combatant-field checkbox-field">
          <input
            type="checkbox"
            checked={combatant.isDynamaxed}
            onChange={(event) =>
              onChange(
                setCombatantField(
                  combatant,
                  'isDynamaxed',
                  event.target.checked,
                ),
              )
            }
          />
          <span>Dynamaxed</span>
        </label>

        <label className="combatant-field">
          <span>Dynamax level</span>
          <input
            type="number"
            min={0}
            max={10}
            value={combatant.dynamaxLevel ?? ''}
            onChange={(event) =>
              onChange(
                setCombatantField(
                  combatant,
                  'dynamaxLevel',
                  event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                ),
              )
            }
            disabled={!combatant.isDynamaxed}
          />
        </label>
      </FieldGroup>

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

      <FieldGroup title="Moves">
        {combatant.moves.map((move, index) => (
          <label key={`move-${index}`} className="combatant-field">
            <span>Move {index + 1}</span>
            <input
              type="text"
              value={move}
              onChange={(event) =>
                onChange(
                  setCombatantMove(combatant, index, event.target.value),
                )
              }
            />
          </label>
        ))}
      </FieldGroup>
    </article>
  );
}
