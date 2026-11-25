// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { createBattleFieldDraft } from '../combatant/shared/battleFieldDraft';
import BattleFieldControls from './BattleFieldControls';

afterEach(cleanup);

it('sets Sticky Web on the selected side', () => {
  const field = createBattleFieldDraft(9);
  const onChange = vi.fn();
  render(<BattleFieldControls field={field} onChange={onChange} />);
  const side = screen.getByRole('group', { name: 'Screens and hazards: Defender side' });
  fireEvent.click(within(side).getByLabelText('Sticky Web'));
  expect(onChange).toHaveBeenCalledWith({
    ...field,
    defenderSide: { ...field.defenderSide, isStickyWeb: true },
  });
});
