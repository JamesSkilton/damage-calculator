import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from 'App';

describe('one-vs-one mode', () => {
  it('renders the attacker and defender panels inside the shared shell', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/one-vs-one']}>
        <App />
      </MemoryRouter>,
    );

    expect(markup).toContain('Generation');
    expect(markup).toContain('Gen 9');
    expect(markup).toContain('Weather');
    expect(markup).toContain('Terrain');
    expect(markup).toContain('Attacker side');
    expect(markup).toContain('Defender side');
    expect(markup).toContain('Battle Context');
    expect(markup).not.toContain('Attacker party');
    expect(markup).not.toContain('Choose a candidate');
    expect(markup).toContain('Manage party and imported Pokemon');
    expect(markup).toContain('pokemon-set-tools');
    expect(markup.indexOf('pokemon-set-tools')).toBeGreaterThan(
      markup.indexOf('Weather and terrain'),
    );
    expect(markup).toContain('Advanced Context');
    expect(markup).toContain('Attacker panel');
    expect(markup).toContain('Defender panel');
    expect(markup).toContain('Plan battle');
    expect(markup).not.toContain('battle-controls');
    expect(markup.indexOf('Defender panel')).toBeLessThan(
      markup.indexOf('Battle Context'),
    );
    expect(markup).toContain('Simple');
    expect(markup).toContain('Advanced');
    expect(markup).toContain('EV Investment');
    expect(markup).toContain('Base');
    expect(markup).toContain('Final');
    expect(markup).toContain('Add a move to see the calculator breakdown.');
    expect(markup).not.toContain('Placeholder route');
  });
});
