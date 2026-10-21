import { describe, expect, it } from 'vitest';
import { parseRoutesText, routesToText } from './gameText';
import { encountersForGame, validateEncounters, validateRoutes } from './types';

describe('route text', () => {
  it('parses routes with optional species and keeps ids of existing routes', () => {
    const existing = [{ id: 'keep', name: 'Route 1', encounters: [] }];
    const routes = parseRoutesText(
      'Route 1: Pidgey, Rattata, Pidgey\n\nPewter City',
      existing,
    );
    expect(routes).toMatchObject([
      { id: 'keep', name: 'Route 1', encounters: ['Pidgey', 'Rattata'] },
      { name: 'Pewter City', encounters: [] },
    ]);
    expect(routesToText(routes)).toBe('Route 1: Pidgey, Rattata\nPewter City');
  });
});

describe('nuzlocke validation', () => {
  it('rejects duplicate route names', () => {
    const result = validateRoutes([{ name: 'Route 1' }, { name: 'route 1' }]);
    expect(result.routes).toBeUndefined();
  });

  it('requires a species for caught and dead encounters', () => {
    expect(
      validateEncounters([{ route: 'Route 1', status: 'caught' }]).encounters,
    ).toBeUndefined();
    expect(
      validateEncounters([
        { route: 'Route 1', status: 'caught', species: 'Pidgey' },
      ]).encounters,
    ).toHaveLength(1);
  });

  it('copies possible encounters from the game onto pending run encounters', () => {
    const [encounter] = encountersForGame({
      routes: [{ id: 'a', name: 'Route 1', encounters: ['Pidgey'] }],
    });
    expect(encounter).toMatchObject({
      route: 'Route 1',
      status: 'pending',
      options: ['Pidgey'],
    });
    expect(validateEncounters([encounter]).encounters?.[0].options).toEqual([
      'Pidgey',
    ]);
  });
});
