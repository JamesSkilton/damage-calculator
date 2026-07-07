import { useOutletContext } from 'react-router-dom';
import type { CalculatorMode } from '../routes/calculatorModes';
import './ModeScreen.css';

type ModeScreenProps = {
  mode: CalculatorMode;
};

export default function ModeScreen({ mode }: ModeScreenProps) {
  const currentPath = useOutletContext<string>();

  return (
    <section className="mode-panel">
      <p className="mode-kicker">Route: {currentPath}</p>
      <h2>{mode.title}</h2>
      <p>{mode.description}</p>
      <p className="mode-note">Shared shell is live; the calculator surface can land here next.</p>
    </section>
  );
}
