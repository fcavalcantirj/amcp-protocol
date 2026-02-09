/**
 * MemoryImportance schema tests
 * 
 * Validates the memory importance schema based on:
 * - Levels of Processing (Craik & Lockhart 1972)
 * - Memory Consolidation (McGaugh 2000)
 * - Forgetting Curve (Ebbinghaus 1885)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  type MemoryImportance,
  type MemoryDurability,
  type MemoryPriority,
  DEFAULT_IMPORTANCE,
  NEVER_FORGET_IMPORTANCE,
  markImportant,
  inferImportance,
  compareImportance,
  filterByDurability,
  getHumanMarked,
} from '../types/memory-importance.js';

describe('MemoryImportance Schema', () => {
  describe('Type definitions', () => {
    it('should have valid durability levels (Ebbinghaus forgetting curve)', () => {
      const durabilities: MemoryDurability[] = ['ephemeral', 'session', 'persistent', 'permanent'];
      
      // Each level represents increasing decay resistance
      durabilities.forEach((d) => {
        const importance: MemoryImportance = {
          durability: d,
          priority: 'normal',
          humanMarked: false,
        };
        expect(importance.durability).toBe(d);
      });
    });

    it('should have valid priority levels (McGaugh consolidation)', () => {
      const priorities: MemoryPriority[] = ['low', 'normal', 'high', 'critical'];
      
      priorities.forEach((p) => {
        const importance: MemoryImportance = {
          durability: 'session',
          priority: p,
          humanMarked: false,
        };
        expect(importance.priority).toBe(p);
      });
    });

    it('should support optional scope for context', () => {
      const importance: MemoryImportance = {
        durability: 'persistent',
        priority: 'high',
        scope: 'project:amcp',
        humanMarked: true,
        markedAt: '2026-02-09T16:00:00.000Z',
      };
      
      expect(importance.scope).toBe('project:amcp');
    });

    it('should track human marking (Craik & Lockhart deep processing)', () => {
      const humanMarked: MemoryImportance = {
        durability: 'permanent',
        priority: 'critical',
        humanMarked: true,
        markedAt: '2026-02-09T16:00:00.000Z',
      };
      
      const systemInferred: MemoryImportance = {
        durability: 'session',
        priority: 'normal',
        humanMarked: false,
      };
      
      expect(humanMarked.humanMarked).toBe(true);
      expect(humanMarked.markedAt).toBeDefined();
      expect(systemInferred.humanMarked).toBe(false);
      expect(systemInferred.markedAt).toBeUndefined();
    });
  });

  describe('Presets', () => {
    it('should have sensible DEFAULT_IMPORTANCE', () => {
      expect(DEFAULT_IMPORTANCE.durability).toBe('session');
      expect(DEFAULT_IMPORTANCE.priority).toBe('normal');
      expect(DEFAULT_IMPORTANCE.humanMarked).toBe(false);
    });

    it('should have NEVER_FORGET_IMPORTANCE for critical memories', () => {
      expect(NEVER_FORGET_IMPORTANCE.durability).toBe('permanent');
      expect(NEVER_FORGET_IMPORTANCE.priority).toBe('critical');
      expect(NEVER_FORGET_IMPORTANCE.humanMarked).toBe(true);
    });
  });

  describe('markImportant()', () => {
    it('should create human-marked importance with timestamp', () => {
      const before = new Date().toISOString();
      const importance = markImportant('persistent', 'high', 'project:test');
      const after = new Date().toISOString();
      
      expect(importance.durability).toBe('persistent');
      expect(importance.priority).toBe('high');
      expect(importance.scope).toBe('project:test');
      expect(importance.humanMarked).toBe(true);
      expect(importance.markedAt).toBeDefined();
      
      // Timestamp should be between before and after
      expect(importance.markedAt! >= before).toBe(true);
      expect(importance.markedAt! <= after).toBe(true);
    });

    it('should use defaults when no args provided', () => {
      const importance = markImportant();
      
      expect(importance.durability).toBe('persistent');
      expect(importance.priority).toBe('high');
      expect(importance.humanMarked).toBe(true);
    });
  });

  describe('inferImportance()', () => {
    it('should create system-inferred importance without timestamp', () => {
      const importance = inferImportance('session', 'low', 'background');
      
      expect(importance.durability).toBe('session');
      expect(importance.priority).toBe('low');
      expect(importance.scope).toBe('background');
      expect(importance.humanMarked).toBe(false);
      expect(importance.markedAt).toBeUndefined();
    });
  });

  describe('compareImportance()', () => {
    it('should compare by priority first', () => {
      const critical: MemoryImportance = { durability: 'ephemeral', priority: 'critical', humanMarked: false };
      const low: MemoryImportance = { durability: 'permanent', priority: 'low', humanMarked: false };
      
      // Critical priority beats permanent durability
      expect(compareImportance(critical, low)).toBeGreaterThan(0);
      expect(compareImportance(low, critical)).toBeLessThan(0);
    });

    it('should compare by durability when priority is equal', () => {
      const permanent: MemoryImportance = { durability: 'permanent', priority: 'normal', humanMarked: false };
      const ephemeral: MemoryImportance = { durability: 'ephemeral', priority: 'normal', humanMarked: false };
      
      expect(compareImportance(permanent, ephemeral)).toBeGreaterThan(0);
      expect(compareImportance(ephemeral, permanent)).toBeLessThan(0);
    });

    it('should return 0 for equal importance', () => {
      const a: MemoryImportance = { durability: 'session', priority: 'normal', humanMarked: false };
      const b: MemoryImportance = { durability: 'session', priority: 'normal', humanMarked: true };
      
      // humanMarked doesn't affect comparison
      expect(compareImportance(a, b)).toBe(0);
    });

    it('should correctly order all priority levels', () => {
      const priorities: MemoryPriority[] = ['low', 'normal', 'high', 'critical'];
      
      for (let i = 0; i < priorities.length - 1; i++) {
        const lower: MemoryImportance = { durability: 'session', priority: priorities[i], humanMarked: false };
        const higher: MemoryImportance = { durability: 'session', priority: priorities[i + 1], humanMarked: false };
        
        expect(compareImportance(lower, higher)).toBeLessThan(0);
      }
    });

    it('should correctly order all durability levels', () => {
      const durabilities: MemoryDurability[] = ['ephemeral', 'session', 'persistent', 'permanent'];
      
      for (let i = 0; i < durabilities.length - 1; i++) {
        const lower: MemoryImportance = { durability: durabilities[i], priority: 'normal', humanMarked: false };
        const higher: MemoryImportance = { durability: durabilities[i + 1], priority: 'normal', humanMarked: false };
        
        expect(compareImportance(lower, higher)).toBeLessThan(0);
      }
    });
  });

  describe('filterByDurability()', () => {
    interface TestMemory {
      id: string;
      importance?: MemoryImportance;
    }

    const testMemories: TestMemory[] = [
      { id: 'ephemeral', importance: { durability: 'ephemeral', priority: 'low', humanMarked: false } },
      { id: 'session', importance: { durability: 'session', priority: 'normal', humanMarked: false } },
      { id: 'persistent', importance: { durability: 'persistent', priority: 'high', humanMarked: false } },
      { id: 'permanent', importance: { durability: 'permanent', priority: 'critical', humanMarked: true } },
      { id: 'no-importance' }, // Uses default (session)
    ];

    it('should filter by minimum durability threshold', () => {
      const persistent = filterByDurability(testMemories, 'persistent');
      
      expect(persistent).toHaveLength(2);
      expect(persistent.map((m) => m.id)).toEqual(['persistent', 'permanent']);
    });

    it('should include all when filtering by ephemeral', () => {
      const all = filterByDurability(testMemories, 'ephemeral');
      
      expect(all).toHaveLength(5);
    });

    it('should treat missing importance as session', () => {
      const sessionAndAbove = filterByDurability(testMemories, 'session');
      
      // Should include: session, persistent, permanent, no-importance (defaults to session)
      expect(sessionAndAbove).toHaveLength(4);
      expect(sessionAndAbove.map((m) => m.id)).toContain('no-importance');
    });

    it('should return only permanent when filtering by permanent', () => {
      const permanent = filterByDurability(testMemories, 'permanent');
      
      expect(permanent).toHaveLength(1);
      expect(permanent[0].id).toBe('permanent');
    });
  });

  describe('getHumanMarked()', () => {
    interface TestMemory {
      id: string;
      importance?: MemoryImportance;
    }

    it('should return only human-marked memories', () => {
      const memories: TestMemory[] = [
        { id: 'human-1', importance: markImportant() },
        { id: 'system-1', importance: inferImportance() },
        { id: 'human-2', importance: { durability: 'permanent', priority: 'critical', humanMarked: true } },
        { id: 'system-2', importance: { durability: 'persistent', priority: 'high', humanMarked: false } },
        { id: 'no-importance' },
      ];
      
      const humanMarked = getHumanMarked(memories);
      
      expect(humanMarked).toHaveLength(2);
      expect(humanMarked.map((m) => m.id)).toEqual(['human-1', 'human-2']);
    });

    it('should return empty array when no human-marked memories', () => {
      const memories: TestMemory[] = [
        { id: 'system-1', importance: inferImportance() },
        { id: 'no-importance' },
      ];
      
      const humanMarked = getHumanMarked(memories);
      
      expect(humanMarked).toHaveLength(0);
    });

    it('should verify human can mark memory as "never forget"', () => {
      // This is a key requirement from the task spec
      const memory: TestMemory = {
        id: 'critical-memory',
        importance: {
          ...NEVER_FORGET_IMPORTANCE,
          markedAt: new Date().toISOString(),
        },
      };
      
      const humanMarked = getHumanMarked([memory]);
      
      expect(humanMarked).toHaveLength(1);
      expect(humanMarked[0].importance?.durability).toBe('permanent');
      expect(humanMarked[0].importance?.priority).toBe('critical');
      expect(humanMarked[0].importance?.humanMarked).toBe(true);
    });
  });

  describe('Research validation', () => {
    it('should model Ebbinghaus forgetting curve with durability levels', () => {
      // Ephemeral = rapid decay (working memory)
      // Session = decay over hours/days (short-term)
      // Persistent = decay over weeks/months (long-term)
      // Permanent = no decay (consolidated/protected)
      
      const durabilityOrder = ['ephemeral', 'session', 'persistent', 'permanent'] as const;
      
      // Each level should have increasing decay resistance
      for (let i = 0; i < durabilityOrder.length - 1; i++) {
        const lower: MemoryImportance = { durability: durabilityOrder[i], priority: 'normal', humanMarked: false };
        const higher: MemoryImportance = { durability: durabilityOrder[i + 1], priority: 'normal', humanMarked: false };
        
        // When priority is equal, durability determines comparison
        expect(compareImportance(lower, higher)).toBeLessThan(0);
      }
    });

    it('should model McGaugh consolidation with priority levels', () => {
      // Critical memories should be consolidated first
      // This maps to emotional arousal modulating consolidation
      
      const criticalMemory: MemoryImportance = markImportant('permanent', 'critical');
      const normalMemory: MemoryImportance = inferImportance('session', 'normal');
      
      // Critical should have higher comparison value
      expect(compareImportance(criticalMemory, normalMemory)).toBeGreaterThan(0);
    });

    it('should model Craik & Lockhart deep processing via human marking', () => {
      // Human marking = deeper semantic processing
      // Should result in more durable memory trace
      
      const humanMarked = markImportant();
      const systemInferred = inferImportance();
      
      // Human marking defaults to persistent/high
      // System inference defaults to session/normal
      expect(humanMarked.durability).toBe('persistent');
      expect(systemInferred.durability).toBe('session');
      
      // Human-marked memories should be distinguishable
      expect(humanMarked.humanMarked).toBe(true);
      expect(systemInferred.humanMarked).toBe(false);
    });
  });
});
