import { calculatorModes } from '../routes/calculatorModes';

const defaultAppTitle = 'Pokémon Damage Calculator';
const modeSlugs = new Set(calculatorModes.map((mode) => mode.slug));

function readAppTitle(value: string | undefined): string {
  const appTitle = value?.trim();

  if (appTitle === undefined || appTitle.length === 0) {
    return defaultAppTitle;
  }

  return appTitle;
}

function readDefaultModeSlug(value: string | undefined): string {
  const defaultModeSlug = value?.trim();

  if (defaultModeSlug === undefined || defaultModeSlug.length === 0) {
    return calculatorModes[0].slug;
  }

  if (!modeSlugs.has(defaultModeSlug)) {
    throw new Error(`Invalid VITE_DEFAULT_MODE_SLUG value: ${defaultModeSlug}`);
  }

  return defaultModeSlug;
}

export type RuntimeConfig = {
  appTitle: string;
  defaultModeSlug: string;
  mode: string;
  isDevelopment: boolean;
  isProduction: boolean;
  baseUrl: string;
};

export const runtimeConfig: RuntimeConfig = {
  appTitle: readAppTitle(import.meta.env.VITE_APP_TITLE),
  defaultModeSlug: readDefaultModeSlug(import.meta.env.VITE_DEFAULT_MODE_SLUG),
  mode: import.meta.env.MODE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  baseUrl: import.meta.env.BASE_URL,
};
