import { useOutletContext } from 'react-router-dom';
import type { CalculatorMode } from 'modes/calculatorModes';
import './ModeScreen.css';

type ModeScreenProps = {
  mode: CalculatorMode;
};

export default function ModeScreen({ mode }: ModeScreenProps) {
  const currentPath = useOutletContext<string>();

  return (
    <section className="mode-panel">
      <p className="mode-kicker">Placeholder route</p>
      <h2>{mode.title}</h2>
      <p>{mode.description}</p>

      <div
        className="mode-boundary"
        role="note"
        aria-label={`${mode.title} migration boundary`}
      >
        <p className="mode-boundary-label">TODO boundary</p>
        <p>{mode.placeholderTodo}</p>
      </div>

      <p className="mode-note">
        Shared shell is live at {currentPath}; migrate this mode here without
        changing the route.
      </p>
    </section>
  );
}
