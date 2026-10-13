import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { runtimeConfig } from 'config/runtimeConfig';
import { calculatorModes } from 'modes/calculatorModes';
import type { BattleGeneration } from 'domain/index';
import { battleGenerations } from './combatant/shared/combatantPanel.constants';
import {
  presetLibraries,
  type PresetLibraryId,
} from '../import/legacySets/legacyPresetCatalog';
import './AppShell.css';

export type AppShellContext = {
  pathname: string;
  generation: BattleGeneration;
  onGenerationChange: (generation: BattleGeneration) => void;
  presetLibraryId: PresetLibraryId;
  onPresetLibraryChange: (libraryId: PresetLibraryId) => void;
};

export default function AppShell() {
  const location = useLocation();
  const [generation, setGeneration] = useState<BattleGeneration>(9);
  const [presetLibraryId, setPresetLibraryId] =
    useState<PresetLibraryId>('standard');

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

          <label className="shell-generation-field">
            <span>Preset library</span>
            <select
              value={presetLibraryId}
              onChange={(event) =>
                setPresetLibraryId(event.target.value as PresetLibraryId)
              }
            >
              {presetLibraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.label}
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
            presetLibraryId,
            onPresetLibraryChange: setPresetLibraryId,
          } satisfies AppShellContext}
        />
      </main>
    </div>
  );
}
