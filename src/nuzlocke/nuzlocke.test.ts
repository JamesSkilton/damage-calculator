import { describe, expect, it } from 'vitest';
import { adjustRates, claimedFamilies, familyOf } from './dupesClause';
import { parseRoutesText, routesToText } from './gameText';
import {
  encountersForGame,
  spawnTables,
  validateEncounters,
  validateRoutes,
} from './types';

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

  it('parses percentages and merges linked areas into one route', () => {
    const routes = parseRoutesText(
      'Route 1: Pidgey 40%, Rattata\nMeteor Falls > 1F1: Zubat 50%, Lunatone\nMeteor Falls > 1F2: Golbat 30.5%',
    );
    expect(routes).toHaveLength(2);
    expect(routes[0].rates).toEqual({ Pidgey: 40 });
    expect(routes[1]).toMatchObject({
      name: 'Meteor Falls',
      encounters: ['Zubat', 'Lunatone', 'Golbat'],
      areas: [
        { name: '1F1', rates: { Zubat: 50 } },
        { name: '1F2', encounters: ['Golbat'], rates: { Golbat: 30.5 } },
      ],
    });
    expect(routesToText(routes)).toBe(
      'Route 1: Pidgey 40%, Rattata\nMeteor Falls > 1F1: Zubat 50%, Lunatone\nMeteor Falls > 1F2: Golbat 30.5%',
    );
    const [encounter] = encountersForGame({ routes: [routes[1]] });
    expect(
      spawnTables({ ...encounter, area: '1F2' }).flatMap((t) => t.species),
    ).toEqual(['Golbat']);
    expect(validateRoutes(routes).routes?.[1].areas).toHaveLength(2);
    expect(validateEncounters([encounter]).encounters?.[0].areas).toHaveLength(
      2,
    );
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

describe('encounter methods', () => {
  const text =
    'Route 119 [Grass]: Oddish 55%, Zigzagoon 45%\nRoute 119 [Surfing]: Tentacool 100%\nMeteor Falls > 1F1 [Grass]: Zubat 50%\nMeteor Falls > 1F1 [Surfing]: Golbat 100%';

  it('round-trips methods on routes and areas and keeps one route per name', () => {
    const routes = parseRoutesText(text);
    expect(routes).toHaveLength(2);
    expect(routes[0].encounters).toEqual(['Oddish', 'Zigzagoon', 'Tentacool']);
    expect(routes[0].methods?.map((m) => m.name)).toEqual(['Grass', 'Surfing']);
    expect(routes[1].areas?.[0].methods?.[1]).toMatchObject({
      name: 'Surfing',
      rates: { Golbat: 100 },
    });
    expect(routesToText(routes)).toBe(text);
    expect(validateRoutes(routes).routes?.[1].areas?.[0].methods).toHaveLength(
      2,
    );
  });

  it('narrows spawn tables by method and keeps each method separate', () => {
    const [route, meteor] = parseRoutesText(text);
    const [encounter] = encountersForGame({ routes: [route] });
    expect(spawnTables(encounter)).toHaveLength(2);
    expect(
      spawnTables({ ...encounter, method: 'Surfing' }).map((t) => t.species),
    ).toEqual([['Tentacool']]);
    const [linked] = encountersForGame({ routes: [meteor] });
    expect(
      spawnTables({ ...linked, area: '1F1', method: 'Grass' })[0].rates,
    ).toEqual({ Zubat: 50 });
    expect(
      validateEncounters([{ ...linked, method: 'Grass' }]).encounters?.[0]
        .method,
    ).toBe('Grass');
  });
});

describe('dupes clause', () => {
  it('blocks a whole evolution line once caught and rescales the remaining chances', () => {
    expect(familyOf('Starmie')).toBe(familyOf('Staryu'));
    const claimed = claimedFamilies(
      [
        { id: 'a', route: 'Route 1', status: 'caught', species: 'Starmie' },
        { id: 'b', route: 'Route 2', status: 'missed', species: 'Zubat' },
        { id: 'c', route: 'Route 3', status: 'pending' },
      ],
      'c',
    );
    expect(claimed.has(familyOf('Staryu'))).toBe(true);
    expect(claimed.has(familyOf('Zubat'))).toBe(false);
    const rates = { Staryu: 20, Zubat: 40, Wingull: 40 };
    const species = Object.keys(rates);
    expect(adjustRates(species, rates, claimed)).toEqual({
      Zubat: 50,
      Wingull: 50,
    });
    expect(adjustRates(species, rates, new Set())).toEqual(rates);
  });
});
