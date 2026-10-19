import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MATCHUP_SETTINGS,
  classifyMatchup,
  describeMatchupBadges,
  evaluateBoxMatchup,
  getSpeedRelation,
} from './boxMatchup';
import { createTeamDraft } from 'components/combatant/shared/combatantDraft';
import { createBattleFieldDraft } from 'components/combatant/shared/battleFieldDraft';
import { createMoveDraft } from 'components/combatant/moves/moveDraft';

describe('boxMatchup', () => {
  it('compares speeds', () => {
    expect(getSpeedRelation(100, 90)).toBe('faster');
    expect(getSpeedRelation(90, 90)).toBe('tie');
    expect(getSpeedRelation(80, 90)).toBe('slower');
  });

  it('classifies tiers from speed, KO and survival hits', () => {
    const s = DEFAULT_MATCHUP_SETTINGS;
    expect(classifyMatchup({ speed: 'faster', hitsToKo: 1, survivesHits: 0 }, s)).toBe('excellent');
    expect(classifyMatchup({ speed: 'slower', hitsToKo: 2, survivesHits: 2 }, s)).toBe('excellent');
    expect(classifyMatchup({ speed: 'slower', hitsToKo: 4, survivesHits: 4 }, s)).toBe('good');
    expect(classifyMatchup({ speed: 'faster', hitsToKo: 2, survivesHits: 0 }, s)).toBe('good');
    expect(classifyMatchup({ speed: 'slower', hitsToKo: 1, survivesHits: 0 }, s)).toBe('poor');
    expect(classifyMatchup({ speed: 'slower', hitsToKo: 3, survivesHits: 1 }, s)).toBe('neutral');
    expect(classifyMatchup({ speed: 'slower' }, s)).toBe('neutral');
  });

  it('evaluates a real matchup and labels badges', () => {
    const team = createTeamDraft(9);
    const field = createBattleFieldDraft(9);
    const matchup = evaluateBoxMatchup(
      {
        generation: 9,
        defender: team.defender,
        defenderMoves: [createMoveDraft('Tackle')],
        field,
      },
      {
        combatant: team.attacker,
        moves: [createMoveDraft('Tackle')],
      },
      DEFAULT_MATCHUP_SETTINGS,
    );
    expect(matchup).toBeDefined();
    expect(matchup!.hitsToKo).toBeGreaterThan(0);
    expect(matchup!.survivesHits).toBeGreaterThanOrEqual(0);
    expect(describeMatchupBadges(matchup!, DEFAULT_MATCHUP_SETTINGS).length).toBeGreaterThan(0);
  });
});
