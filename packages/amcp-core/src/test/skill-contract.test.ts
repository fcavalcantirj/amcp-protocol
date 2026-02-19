/**
 * Skill contract validation tests
 *
 * Verifies SkillOntologyContract type definitions, validateContract(),
 * checkPreconditions(), and detectConflicts() functions.
 */

import { describe, it, expect } from 'vitest';
import {
  validateContract,
  checkPreconditions,
  detectConflicts,
  type SkillOntologyContract,
  type ContractPredicate,
  type ContractEntity,
} from '../skill-contract.js';

describe('Skill contract types and validation', () => {
  describe('validateContract()', () => {
    it('valid contract with all required fields passes', () => {
      const contract: SkillOntologyContract = {
        skill_name: 'task-manager',
        version: '1.0.0',
        ontology: {
          reads: ['Task', 'Person'],
          writes: ['Task'],
          preconditions: [],
          postconditions: [],
        },
      };

      const result = validateContract(contract);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('contract missing skill_name fails validation', () => {
      const contract = {
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: ['Task'],
          preconditions: [],
          postconditions: [],
        },
      } as unknown as SkillOntologyContract;

      const result = validateContract(contract);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('skill_name'))).toBe(true);
    });

    it('invalid EntityType in reads array fails validation', () => {
      const contract: SkillOntologyContract = {
        skill_name: 'bad-reader',
        version: '1.0.0',
        ontology: {
          reads: ['Task', 'InvalidType' as string],
          writes: [],
          preconditions: [],
          postconditions: [],
        },
      };

      const result = validateContract(contract);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('InvalidType'))).toBe(true);
    });

    it('empty preconditions array is valid', () => {
      const contract: SkillOntologyContract = {
        skill_name: 'no-preconditions',
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: ['Task'],
          preconditions: [],
          postconditions: [],
        },
      };

      const result = validateContract(contract);

      expect(result.valid).toBe(true);
    });
  });

  describe('checkPreconditions()', () => {
    it('condition met: all Tasks have assignee', () => {
      const contract: SkillOntologyContract = {
        skill_name: 'task-assigner',
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: ['Task'],
          preconditions: [
            {
              entity_type: 'Task',
              condition: 'assignee exists',
              description: 'All tasks must have an assignee',
            },
          ],
          postconditions: [],
        },
      };

      const entities: ContractEntity[] = [
        { id: 'task-1', entity_type: 'Task', properties: { assignee: 'alice' } },
        { id: 'task-2', entity_type: 'Task', properties: { assignee: 'bob' } },
      ];

      const result = checkPreconditions(contract, entities);

      expect(result.satisfied).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('condition failed: some Tasks missing assignee', () => {
      const contract: SkillOntologyContract = {
        skill_name: 'task-assigner',
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: ['Task'],
          preconditions: [
            {
              entity_type: 'Task',
              condition: 'assignee exists',
            },
          ],
          postconditions: [],
        },
      };

      const entities: ContractEntity[] = [
        { id: 'task-1', entity_type: 'Task', properties: { assignee: 'alice' } },
        { id: 'task-2', entity_type: 'Task', properties: { title: 'Fix bug' } },
        { id: 'task-3', entity_type: 'Task', properties: {} },
      ];

      const result = checkPreconditions(contract, entities);

      expect(result.satisfied).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      // Should report which entities violated the condition
      expect(result.violations.some(v => v.entity_id === 'task-2')).toBe(true);
      expect(result.violations.some(v => v.entity_id === 'task-3')).toBe(true);
    });

    it('skips entities not matching precondition entity_type', () => {
      const contract: SkillOntologyContract = {
        skill_name: 'task-checker',
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: [],
          preconditions: [
            { entity_type: 'Task', condition: 'status exists' },
          ],
          postconditions: [],
        },
      };

      const entities: ContractEntity[] = [
        { id: 'task-1', entity_type: 'Task', properties: { status: 'done' } },
        { id: 'person-1', entity_type: 'Person', properties: { name: 'Alice' } },
      ];

      const result = checkPreconditions(contract, entities);

      expect(result.satisfied).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('detectConflicts()', () => {
    it('incompatible postconditions detected as conflict', () => {
      const contractA: SkillOntologyContract = {
        skill_name: 'skill-A',
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: ['Task'],
          preconditions: [],
          postconditions: [
            { entity_type: 'Task', condition: 'status = done' },
          ],
        },
      };

      const contractB: SkillOntologyContract = {
        skill_name: 'skill-B',
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: ['Task'],
          preconditions: [],
          postconditions: [
            { entity_type: 'Task', condition: 'status != done' },
          ],
        },
      };

      const conflicts = detectConflicts([contractA, contractB]);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].skill_a).toBe('skill-A');
      expect(conflicts[0].skill_b).toBe('skill-B');
    });

    it('compatible contracts have no conflicts (read vs write)', () => {
      const contractA: SkillOntologyContract = {
        skill_name: 'skill-reader',
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: [],
          preconditions: [],
          postconditions: [],
        },
      };

      const contractB: SkillOntologyContract = {
        skill_name: 'skill-writer',
        version: '1.0.0',
        ontology: {
          reads: [],
          writes: ['Task'],
          preconditions: [],
          postconditions: [
            { entity_type: 'Task', condition: 'status = active' },
          ],
        },
      };

      const conflicts = detectConflicts([contractA, contractB]);

      expect(conflicts).toHaveLength(0);
    });

    it('single contract has no conflicts', () => {
      const contract: SkillOntologyContract = {
        skill_name: 'solo',
        version: '1.0.0',
        ontology: {
          reads: ['Task'],
          writes: ['Task'],
          preconditions: [],
          postconditions: [
            { entity_type: 'Task', condition: 'status = done' },
          ],
        },
      };

      const conflicts = detectConflicts([contract]);

      expect(conflicts).toHaveLength(0);
    });

    it('empty contracts array has no conflicts', () => {
      const conflicts = detectConflicts([]);

      expect(conflicts).toHaveLength(0);
    });
  });
});
