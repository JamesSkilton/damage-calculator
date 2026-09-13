import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { runtimeConfig } from 'config/runtimeConfig';
import { calculatorModes } from 'modes/calculatorModes';
import type { BattleGeneration } from 'domain/index';
import { battleGenerations } from './combatant/shared/combatantPanel.constants';
import './AppShell.css';

export type AppShellContext = {
  pathname: string;
  generation: BattleGeneration;
  onGenerationChange: (generation: BattleGeneration) => void;
};

export default function AppShell() {
  const location = useLocation();
  const [generation, setGeneration] = useState<BattleGeneration>(9);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="shell-header">
        <div>
          <p className="eyebrow">{runtimeConfig.appTitle}</p>
          <h1>Calculator modes</h1>
        </div>

        <div className="shell-controls">
          <label className="shell-generation-field">
            <span>Generation</span>
            <select
              value={generation}
              onChange={(event) =>
                setGeneration(Number(event.target.value) as BattleGeneration)
              }
            >
              {battleGenerations.map((battleGeneration) => (
                <option key={battleGeneration} value={battleGeneration}>
                  Gen {battleGeneration}
                </option>
              ))}
            </select>
          </label>

          <nav aria-label="Calculator modes">
            <ul className="mode-nav">
              {calculatorModes.map((mode) => (
                <li key={mode.slug}>
                  <NavLink
                    to={`/${mode.slug}`}
                    className={({ isActive }) =>
                      `mode-link${isActive ? ' active' : ''}`
                    }
                  >
                    {mode.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main-content" className="shell-main">
        <Outlet
          context={{
            pathname: location.pathname,
            generation,
            onGenerationChange: setGeneration,
          } satisfies AppShellContext}
        />
      </main>
    </div>
  );
}
