import {
  DEFAULT_MATCHUP_SETTINGS,
  type MatchupSettings,
} from 'adapters/boxMatchup';

export const MATCHUP_SETTINGS_KEY = 'pokemans.box-matchup-settings.v1';

function clampHits(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(10, Math.max(1, value))
    : fallback;
}

export function loadMatchupSettings(storage?: Storage): MatchupSettings {
  if (!storage && typeof localStorage === 'undefined') {
    return DEFAULT_MATCHUP_SETTINGS;
  }
  try {
    const value = JSON.parse(
      (storage ?? localStorage).getItem(MATCHUP_SETTINGS_KEY) || '{}',
    );
    return {
      surviveHits: clampHits(value.surviveHits, DEFAULT_MATCHUP_SETTINGS.surviveHits),
      comboSurviveHits: clampHits(value.comboSurviveHits, DEFAULT_MATCHUP_SETTINGS.comboSurviveHits),
      comboKoHits: clampHits(value.comboKoHits, DEFAULT_MATCHUP_SETTINGS.comboKoHits),
    };
  } catch {
    return DEFAULT_MATCHUP_SETTINGS;
  }
}

export function saveMatchupSettings(
  settings: MatchupSettings,
  storage?: Storage,
): void {
  if (!storage && typeof localStorage === 'undefined') return;
  (storage ?? localStorage).setItem(MATCHUP_SETTINGS_KEY, JSON.stringify(settings));
}
