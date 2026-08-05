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
    expect(markup).toContain('Attacker panel');
    expect(markup).toContain('Defender panel');
    expect(markup).toContain('Attacker (Pikachu) — Lv. 100, HP 100');
    expect(markup).toContain('Defender (Bulbasaur) — Lv. 100, HP 100');
    expect(markup).toContain('Calc breakdown');
    expect(markup).toContain('Live result');
    expect(markup).toContain('No results');
    expect(markup).toContain('Add a move to see the calculator breakdown.');
    expect(markup).toContain('Clear weather, No terrain');
    expect(markup).not.toContain('Placeholder route');
  });
});
