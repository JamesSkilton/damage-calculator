import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useOutletContext } from 'react-router-dom';

type Mode = {
  path: string;
  label: string;
  title: string;
  description: string;
};

const modes: Mode[] = [
  {
    path: '/one-vs-one',
    label: 'One vs One',
    title: 'One vs One',
    description: 'The default matchup view for direct attacker versus defender comparisons.',
  },
  {
    path: '/one-vs-all',
    label: 'One vs All',
    title: 'One vs All',
    description: 'A spread view for comparing one attacker against many targets.',
  },
  {
    path: '/all-vs-one',
    label: 'All vs One',
    title: 'All vs One',
    description: 'A defensive view for comparing multiple attackers into one target.',
  },
  {
    path: '/champions',
    label: 'Champions',
    title: 'Champions',
    description: 'A mode dedicated to champion battles and their calculator presets.',
  },
  {
    path: '/randoms',
    label: 'Random Battles',
    title: 'Random Battles',
    description: 'Random battle matchups with the same shared calculator shell.',
  },
  {
    path: '/oms',
    label: 'Other Metagames',
    title: 'Other Metagames',
    description: 'Other metagame presets and their calculator-specific rules.',
  },
];

function AppShell() {
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
            {modes.map((mode) => (
              <li key={mode.path}>
                <NavLink
                  to={mode.path}
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

function ModeScreen({ mode }: { mode: Mode }) {
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/one-vs-one" replace />} />
        {modes.map((mode) => (
          <Route
            key={mode.path}
            path={mode.path.slice(1)}
            element={<ModeScreen mode={mode} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/one-vs-one" replace />} />
      </Route>
    </Routes>
  );
}
