/**
 * CheckpointPolicy Schema Tests
 *
 * Validates checkpoint trigger configuration and evaluation.
 * Based on Memory Consolidation (Stickgold 2005), Autosave Research (Teevan 2011),
 * and WAL Checkpointing patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CHECKPOINT_POLICY,
  AGGRESSIVE_CHECKPOINT_POLICY,
  MINIMAL_CHECKPOINT_POLICY,
  createCheckpointPolicy,
  validateCheckpointPolicy,
  shouldCheckpoint,
  describePolicy,
  type CheckpointPolicy,
} from '../src/types/checkpoint-policy.js';

describe('CheckpointPolicy Schema', () => {
  describe('DEFAULT_CHECKPOINT_POLICY', () => {
    it('should have onHumanRequest MUST enabled (human sovereignty)', () => {
      expect(DEFAULT_CHECKPOINT_POLICY.onHumanRequest.enabled).toBe(true);
      expect(DEFAULT_CHECKPOINT_POLICY.onHumanRequest.level).toBe('MUST');
    });

    it('should have onSessionEnd SHOULD enabled (Stickgold 2005: consolidation window)', () => {
      expect(DEFAULT_CHECKPOINT_POLICY.onSessionEnd.enabled).toBe(true);
      expect(DEFAULT_CHECKPOINT_POLICY.onSessionEnd.level).toBe('SHOULD');
    });

    it('should have onContextThreshold at 85% (WAL pattern)', () => {
      expect(DEFAULT_CHECKPOINT_POLICY.onContextThreshold.enabled).toBe(true);
      expect(DEFAULT_CHECKPOINT_POLICY.onContextThreshold.threshold).toBe(0.85);
      expect(DEFAULT_CHECKPOINT_POLICY.onContextThreshold.level).toBe('SHOULD');
    });

    it('should have MAY triggers disabled by default', () => {
      expect(DEFAULT_CHECKPOINT_POLICY.onSignificantLearning?.enabled).toBe(false);
      expect(DEFAULT_CHECKPOINT_POLICY.onStateChange?.enabled).toBe(false);
      expect(DEFAULT_CHECKPOINT_POLICY.onRelationshipMilestone?.enabled).toBe(false);
      expect(DEFAULT_CHECKPOINT_POLICY.onError?.enabled).toBe(false);
    });
  });

  describe('AGGRESSIVE_CHECKPOINT_POLICY', () => {
    it('should enable all triggers', () => {
      expect(AGGRESSIVE_CHECKPOINT_POLICY.onHumanRequest.enabled).toBe(true);
      expect(AGGRESSIVE_CHECKPOINT_POLICY.onSessionEnd.enabled).toBe(true);
      expect(AGGRESSIVE_CHECKPOINT_POLICY.onContextThreshold.enabled).toBe(true);
      expect(AGGRESSIVE_CHECKPOINT_POLICY.onSignificantLearning?.enabled).toBe(true);
      expect(AGGRESSIVE_CHECKPOINT_POLICY.onStateChange?.enabled).toBe(true);
      expect(AGGRESSIVE_CHECKPOINT_POLICY.onRelationshipMilestone?.enabled).toBe(true);
      expect(AGGRESSIVE_CHECKPOINT_POLICY.onError?.enabled).toBe(true);
    });

    it('should have lower context threshold (70%)', () => {
      expect(AGGRESSIVE_CHECKPOINT_POLICY.onContextThreshold.threshold).toBe(0.70);
    });
  });

  describe('MINIMAL_CHECKPOINT_POLICY', () => {
    it('should only have onHumanRequest enabled', () => {
      expect(MINIMAL_CHECKPOINT_POLICY.onHumanRequest.enabled).toBe(true);
      expect(MINIMAL_CHECKPOINT_POLICY.onSessionEnd.enabled).toBe(false);
      expect(MINIMAL_CHECKPOINT_POLICY.onContextThreshold.enabled).toBe(false);
    });
  });

  describe('createCheckpointPolicy', () => {
    it('should create policy with defaults', () => {
      const policy = createCheckpointPolicy({});
      expect(policy.onHumanRequest.enabled).toBe(true);
      expect(policy.onSessionEnd.enabled).toBe(true);
    });

    it('should allow overriding SHOULD triggers', () => {
      const policy = createCheckpointPolicy({
        onSessionEnd: { enabled: false, level: 'SHOULD' },
      });
      expect(policy.onSessionEnd.enabled).toBe(false);
    });

    it('should preserve onHumanRequest (cannot be overridden)', () => {
      const policy = createCheckpointPolicy({
        onContextThreshold: { enabled: false, level: 'SHOULD', threshold: 0.9 },
      });
      // onHumanRequest is always preserved
      expect(policy.onHumanRequest.enabled).toBe(true);
      expect(policy.onHumanRequest.level).toBe('MUST');
    });

    it('should allow custom threshold', () => {
      const policy = createCheckpointPolicy({
        onContextThreshold: { enabled: true, level: 'SHOULD', threshold: 0.75 },
      });
      expect(policy.onContextThreshold.threshold).toBe(0.75);
    });

    it('should allow enabling MAY triggers', () => {
      const policy = createCheckpointPolicy({
        onSignificantLearning: { enabled: true, level: 'MAY' },
        onError: { enabled: true, level: 'MAY' },
      });
      expect(policy.onSignificantLearning?.enabled).toBe(true);
      expect(policy.onError?.enabled).toBe(true);
    });
  });

  describe('validateCheckpointPolicy', () => {
    it('should pass for DEFAULT_CHECKPOINT_POLICY', () => {
      const errors = validateCheckpointPolicy(DEFAULT_CHECKPOINT_POLICY);
      expect(errors).toEqual([]);
    });

    it('should pass for AGGRESSIVE_CHECKPOINT_POLICY', () => {
      const errors = validateCheckpointPolicy(AGGRESSIVE_CHECKPOINT_POLICY);
      expect(errors).toEqual([]);
    });

    it('should fail if onHumanRequest is disabled', () => {
      const invalidPolicy: CheckpointPolicy = {
        ...DEFAULT_CHECKPOINT_POLICY,
        onHumanRequest: { enabled: false, level: 'MUST' } as any,
      };
      const errors = validateCheckpointPolicy(invalidPolicy);
      expect(errors).toContain('onHumanRequest MUST be enabled (human sovereignty)');
    });

    it('should warn on threshold outside reasonable range', () => {
      const lowThreshold: CheckpointPolicy = {
        ...DEFAULT_CHECKPOINT_POLICY,
        onContextThreshold: { enabled: true, level: 'SHOULD', threshold: 0.3 },
      };
      const errors = validateCheckpointPolicy(lowThreshold);
      expect(errors.some((e) => e.includes('threshold'))).toBe(true);
    });

    it('should warn on threshold too high', () => {
      const highThreshold: CheckpointPolicy = {
        ...DEFAULT_CHECKPOINT_POLICY,
        onContextThreshold: { enabled: true, level: 'SHOULD', threshold: 1.0 },
      };
      const errors = validateCheckpointPolicy(highThreshold);
      expect(errors.some((e) => e.includes('threshold'))).toBe(true);
    });
  });

  describe('shouldCheckpoint', () => {
    describe('humanRequest event', () => {
      it('should ALWAYS checkpoint on human request (MUST)', () => {
        // Even with minimal policy
        expect(shouldCheckpoint(MINIMAL_CHECKPOINT_POLICY, 'humanRequest')).toBe(true);
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'humanRequest')).toBe(true);
        expect(shouldCheckpoint(AGGRESSIVE_CHECKPOINT_POLICY, 'humanRequest')).toBe(true);
      });
    });

    describe('sessionEnd event', () => {
      it('should checkpoint if onSessionEnd is enabled', () => {
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'sessionEnd')).toBe(true);
      });

      it('should NOT checkpoint if onSessionEnd is disabled', () => {
        expect(shouldCheckpoint(MINIMAL_CHECKPOINT_POLICY, 'sessionEnd')).toBe(false);
      });
    });

    describe('contextCheck event', () => {
      it('should checkpoint when context exceeds threshold', () => {
        // 90% > 85% threshold
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'contextCheck', 0.90)).toBe(true);
      });

      it('should NOT checkpoint when context below threshold', () => {
        // 80% < 85% threshold
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'contextCheck', 0.80)).toBe(false);
      });

      it('should checkpoint exactly at threshold', () => {
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'contextCheck', 0.85)).toBe(true);
      });

      it('should NOT checkpoint if trigger disabled', () => {
        expect(shouldCheckpoint(MINIMAL_CHECKPOINT_POLICY, 'contextCheck', 0.99)).toBe(false);
      });

      it('should NOT checkpoint if contextUsage not provided', () => {
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'contextCheck')).toBe(false);
      });
    });

    describe('MAY triggers', () => {
      it('should NOT trigger significantLearning in default policy', () => {
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'significantLearning')).toBe(false);
      });

      it('should trigger significantLearning in aggressive policy', () => {
        expect(shouldCheckpoint(AGGRESSIVE_CHECKPOINT_POLICY, 'significantLearning')).toBe(true);
      });

      it('should NOT trigger stateChange in default policy', () => {
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'stateChange')).toBe(false);
      });

      it('should trigger stateChange in aggressive policy', () => {
        expect(shouldCheckpoint(AGGRESSIVE_CHECKPOINT_POLICY, 'stateChange')).toBe(true);
      });

      it('should NOT trigger relationshipMilestone in default policy', () => {
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'relationshipMilestone')).toBe(false);
      });

      it('should trigger relationshipMilestone in aggressive policy', () => {
        expect(shouldCheckpoint(AGGRESSIVE_CHECKPOINT_POLICY, 'relationshipMilestone')).toBe(true);
      });

      it('should NOT trigger error in default policy', () => {
        expect(shouldCheckpoint(DEFAULT_CHECKPOINT_POLICY, 'error')).toBe(false);
      });

      it('should trigger error in aggressive policy', () => {
        expect(shouldCheckpoint(AGGRESSIVE_CHECKPOINT_POLICY, 'error')).toBe(true);
      });
    });
  });

  describe('describePolicy', () => {
    it('should describe DEFAULT_CHECKPOINT_POLICY', () => {
      const desc = describePolicy(DEFAULT_CHECKPOINT_POLICY);
      expect(desc).toContain('onHumanRequest (MUST)');
      expect(desc).toContain('onSessionEnd (SHOULD)');
      expect(desc).toContain('onContextThreshold@85%');
      expect(desc).not.toContain('onSignificantLearning');
    });

    it('should describe AGGRESSIVE_CHECKPOINT_POLICY with all triggers', () => {
      const desc = describePolicy(AGGRESSIVE_CHECKPOINT_POLICY);
      expect(desc).toContain('onHumanRequest (MUST)');
      expect(desc).toContain('onSignificantLearning (MAY)');
      expect(desc).toContain('onStateChange (MAY)');
      expect(desc).toContain('onRelationshipMilestone (MAY)');
      expect(desc).toContain('onError (MAY)');
      expect(desc).toContain('70%'); // Lower threshold
    });

    it('should describe MINIMAL_CHECKPOINT_POLICY with only human request', () => {
      const desc = describePolicy(MINIMAL_CHECKPOINT_POLICY);
      expect(desc).toContain('onHumanRequest (MUST)');
      expect(desc).not.toContain('onSessionEnd');
      expect(desc).not.toContain('onContextThreshold');
    });
  });

  describe('Research-backed behavior', () => {
    /**
     * Stickgold 2005: Memory consolidation happens during "offline" periods.
     * Session end = agent's consolidation window.
     */
    it('should treat session end as consolidation window (Stickgold 2005)', () => {
      // Default policy enables session end checkpoint
      expect(DEFAULT_CHECKPOINT_POLICY.onSessionEnd.enabled).toBe(true);
      expect(DEFAULT_CHECKPOINT_POLICY.onSessionEnd.level).toBe('SHOULD');
    });

    /**
     * Teevan 2011: Optimal autosave = event-triggered + time/resource-triggered.
     * Our policy supports both patterns.
     */
    it('should support event + threshold triggers (Teevan 2011)', () => {
      // Event triggers
      expect(DEFAULT_CHECKPOINT_POLICY.onHumanRequest.enabled).toBe(true);
      expect(DEFAULT_CHECKPOINT_POLICY.onSessionEnd.enabled).toBe(true);

      // Resource threshold trigger
      expect(DEFAULT_CHECKPOINT_POLICY.onContextThreshold.enabled).toBe(true);
    });

    /**
     * WAL Checkpointing: Balance consistency and performance with threshold-based triggers.
     */
    it('should use reasonable threshold for WAL-style checkpointing', () => {
      // 85% leaves 15% buffer for checkpoint overhead
      expect(DEFAULT_CHECKPOINT_POLICY.onContextThreshold.threshold).toBe(0.85);

      // Threshold is not too aggressive (would cause frequent checkpoints)
      expect(DEFAULT_CHECKPOINT_POLICY.onContextThreshold.threshold).toBeGreaterThan(0.7);

      // Threshold is not too conservative (would risk data loss)
      expect(DEFAULT_CHECKPOINT_POLICY.onContextThreshold.threshold).toBeLessThan(0.95);
    });
  });
});
