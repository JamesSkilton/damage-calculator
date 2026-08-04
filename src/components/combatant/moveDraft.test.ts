import { describe, expect, it } from 'vitest';
import {
  createMoveDraft,
  updateMoveDraft,
  setMoveName,
  setMoveCrit,
  setMoveHits,
  setMoveZ,
  setMoveMax,
  setMoveStellar,
  setMoveTimesUsed,
  setMoveTimesUsedWithMetronome,
  isGenerationGated,
  validateMoveDraft,
  resolveMoveDraftForGeneration,
  toMoveLegacyInput,
} from './moveDraft';

describe('moveDraft', () => {
  describe('createMoveDraft', () => {
    it('creates a default move draft with empty name', () => {
      const draft = createMoveDraft();
      expect(draft).toEqual({
        name: '',
        isCrit: false,
        hits: 1,
        useZ: false,
        useMax: false,
        isStellarFirstUse: false,
        timesUsed: 1,
        timesUsedWithMetronome: undefined,
      });
    });

    it('creates a move draft with provided name', () => {
      const draft = createMoveDraft('Thunderbolt');
      expect(draft.name).toBe('Thunderbolt');
      expect(draft.isCrit).toBe(false);
      expect(draft.timesUsed).toBe(1);
    });

    it('applies overrides to defaults', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: true,
        hits: 2,
      });
      expect(draft.name).toBe('Earthquake');
      expect(draft.isCrit).toBe(true);
      expect(draft.hits).toBe(2);
    });
  });

  describe('updateMoveDraft', () => {
    it('updates multiple fields at once', () => {
      const draft = createMoveDraft('Thunderbolt');
      const updated = updateMoveDraft(draft, {
        isCrit: true,
        timesUsed: 3,
      });
      expect(updated.isCrit).toBe(true);
      expect(updated.timesUsed).toBe(3);
      expect(updated.name).toBe('Thunderbolt');
    });
  });

  describe('setMoveName', () => {
    it('updates move name and trims whitespace', () => {
      const draft = createMoveDraft('Tackle');
      const updated = setMoveName(draft, '  Earthquake  ');
      expect(updated.name).toBe('Earthquake');
    });
  });

  describe('setMoveCrit', () => {
    it('sets critical hit flag', () => {
      const draft = createMoveDraft('Slash');
      const updated = setMoveCrit(draft, true);
      expect(updated.isCrit).toBe(true);
      expect(updated.name).toBe('Slash');
    });
  });

  describe('setMoveHits', () => {
    it('clamps hits to valid range', () => {
      const draft = createMoveDraft('DoubleKick');
      const updated1 = setMoveHits(draft, 0);
      expect(updated1.hits).toBe(1);

      const updated2 = setMoveHits(draft, 10);
      expect(updated2.hits).toBe(8);

      const updated3 = setMoveHits(draft, 3);
      expect(updated3.hits).toBe(3);
    });

    it('parses string values', () => {
      const draft = createMoveDraft('MultiAttack');
      const updated = setMoveHits(draft, '2');
      expect(updated.hits).toBe(2);
    });

    it('returns unchanged draft for invalid input', () => {
      const draft = createMoveDraft('Tackle');
      const updated = setMoveHits(draft, 'invalid');
      expect(updated.hits).toBe(draft.hits);
    });
  });

  describe('setMoveZ / setMoveMax', () => {
    it('sets Z-move variant', () => {
      const draft = createMoveDraft('Earthquake');
      const updated = setMoveZ(draft, true);
      expect(updated.useZ).toBe(true);
      expect(updated.useMax).toBe(false);
    });

    it('sets Max move variant', () => {
      const draft = createMoveDraft('Earthquake');
      const updated = setMoveMax(draft, true);
      expect(updated.useMax).toBe(true);
      expect(updated.useZ).toBe(false);
    });

    it('mutually excludes Z and Max', () => {
      const draft = createMoveDraft('Earthquake', { useZ: true });
      const updated = setMoveMax(draft, true);
      expect(updated.useMax).toBe(true);
      expect(updated.useZ).toBe(false);
    });
  });

  describe('setMoveStellar', () => {
    it('sets stellar first use flag', () => {
      const draft = createMoveDraft('Tera Blast');
      const updated = setMoveStellar(draft, true);
      expect(updated.isStellarFirstUse).toBe(true);
    });
  });

  describe('setMoveTimesUsed / setMoveTimesUsedWithMetronome', () => {
    it('sets times used with clamping', () => {
      const draft = createMoveDraft('Rollout');
      const updated = setMoveTimesUsed(draft, 5);
      expect(updated.timesUsed).toBe(5);
    });

    it('sets times used with metronome', () => {
      const draft = createMoveDraft('Tackle');
      const updated = setMoveTimesUsedWithMetronome(draft, 3);
      expect(updated.timesUsedWithMetronome).toBe(3);
    });

    it('clears metronome counter when 0', () => {
      const draft = createMoveDraft('Tackle', {
        timesUsedWithMetronome: 5,
      });
      const updated = setMoveTimesUsedWithMetronome(draft, 0);
      expect(updated.timesUsedWithMetronome).toBeUndefined();
    });
  });

  describe('isGenerationGated', () => {
    it('returns true for Z-moves in gen 7+', () => {
      expect(isGenerationGated('z', 6)).toBe(false);
      expect(isGenerationGated('z', 7)).toBe(true);
      expect(isGenerationGated('z', 9)).toBe(true);
    });

    it('returns true for Max moves in gen 8+', () => {
      expect(isGenerationGated('max', 7)).toBe(false);
      expect(isGenerationGated('max', 8)).toBe(true);
      expect(isGenerationGated('max', 9)).toBe(true);
    });

    it('returns true for Stellar in gen 9+', () => {
      expect(isGenerationGated('stellar', 8)).toBe(false);
      expect(isGenerationGated('stellar', 9)).toBe(true);
    });
  });

  describe('validateMoveDraft', () => {
    it('rejects empty move name', () => {
      const draft = createMoveDraft('');
      const result = validateMoveDraft(draft);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Move name is required');
    });

    it('rejects invalid hit count', () => {
      const draft = createMoveDraft('Invalid', { hits: 10 });
      const result = validateMoveDraft(draft);
      expect(result.isValid).toBe(false);
    });

    it('rejects Z and Max at the same time', () => {
      const draft = createMoveDraft('Earthquake', {
        useZ: true,
        useMax: true,
      });
      const result = validateMoveDraft(draft);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Move cannot be both Z and Max');
    });

    it('validates correct move draft', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: true,
        hits: 1,
        timesUsed: 2,
      });
      const result = validateMoveDraft(draft);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('resolveMoveDraftForGeneration', () => {
    it('clears Z flag for generation < 7', () => {
      const draft = createMoveDraft('Earthquake', { useZ: true });
      const resolved = resolveMoveDraftForGeneration(draft, 6);
      expect(resolved.useZ).toBe(false);
    });

    it('clears Max flag for generation < 8', () => {
      const draft = createMoveDraft('Earthquake', { useMax: true });
      const resolved = resolveMoveDraftForGeneration(draft, 7);
      expect(resolved.useMax).toBe(false);
    });

    it('clears Stellar flag for generation < 9', () => {
      const draft = createMoveDraft('Tera Blast', {
        isStellarFirstUse: true,
      });
      const resolved = resolveMoveDraftForGeneration(draft, 8);
      expect(resolved.isStellarFirstUse).toBe(false);
    });

    it('preserves flags in supported generation', () => {
      const draft = createMoveDraft('Earthquake', {
        useZ: true,
        useMax: false,
        isStellarFirstUse: false,
      });
      const resolved = resolveMoveDraftForGeneration(draft, 7);
      expect(resolved.useZ).toBe(true);
    });
  });

  describe('toMoveLegacyInput', () => {
    it('converts move draft to legacy input', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: true,
        hits: 2,
        useZ: false,
        useMax: true,
        timesUsed: 3,
        timesUsedWithMetronome: 2,
      });
      const input = toMoveLegacyInput(draft);
      expect(input).toEqual({
        name: 'Earthquake',
        isCrit: true,
        hits: 2,
        useZ: false,
        useMax: true,
        isStellarFirstUse: false,
        timesUsed: 3,
        timesUsedWithMetronome: 2,
      });
    });
  });
});
