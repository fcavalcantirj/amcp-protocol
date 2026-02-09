/**
 * RelationshipContext tests
 * 
 * Tests for relationship tracking schema based on:
 * - Dunbar's Number (1998): ~150 relationships in fractal layers
 * - Theory of Mind (Premack 1978): Mental state attribution
 * - Trust Calibration (Lee & See 2004): Trust matches capabilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRelationship,
  updateRelationship,
  suggestRapportUpgrade,
  getDunbarLayer,
  type RelationshipContext,
  type EntityType,
  type RapportLevel
} from '../types/relationship-context.js';

describe('RelationshipContext', () => {
  describe('createRelationship', () => {
    it('should create a new relationship with default values', () => {
      const rel = createRelationship('user-123', 'human');
      
      expect(rel.entityId).toBe('user-123');
      expect(rel.entityType).toBe('human');
      expect(rel.rapport).toBe('new');
      expect(rel.history.interactionCount).toBe(1);
      expect(rel.history.topTopics).toEqual([]);
      expect(rel.preferences).toEqual({});
    });

    it('should create relationship with optional name', () => {
      const rel = createRelationship('agent-456', 'agent', {
        name: 'PhilBot'
      });
      
      expect(rel.name).toBe('PhilBot');
      expect(rel.entityType).toBe('agent');
    });

    it('should create relationship with initial preferences', () => {
      const rel = createRelationship('human-789', 'human', {
        name: 'Felipe',
        preferences: {
          communicationStyle: 'casual',
          detailLevel: 'detailed',
          timezone: 'America/Sao_Paulo'
        }
      });
      
      expect(rel.preferences.communicationStyle).toBe('casual');
      expect(rel.preferences.detailLevel).toBe('detailed');
      expect(rel.preferences.timezone).toBe('America/Sao_Paulo');
    });

    it('should set timestamps on creation', () => {
      const before = new Date().toISOString();
      const rel = createRelationship('test-1', 'service');
      const after = new Date().toISOString();
      
      expect(rel.history.firstInteraction >= before).toBe(true);
      expect(rel.history.lastInteraction <= after).toBe(true);
      expect(rel.history.firstInteraction).toBe(rel.history.lastInteraction);
    });
  });

  describe('updateRelationship', () => {
    let baseRelationship: RelationshipContext;

    beforeEach(() => {
      baseRelationship = createRelationship('user-123', 'human', {
        name: 'Test User'
      });
    });

    it('should increment interaction count', () => {
      const updated = updateRelationship(baseRelationship, {});
      expect(updated.history.interactionCount).toBe(2);
      
      const updated2 = updateRelationship(updated, {});
      expect(updated2.history.interactionCount).toBe(3);
    });

    it('should update lastInteraction timestamp', () => {
      const originalLast = baseRelationship.history.lastInteraction;
      
      // Small delay to ensure different timestamp
      const updated = updateRelationship(baseRelationship, {
        interactionAt: '2026-02-09T15:00:00Z'
      });
      
      expect(updated.history.lastInteraction).toBe('2026-02-09T15:00:00Z');
      expect(updated.history.firstInteraction).toBe(originalLast);
    });

    it('should preserve firstInteraction', () => {
      const first = baseRelationship.history.firstInteraction;
      
      const updated = updateRelationship(baseRelationship, {});
      const updated2 = updateRelationship(updated, {});
      
      expect(updated2.history.firstInteraction).toBe(first);
    });

    it('should add new topics', () => {
      const updated = updateRelationship(baseRelationship, {
        topics: ['coding', 'AI']
      });
      
      expect(updated.history.topTopics).toContain('coding');
      expect(updated.history.topTopics).toContain('AI');
    });

    it('should prioritize repeated topics (move to front)', () => {
      let rel = updateRelationship(baseRelationship, {
        topics: ['topic1', 'topic2', 'topic3']
      });
      
      // Repeat topic3
      rel = updateRelationship(rel, {
        topics: ['topic3']
      });
      
      expect(rel.history.topTopics[0]).toBe('topic3');
    });

    it('should keep max 10 topics', () => {
      let rel = baseRelationship;
      
      // Add 15 unique topics
      for (let i = 0; i < 15; i++) {
        rel = updateRelationship(rel, {
          topics: [`topic-${i}`]
        });
      }
      
      expect(rel.history.topTopics.length).toBeLessThanOrEqual(10);
    });

    it('should merge preferences', () => {
      const updated = updateRelationship(baseRelationship, {
        preferences: {
          communicationStyle: 'formal'
        }
      });
      
      const updated2 = updateRelationship(updated, {
        preferences: {
          detailLevel: 'brief'
        }
      });
      
      expect(updated2.preferences.communicationStyle).toBe('formal');
      expect(updated2.preferences.detailLevel).toBe('brief');
    });

    it('should update rapport level', () => {
      const updated = updateRelationship(baseRelationship, {
        rapport: 'familiar'
      });
      
      expect(updated.rapport).toBe('familiar');
    });

    it('should update trust calibration', () => {
      const updated = updateRelationship(baseRelationship, {
        trust: {
          level: 0.7,
          reliability: 0.8,
          basis: 'Consistent communication'
        }
      });
      
      expect(updated.trust?.level).toBe(0.7);
      expect(updated.trust?.reliability).toBe(0.8);
      expect(updated.trust?.basis).toBe('Consistent communication');
      expect(updated.trust?.calibratedAt).toBeDefined();
    });

    it('should merge trust updates', () => {
      let rel = updateRelationship(baseRelationship, {
        trust: { level: 0.5, reliability: 0.6 }
      });
      
      rel = updateRelationship(rel, {
        trust: { competence: 0.9 }
      });
      
      expect(rel.trust?.level).toBe(0.5);
      expect(rel.trust?.reliability).toBe(0.6);
      expect(rel.trust?.competence).toBe(0.9);
    });

    it('should update notes', () => {
      const updated = updateRelationship(baseRelationship, {
        notes: 'Prefers morning meetings'
      });
      
      expect(updated.notes).toBe('Prefers morning meetings');
    });
  });

  describe('suggestRapportUpgrade', () => {
    it('should suggest familiar after 5 interactions from new', () => {
      let rel = createRelationship('user-1', 'human');
      
      // 4 interactions - no suggestion
      for (let i = 0; i < 3; i++) {
        rel = updateRelationship(rel, {});
      }
      expect(suggestRapportUpgrade(rel)).toBeNull();
      
      // 5th interaction - suggest upgrade
      rel = updateRelationship(rel, {});
      expect(suggestRapportUpgrade(rel)).toBe('familiar');
    });

    it('should suggest trusted after 15 interactions with good trust', () => {
      let rel = createRelationship('user-2', 'human');
      rel = updateRelationship(rel, { rapport: 'familiar' });
      
      // Add interactions with trust
      for (let i = 0; i < 14; i++) {
        rel = updateRelationship(rel, {
          trust: { level: 0.7 }
        });
      }
      
      expect(suggestRapportUpgrade(rel)).toBe('trusted');
    });

    it('should not suggest trusted without sufficient trust level', () => {
      let rel = createRelationship('user-3', 'human');
      rel = updateRelationship(rel, { rapport: 'familiar' });
      
      // Add interactions with low trust
      for (let i = 0; i < 20; i++) {
        rel = updateRelationship(rel, {
          trust: { level: 0.3 }
        });
      }
      
      expect(suggestRapportUpgrade(rel)).toBeNull();
    });

    it('should suggest close after 50 interactions with high trust', () => {
      let rel = createRelationship('user-4', 'human');
      rel = updateRelationship(rel, { 
        rapport: 'trusted',
        trust: { level: 0.85 }
      });
      
      // Add many interactions
      for (let i = 0; i < 49; i++) {
        rel = updateRelationship(rel, {});
      }
      
      expect(suggestRapportUpgrade(rel)).toBe('close');
    });

    it('should return null for close rapport (already max)', () => {
      let rel = createRelationship('user-5', 'human');
      rel = updateRelationship(rel, { 
        rapport: 'close',
        trust: { level: 1.0 }
      });
      
      for (let i = 0; i < 100; i++) {
        rel = updateRelationship(rel, {});
      }
      
      expect(suggestRapportUpgrade(rel)).toBeNull();
    });
  });

  describe('getDunbarLayer', () => {
    it('should return correct Dunbar layers', () => {
      // Innermost circles
      expect(getDunbarLayer(1)).toBe(1.5);
      expect(getDunbarLayer(3)).toBe(5);
      expect(getDunbarLayer(10)).toBe(15);
      expect(getDunbarLayer(30)).toBe(50);
      expect(getDunbarLayer(100)).toBe(150);
      expect(getDunbarLayer(300)).toBe(500);
      expect(getDunbarLayer(1000)).toBe(1500);
      expect(getDunbarLayer(3000)).toBe(5000);
    });

    it('should return 5000 for very large counts', () => {
      expect(getDunbarLayer(10000)).toBe(5000);
    });

    it('should map rapport levels to approximate Dunbar layers', () => {
      // close ~5, trusted ~15, familiar ~50, new ~150+
      // This validates our rapport level design
      expect(getDunbarLayer(5)).toBe(5);   // close
      expect(getDunbarLayer(15)).toBe(15); // trusted
      expect(getDunbarLayer(50)).toBe(50); // familiar
    });
  });

  describe('entity types', () => {
    it('should handle human entities', () => {
      const rel = createRelationship('human-1', 'human');
      expect(rel.entityType).toBe('human');
    });

    it('should handle agent entities', () => {
      const rel = createRelationship('agent-1', 'agent', {
        name: 'HelperBot',
        preferences: {
          communicationStyle: 'structured'
        }
      });
      expect(rel.entityType).toBe('agent');
    });

    it('should handle service entities', () => {
      const rel = createRelationship('svc-github', 'service', {
        name: 'GitHub API',
        preferences: {
          custom: { rateLimit: 5000 }
        }
      });
      expect(rel.entityType).toBe('service');
      expect(rel.preferences.custom?.rateLimit).toBe(5000);
    });
  });

  describe('relationships persist across checkpoints', () => {
    it('should be serializable to JSON', () => {
      const rel = createRelationship('user-json', 'human', {
        name: 'JSON Test',
        preferences: {
          timezone: 'UTC',
          custom: { theme: 'dark' }
        }
      });
      
      const updated = updateRelationship(rel, {
        topics: ['testing', 'serialization'],
        trust: { level: 0.75 },
        notes: 'Test note'
      });
      
      const json = JSON.stringify(updated);
      const parsed = JSON.parse(json) as RelationshipContext;
      
      expect(parsed.entityId).toBe(updated.entityId);
      expect(parsed.rapport).toBe(updated.rapport);
      expect(parsed.history.topTopics).toEqual(updated.history.topTopics);
      expect(parsed.trust?.level).toBe(0.75);
      expect(parsed.notes).toBe('Test note');
    });
  });
});
