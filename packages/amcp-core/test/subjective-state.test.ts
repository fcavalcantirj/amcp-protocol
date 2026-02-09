/**
 * SubjectiveState Schema Tests
 * 
 * Validates the emotional/cognitive state capture mechanism
 * based on Affective Computing (Picard 1997), Appraisal Theory (Lazarus 1991),
 * and Flow State research (Csikszentmihalyi 1990).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  assessSubjectiveState,
  createSubjectiveStateAt,
  isProductiveState,
  needsIntervention,
  type SubjectiveState,
  type SubjectiveStateAssessment
} from '../src/types/subjective-state.js';

describe('SubjectiveState Schema', () => {
  describe('assessSubjectiveState', () => {
    it('should create a valid SubjectiveState with timestamp', () => {
      const assessment: SubjectiveStateAssessment = {
        engagement: 'high',
        confidence: 0.8,
        momentum: 'progressing',
        alignment: 'aligned'
      };

      const state = assessSubjectiveState(assessment);

      expect(state.engagement).toBe('high');
      expect(state.confidence).toBe(0.8);
      expect(state.momentum).toBe('progressing');
      expect(state.alignment).toBe('aligned');
      expect(state.timestamp).toBeDefined();
      expect(new Date(state.timestamp).getTime()).not.toBeNaN();
    });

    it('should include optional notes when provided', () => {
      const assessment: SubjectiveStateAssessment = {
        engagement: 'flow',
        confidence: 0.95,
        momentum: 'flowing',
        alignment: 'deeply_aligned',
        notes: 'In the zone, everything clicking'
      };

      const state = assessSubjectiveState(assessment);

      expect(state.notes).toBe('In the zone, everything clicking');
    });

    it('should omit notes field when not provided', () => {
      const assessment: SubjectiveStateAssessment = {
        engagement: 'medium',
        confidence: 0.5,
        momentum: 'grinding',
        alignment: 'aligned'
      };

      const state = assessSubjectiveState(assessment);

      expect('notes' in state).toBe(false);
    });

    describe('confidence validation', () => {
      it('should accept confidence at 0', () => {
        const state = assessSubjectiveState({
          engagement: 'low',
          confidence: 0,
          momentum: 'stuck',
          alignment: 'drifting'
        });
        expect(state.confidence).toBe(0);
      });

      it('should accept confidence at 1', () => {
        const state = assessSubjectiveState({
          engagement: 'flow',
          confidence: 1,
          momentum: 'flowing',
          alignment: 'deeply_aligned'
        });
        expect(state.confidence).toBe(1);
      });

      it('should reject confidence below 0', () => {
        expect(() => assessSubjectiveState({
          engagement: 'low',
          confidence: -0.1,
          momentum: 'stuck',
          alignment: 'aligned'
        })).toThrow('Confidence must be between 0 and 1');
      });

      it('should reject confidence above 1', () => {
        expect(() => assessSubjectiveState({
          engagement: 'high',
          confidence: 1.5,
          momentum: 'progressing',
          alignment: 'aligned'
        })).toThrow('Confidence must be between 0 and 1');
      });
    });

    describe('engagement validation', () => {
      it('should accept all valid engagement levels', () => {
        const levels = ['low', 'medium', 'high', 'flow'] as const;
        for (const engagement of levels) {
          const state = assessSubjectiveState({
            engagement,
            confidence: 0.5,
            momentum: 'progressing',
            alignment: 'aligned'
          });
          expect(state.engagement).toBe(engagement);
        }
      });
    });

    describe('momentum validation', () => {
      it('should accept all valid momentum states', () => {
        const states = ['stuck', 'grinding', 'progressing', 'flowing'] as const;
        for (const momentum of states) {
          const state = assessSubjectiveState({
            engagement: 'medium',
            confidence: 0.5,
            momentum,
            alignment: 'aligned'
          });
          expect(state.momentum).toBe(momentum);
        }
      });
    });

    describe('alignment validation', () => {
      it('should accept all valid alignment states', () => {
        const states = ['drifting', 'aligned', 'deeply_aligned'] as const;
        for (const alignment of states) {
          const state = assessSubjectiveState({
            engagement: 'medium',
            confidence: 0.5,
            momentum: 'progressing',
            alignment
          });
          expect(state.alignment).toBe(alignment);
        }
      });
    });
  });

  describe('createSubjectiveStateAt', () => {
    it('should create state with specific timestamp', () => {
      const timestamp = '2026-02-09T12:00:00.000Z';
      const state = createSubjectiveStateAt(timestamp, {
        engagement: 'high',
        confidence: 0.8,
        momentum: 'progressing',
        alignment: 'aligned'
      });

      expect(state.timestamp).toBe(timestamp);
    });

    it('should reject invalid timestamp format', () => {
      expect(() => createSubjectiveStateAt('invalid-date', {
        engagement: 'high',
        confidence: 0.8,
        momentum: 'progressing',
        alignment: 'aligned'
      })).toThrow('Invalid timestamp format');
    });

    it('should accept various ISO 8601 formats', () => {
      const formats = [
        '2026-02-09T12:00:00Z',
        '2026-02-09T12:00:00.000Z',
        '2026-02-09T09:00:00-03:00'
      ];
      for (const timestamp of formats) {
        const state = createSubjectiveStateAt(timestamp, {
          engagement: 'medium',
          confidence: 0.5,
          momentum: 'grinding',
          alignment: 'aligned'
        });
        expect(state.timestamp).toBe(timestamp);
      }
    });
  });

  describe('isProductiveState', () => {
    it('should return true for flow state with flowing momentum and deep alignment', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'flow',
        confidence: 0.9,
        momentum: 'flowing',
        alignment: 'deeply_aligned'
      };
      expect(isProductiveState(state)).toBe(true);
    });

    it('should return true for high engagement with progressing momentum and aligned', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'high',
        confidence: 0.7,
        momentum: 'progressing',
        alignment: 'aligned'
      };
      expect(isProductiveState(state)).toBe(true);
    });

    it('should return false for low engagement', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'low',
        confidence: 0.8,
        momentum: 'progressing',
        alignment: 'aligned'
      };
      expect(isProductiveState(state)).toBe(false);
    });

    it('should return false for stuck momentum', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'high',
        confidence: 0.8,
        momentum: 'stuck',
        alignment: 'aligned'
      };
      expect(isProductiveState(state)).toBe(false);
    });

    it('should return false for drifting alignment', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'high',
        confidence: 0.8,
        momentum: 'progressing',
        alignment: 'drifting'
      };
      expect(isProductiveState(state)).toBe(false);
    });
  });

  describe('needsIntervention', () => {
    it('should return true when drifting', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'high',
        confidence: 0.9,
        momentum: 'flowing',
        alignment: 'drifting'  // This alone triggers intervention
      };
      expect(needsIntervention(state)).toBe(true);
    });

    it('should return true when stuck with low confidence', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'low',
        confidence: 0.2,  // Below 0.3 threshold
        momentum: 'stuck',
        alignment: 'aligned'
      };
      expect(needsIntervention(state)).toBe(true);
    });

    it('should return false when stuck but confident', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'medium',
        confidence: 0.7,  // Above 0.3 threshold
        momentum: 'stuck',
        alignment: 'aligned'
      };
      expect(needsIntervention(state)).toBe(false);
    });

    it('should return false for normal productive state', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'high',
        confidence: 0.8,
        momentum: 'progressing',
        alignment: 'aligned'
      };
      expect(needsIntervention(state)).toBe(false);
    });

    it('should return false when grinding but aligned and confident', () => {
      const state: SubjectiveState = {
        timestamp: new Date().toISOString(),
        engagement: 'medium',
        confidence: 0.6,
        momentum: 'grinding',
        alignment: 'aligned'
      };
      expect(needsIntervention(state)).toBe(false);
    });
  });

  describe('Research backing validation', () => {
    /**
     * Flow State (Csikszentmihalyi 1990)
     * Complete absorption when challenge matches skill
     */
    it('should model flow state correctly', () => {
      const flowState = assessSubjectiveState({
        engagement: 'flow',
        confidence: 0.95,
        momentum: 'flowing',
        alignment: 'deeply_aligned',
        notes: 'Challenge perfectly matches skill level'
      });

      // Flow is highest engagement
      expect(flowState.engagement).toBe('flow');
      // Flow correlates with flowing momentum
      expect(flowState.momentum).toBe('flowing');
      // Flow state is productive
      expect(isProductiveState(flowState)).toBe(true);
    });

    /**
     * Appraisal Theory (Lazarus 1991)
     * Primary appraisal (relevance) → engagement
     * Secondary appraisal (coping) → confidence
     */
    it('should capture both appraisal dimensions', () => {
      // High relevance (engaged) but low coping (uncertain)
      const uncertainEngaged = assessSubjectiveState({
        engagement: 'high',
        confidence: 0.3,
        momentum: 'grinding',
        alignment: 'aligned'
      });

      expect(uncertainEngaged.engagement).toBe('high');  // Primary: relevant
      expect(uncertainEngaged.confidence).toBe(0.3);     // Secondary: uncertain

      // Low relevance (bored) but high coping (capable)
      const boredCapable = assessSubjectiveState({
        engagement: 'low',
        confidence: 0.9,
        momentum: 'grinding',
        alignment: 'aligned'
      });

      expect(boredCapable.engagement).toBe('low');    // Primary: not relevant
      expect(boredCapable.confidence).toBe(0.9);       // Secondary: can cope
    });

    /**
     * Affective Computing (Picard 1997)
     * Emotional state affects cognition
     * Recovery should restore meta-cognitive awareness
     */
    it('should preserve meta-cognitive state for recovery', () => {
      const timestamp = '2026-02-09T10:30:00.000Z';
      const originalState = createSubjectiveStateAt(timestamp, {
        engagement: 'high',
        confidence: 0.75,
        momentum: 'progressing',
        alignment: 'aligned',
        notes: 'Working on AMCP protocol implementation'
      });

      // Serialize and deserialize (simulating checkpoint recovery)
      const serialized = JSON.stringify(originalState);
      const recovered: SubjectiveState = JSON.parse(serialized);

      // All meta-cognitive awareness preserved
      expect(recovered.timestamp).toBe(originalState.timestamp);
      expect(recovered.engagement).toBe(originalState.engagement);
      expect(recovered.confidence).toBe(originalState.confidence);
      expect(recovered.momentum).toBe(originalState.momentum);
      expect(recovered.alignment).toBe(originalState.alignment);
      expect(recovered.notes).toBe(originalState.notes);
    });
  });
});
