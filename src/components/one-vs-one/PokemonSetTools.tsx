import './PokemonSetTools.scss';

type PokemonSetToolsProps = {
  importText: string;
  onImportTextChange: (value: string) => void;
  onImport: () => void;
  importErrors: string[];
  exportText: string;
  onExport: (role: 'attacker' | 'defender') => void;
};

export default function PokemonSetTools({
  importText,
  onImportTextChange,
  onImport,
  importErrors,
  exportText,
  onExport,
}: PokemonSetToolsProps) {
  return (
    <section className="pokemon-set-tools" aria-labelledby="pokemon-sets-title">
      <div>
        <p className="battle-field-eyebrow">Team tools</p>
        <h2 id="pokemon-sets-title">Pokemon sets</h2>
      </div>
      <div className="pokemon-set-tools-content">
        <label className="combatant-field">
          <span>Import Pokemon sets</span>
          <textarea
            value={importText}
            onChange={(event) => onImportTextChange(event.target.value)}
            placeholder="Paste Showdown sets here"
            rows={5}
          />
        </label>
        <button type="button" onClick={onImport} disabled={!importText.trim()}>
          Import sets
        </button>
        {importErrors.length > 0 && <p role="alert">{importErrors.join(' ')}</p>}
        <div>
          <button type="button" onClick={() => onExport('attacker')}>Export attacker</button>
          <button type="button" onClick={() => onExport('defender')}>Export defender</button>
        </div>
        {exportText && (
          <textarea
            readOnly
            value={exportText}
            aria-label="Exported Pokemon set"
            rows={8}
          />
        )}
      </div>
    </section>
  );
}