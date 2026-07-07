import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import ModeScreen from './components/ModeScreen';
import { runtimeConfig } from './config/runtimeConfig';
import { calculatorModes } from './routes/calculatorModes';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to={`/${runtimeConfig.defaultModeSlug}`} replace />} />
        {calculatorModes.map((mode) => (
          <Route key={mode.slug} path={mode.slug} element={<ModeScreen mode={mode} />} />
        ))}
        <Route path="*" element={<Navigate to={`/${runtimeConfig.defaultModeSlug}`} replace />} />
      </Route>
    </Routes>
  );
}

export default App;
