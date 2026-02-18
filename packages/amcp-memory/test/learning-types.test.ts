/**
 * Learning types tests (prd-v1 task 26)
 *
 * Unit tests for Problem and Learning schema validation —
 * verify type definitions, enums, and ID format validators.
 */

import { describe, it, expect } from 'vitest';
import {
  ProblemStatus,
  LearningConfidence,
  isProblemId,
  isLearningId,
  validateProblem,
  validateLearning,
  type Problem,
  type Learning,
} from '../src/learning-types.js';

describe('ProblemStatus enum', () => {
  it('has all four required values', () => {
    expect(ProblemStatus.Open).toBe('open');
    expect(ProblemStatus.Stuck).toBe('stuck');
    expect(ProblemStatus.Solved).toBe('solved');
    expect(ProblemStatus.Abandoned).toBe('abandoned');
  });
});

describe('LearningConfidence enum', () => {
  it('has tentative and verified values', () => {
    expect(LearningConfidence.Tentative).toBe('tentative');
    expect(LearningConfidence.Verified).toBe('verified');
  });
});

describe('validateProblem', () => {
  const validProblem: Problem = {
    id: 'prob_abc12345',
    description: 'Test problem',
    status: ProblemStatus.Open,
    attempts: 0,
    created: new Date('2026-02-18'),
    updated: new Date('2026-02-18'),
    humanVerified: false,
    source: 'self-detect',
    tags: [],
  };

  it('valid Problem object passes validation', () => {
    const result = validateProblem(validProblem);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Problem missing description field fails validation', () => {
    const { description, ...incomplete } = validProblem;
    const result = validateProblem(incomplete as unknown as Problem);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('description'))).toBe(true);
  });

  it('Problem with invalid status value fails validation', () => {
    const bad = { ...validProblem, status: 'invalid-status' as ProblemStatus };
    const result = validateProblem(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('status'))).toBe(true);
  });

  it('Problem with invalid id format fails validation', () => {
    const bad = { ...validProblem, id: 'not-a-valid-id' };
    const result = validateProblem(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('Problem with invalid source value fails validation', () => {
    const bad = { ...validProblem, source: 'unknown' as Problem['source'] };
    const result = validateProblem(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });
});

describe('validateLearning', () => {
  const validLearning: Learning = {
    id: 'learn_xyz98765',
    insight: 'Always check return values',
    confidence: LearningConfidence.Tentative,
    humanVerified: false,
    tags: ['error-handling'],
    created: new Date('2026-02-18'),
  };

  it('valid Learning object passes validation', () => {
    const result = validateLearning(validLearning);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Learning with invalid confidence value fails validation', () => {
    const bad = { ...validLearning, confidence: 'maybe' as LearningConfidence };
    const result = validateLearning(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('confidence'))).toBe(true);
  });

  it('Learning missing insight field fails validation', () => {
    const { insight, ...incomplete } = validLearning;
    const result = validateLearning(incomplete as unknown as Learning);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('insight'))).toBe(true);
  });
});

describe('isProblemId', () => {
  it('prob_abc12345 returns true', () => {
    expect(isProblemId('prob_abc12345')).toBe(true);
  });

  it('prob_ followed by exactly 8 alphanumeric chars returns true', () => {
    expect(isProblemId('prob_deadbeef')).toBe(true);
    expect(isProblemId('prob_00000000')).toBe(true);
  });

  it('invalid formats return false', () => {
    expect(isProblemId('invalid')).toBe(false);
    expect(isProblemId('learn_abc12345')).toBe(false);
    expect(isProblemId('prob_')).toBe(false);
    expect(isProblemId('prob_abc')).toBe(false);       // too short
    expect(isProblemId('prob_abc123456')).toBe(false);  // too long
    expect(isProblemId('')).toBe(false);
  });
});

describe('isLearningId', () => {
  it('learn_xyz98765 returns true', () => {
    expect(isLearningId('learn_xyz98765')).toBe(true);
  });

  it('learn_ followed by exactly 8 alphanumeric chars returns true', () => {
    expect(isLearningId('learn_deadbeef')).toBe(true);
    expect(isLearningId('learn_00000000')).toBe(true);
  });

  it('invalid formats return false', () => {
    expect(isLearningId('prob_abc12345')).toBe(false);
    expect(isLearningId('learn_')).toBe(false);
    expect(isLearningId('learn_abc')).toBe(false);       // too short
    expect(isLearningId('learn_abc123456')).toBe(false);  // too long
    expect(isLearningId('')).toBe(false);
  });
});
