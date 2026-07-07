import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { calculatorModes } from '../routes/calculatorModes';
import './AppShell.css';

export default function AppShell() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="shell-header">
        <div>
          <p className="eyebrow">Pokémon Damage Calculator</p>
          <h1>Calculator modes</h1>
        </div>

        <nav aria-label="Calculator modes">
          <ul className="mode-nav">
            {calculatorModes.map((mode) => (
              <li key={mode.slug}>
                <NavLink
                  to={`/${mode.slug}`}
                  className={({ isActive }) => `mode-link${isActive ? ' active' : ''}`}
                >
                  {mode.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main-content" className="shell-main">
        <Outlet context={location.pathname} />
      </main>
    </div>
  );
}
