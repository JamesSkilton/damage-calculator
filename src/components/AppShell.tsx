import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { runtimeConfig } from 'config/runtimeConfig';
import { calculatorModes } from 'modes/calculatorModes';
import type { BattleGeneration } from 'domain/index';
import { battleGenerations } from './combatant/shared/combatantPanel.constants';
import {
  presetLibraries,
  type PresetLibraryId,
} from '../import/legacySets/legacyPresetCatalog';
import {
  activateKnownPresetLibrary,
  loadKnownPresetLibraryCaches,
  loadPresetLibraryCache,
  type PresetLibraryCacheEntry,
} from '../presets/remote/presetLibraryCache';
import './AppShell.css';

export type AppShellContext = {
  pathname: string;
  generation: BattleGeneration;
  onGenerationChange: (generation: BattleGeneration) => void;
  presetLibraryId: PresetLibraryId;
  onPresetLibraryChange: (libraryId: PresetLibraryId) => void;
  isUserLibrarySelected: boolean;
  selectedUserLibraryCode?: string;
};

export default function AppShell() {
  const location = useLocation();
  const [generation, setGeneration] = useState<BattleGeneration>(9);
  const [presetLibraryId, setPresetLibraryId] =
    useState<PresetLibraryId>('standard');
  const [isUserLibrarySelected, setIsUserLibrarySelected] = useState(false);
  const [cachedUserLibraries, setCachedUserLibraries] = useState<
    PresetLibraryCacheEntry[]
  >(() => loadKnownPresetLibraryCaches());
  const [selectedUserLibraryCode, setSelectedUserLibraryCode] = useState<
    string | undefined
  >(() => loadPresetLibraryCache()?.accessCode);
  const [selectedUserLibraryId, setSelectedUserLibraryId] = useState<
    string | undefined
  >(() => loadPresetLibraryCache()?.snapshot.library.id);

  useEffect(() => {
    const refreshUserLibraries = () => {
      const active = loadPresetLibraryCache();
      setCachedUserLibraries(loadKnownPresetLibraryCaches());
      setSelectedUserLibraryCode(active?.accessCode);
      setSelectedUserLibraryId(active?.snapshot.library.id);
    };
    window.addEventListener('pokemans.preset-library-changed', refreshUserLibraries);
    return () =>
      window.removeEventListener('pokemans.preset-library-changed', refreshUserLibraries);
  }, []);

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
              value={isUserLibrarySelected ? `user-library:${selectedUserLibraryId}` : presetLibraryId}
              onChange={(event) => {
                if (event.target.value.startsWith('user-library:')) {
                  const libraryId = event.target.value.slice('user-library:'.length);
                  const entry = activateKnownPresetLibrary(libraryId);
                  setSelectedUserLibraryCode(entry?.accessCode);
                  setSelectedUserLibraryId(entry?.snapshot.library.id);
                  setIsUserLibrarySelected(true);
                  return;
                }
                setIsUserLibrarySelected(false);
                setPresetLibraryId(event.target.value as PresetLibraryId);
              }}
            >
              {presetLibraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.label}
                </option>
              ))}
              {cachedUserLibraries.map((entry) => (
                <option
                  key={entry.snapshot.library.id}
                  value={`user-library:${entry.snapshot.library.id}`}
                >
                  {entry.snapshot.library.name} (My library)
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
          <NavLink
          to="/presets"
          className={({ isActive }) =>
            `mode-link${isActive ? ' active' : ''}`
          }
          >
          Preset manager
          </NavLink>
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
            isUserLibrarySelected,
            selectedUserLibraryCode,
          } satisfies AppShellContext}
        />
      </main>
    </div>
  );
}
