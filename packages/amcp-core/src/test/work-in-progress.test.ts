/**
 * WorkInProgress Schema Tests
 * 
 * Tests for the Zeigarnik-inspired task tracking schema.
 * 
 * The Zeigarnik Effect (1927) shows incomplete tasks are remembered
 * better than complete ones. These tests validate:
 * - Task lifecycle (start → progress → complete)
 * - Approach tracking (trying → failed/succeeded)
 * - Blocker management
 * - Related memory association
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  startTask,
  updateProgress,
  completeTask,
  isBlocked,
  getCurrentApproach,
  getFailedApproachCount,
  type WorkInProgress,
} from '../types/work-in-progress.js';

describe('WorkInProgress', () => {
  describe('startTask', () => {
    it('should create a task in planning status without initial approach', () => {
      const wip = startTask({
        description: 'Implement authentication',
      });

      expect(wip.taskId).toMatch(/^task_[a-z0-9]+_[a-z0-9]+$/);
      expect(wip.description).toBe('Implement authentication');
      expect(wip.status).toBe('planning');
      expect(wip.approaches).toHaveLength(0);
      expect(wip.relatedMemories).toHaveLength(0);
      expect(new Date(wip.startedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should create a task in in_progress status with initial approach', () => {
      const wip = startTask({
        description: 'Fix memory leak',
        initialApproach: 'Using heap profiler to identify source',
      });

      expect(wip.status).toBe('in_progress');
      expect(wip.approaches).toHaveLength(1);
      expect(wip.approaches[0]).toEqual({
        description: 'Using heap profiler to identify source',
        status: 'trying',
      });
    });

    it('should allow custom task ID', () => {
      const wip = startTask({
        taskId: 'custom_123',
        description: 'Custom task',
      });

      expect(wip.taskId).toBe('custom_123');
    });

    it('should accept related memories', () => {
      const wip = startTask({
        description: 'Continue previous work',
        relatedMemories: ['bafy...abc', 'bafy...def'],
      });

      expect(wip.relatedMemories).toEqual(['bafy...abc', 'bafy...def']);
    });
  });

  describe('updateProgress', () => {
    let wip: WorkInProgress;

    beforeEach(() => {
      wip = startTask({
        description: 'Test task',
        initialApproach: 'First approach',
      });
    });

    it('should update task status', () => {
      const updated = updateProgress(wip, { status: 'blocked' });

      expect(updated.status).toBe('blocked');
      // Original unchanged (immutability)
      expect(wip.status).toBe('in_progress');
    });

    it('should add new approach', () => {
      const updated = updateProgress(wip, {
        newApproach: {
          description: 'Second approach',
          notes: 'Trying different angle',
        },
      });

      expect(updated.approaches).toHaveLength(2);
      expect(updated.approaches[1]).toEqual({
        description: 'Second approach',
        status: 'trying',
        notes: 'Trying different angle',
      });
    });

    it('should update existing approach status', () => {
      const updated = updateProgress(wip, {
        updateApproach: {
          description: 'First approach',
          status: 'failed',
          notes: 'Did not work due to race condition',
        },
      });

      expect(updated.approaches[0].status).toBe('failed');
      expect(updated.approaches[0].notes).toBe('Did not work due to race condition');
    });

    it('should set blockers', () => {
      const updated = updateProgress(wip, {
        status: 'blocked',
        blockers: ['Waiting for API access', 'Need design review'],
      });

      expect(updated.status).toBe('blocked');
      expect(updated.blockers).toEqual(['Waiting for API access', 'Need design review']);
    });

    it('should set next step', () => {
      const updated = updateProgress(wip, {
        nextStep: 'Review test results and iterate',
      });

      expect(updated.nextStep).toBe('Review test results and iterate');
    });

    it('should add related memories without duplicates', () => {
      const withMemories = updateProgress(wip, {
        addRelatedMemories: ['bafy...abc'],
      });

      const withMore = updateProgress(withMemories, {
        addRelatedMemories: ['bafy...abc', 'bafy...def'], // abc is duplicate
      });

      expect(withMore.relatedMemories).toEqual(['bafy...abc', 'bafy...def']);
    });

    it('should preserve unmodified fields', () => {
      const updated = updateProgress(wip, { status: 'reviewing' });

      expect(updated.taskId).toBe(wip.taskId);
      expect(updated.description).toBe(wip.description);
      expect(updated.startedAt).toBe(wip.startedAt);
      expect(updated.approaches).toEqual(wip.approaches);
    });
  });

  describe('completeTask', () => {
    it('should create CompletedTask with duration', async () => {
      const wip = startTask({
        description: 'Quick task',
        initialApproach: 'Direct solution',
      });

      // Small delay to ensure duration > 0
      await new Promise(r => setTimeout(r, 10));

      const completed = completeTask(wip, 'Task done successfully');

      expect(completed.taskId).toBe(wip.taskId);
      expect(completed.description).toBe(wip.description);
      expect(completed.startedAt).toBe(wip.startedAt);
      expect(new Date(completed.completedAt).getTime()).toBeGreaterThan(
        new Date(wip.startedAt).getTime()
      );
      expect(completed.durationMs).toBeGreaterThan(0);
      expect(completed.notes).toBe('Task done successfully');
      expect(completed.allApproaches).toEqual(wip.approaches);
    });

    it('should identify successful approach', () => {
      let wip = startTask({
        description: 'Multi-approach task',
        initialApproach: 'First try',
      });

      wip = updateProgress(wip, {
        updateApproach: { description: 'First try', status: 'failed' },
      });

      wip = updateProgress(wip, {
        newApproach: { description: 'Second try', status: 'succeeded' },
      });

      const completed = completeTask(wip);

      expect(completed.successfulApproach).toEqual({
        description: 'Second try',
        status: 'succeeded',
      });
    });

    it('should handle completion without successful approach', () => {
      const wip = startTask({
        description: 'Abandoned task',
      });

      const completed = completeTask(wip, 'Decided not worth pursuing');

      expect(completed.successfulApproach).toBeUndefined();
      expect(completed.notes).toBe('Decided not worth pursuing');
    });
  });

  describe('helper functions', () => {
    describe('isBlocked', () => {
      it('should return true when status is blocked with blockers', () => {
        const wip = updateProgress(
          startTask({ description: 'Test' }),
          { status: 'blocked', blockers: ['Waiting on dependency'] }
        );

        expect(isBlocked(wip)).toBe(true);
      });

      it('should return false when status is blocked but no blockers', () => {
        const wip = updateProgress(
          startTask({ description: 'Test' }),
          { status: 'blocked' }
        );

        expect(isBlocked(wip)).toBe(false);
      });

      it('should return false when status is not blocked', () => {
        const wip = startTask({
          description: 'Test',
          initialApproach: 'Working on it',
        });

        expect(isBlocked(wip)).toBe(false);
      });
    });

    describe('getCurrentApproach', () => {
      it('should return most recent trying approach', () => {
        let wip = startTask({
          description: 'Test',
          initialApproach: 'First',
        });

        wip = updateProgress(wip, {
          updateApproach: { description: 'First', status: 'failed' },
        });

        wip = updateProgress(wip, {
          newApproach: { description: 'Second' },
        });

        const current = getCurrentApproach(wip);
        expect(current?.description).toBe('Second');
        expect(current?.status).toBe('trying');
      });

      it('should return undefined when no approach is trying', () => {
        let wip = startTask({
          description: 'Test',
          initialApproach: 'Only one',
        });

        wip = updateProgress(wip, {
          updateApproach: { description: 'Only one', status: 'succeeded' },
        });

        expect(getCurrentApproach(wip)).toBeUndefined();
      });
    });

    describe('getFailedApproachCount', () => {
      it('should count failed approaches', () => {
        let wip = startTask({
          description: 'Difficult task',
          initialApproach: 'Attempt 1',
        });

        wip = updateProgress(wip, {
          updateApproach: { description: 'Attempt 1', status: 'failed' },
        });

        wip = updateProgress(wip, {
          newApproach: { description: 'Attempt 2', status: 'failed' },
        });

        wip = updateProgress(wip, {
          newApproach: { description: 'Attempt 3' }, // trying
        });

        expect(getFailedApproachCount(wip)).toBe(2);
      });

      it('should return 0 when no failed approaches', () => {
        const wip = startTask({
          description: 'Test',
          initialApproach: 'Working',
        });

        expect(getFailedApproachCount(wip)).toBe(0);
      });
    });
  });

  describe('Zeigarnik Effect scenarios', () => {
    it('should capture interrupted work state for recovery', () => {
      // Simulate agent working on a task when session ends
      let wip = startTask({
        description: 'Implement OAuth2 flow',
        initialApproach: 'Using authorization code grant',
        relatedMemories: ['bafy...userStory', 'bafy...requirements'],
      });

      wip = updateProgress(wip, {
        status: 'in_progress',
        nextStep: 'Add refresh token rotation',
        addRelatedMemories: ['bafy...tokenDocs'],
      });

      // Session ends - this state would be checkpointed
      expect(wip.status).toBe('in_progress');
      expect(wip.nextStep).toBe('Add refresh token rotation');
      expect(wip.relatedMemories).toHaveLength(3);
      
      // On recovery, agent knows exactly where to resume
      const current = getCurrentApproach(wip);
      expect(current?.description).toBe('Using authorization code grant');
    });

    it('should track multiple failed approaches (learning from failures)', () => {
      // Agent tries multiple approaches before succeeding
      let wip = startTask({
        description: 'Fix race condition in event handler',
        initialApproach: 'Add mutex lock',
      });

      // First approach fails
      wip = updateProgress(wip, {
        updateApproach: {
          description: 'Add mutex lock',
          status: 'failed',
          notes: 'Caused deadlock in async context',
        },
      });

      // Second approach fails
      wip = updateProgress(wip, {
        newApproach: {
          description: 'Use atomic operations',
          notes: 'Trying lock-free approach',
        },
      });

      wip = updateProgress(wip, {
        updateApproach: {
          description: 'Use atomic operations',
          status: 'failed',
          notes: 'Not applicable to this data structure',
        },
      });

      // Third approach succeeds
      wip = updateProgress(wip, {
        newApproach: {
          description: 'Queue events with debounce',
        },
      });

      wip = updateProgress(wip, {
        updateApproach: {
          description: 'Queue events with debounce',
          status: 'succeeded',
          notes: 'Resolved race condition and improved performance',
        },
      });

      const completed = completeTask(wip);

      // History is preserved - valuable for future similar problems
      expect(completed.allApproaches).toHaveLength(3);
      expect(getFailedApproachCount(wip)).toBe(2);
      expect(completed.successfulApproach?.description).toBe('Queue events with debounce');
    });
  });
});
