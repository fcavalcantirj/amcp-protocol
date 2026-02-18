/**
 * Learning entity types — Problem and Learning definitions
 *
 * Per protocol-09-learning-schema: typed definitions for the agent
 * learning layer, including ID format validators and schema validators.
 */

/** Problem lifecycle status */
export enum ProblemStatus {
  Open = 'open',
  Stuck = 'stuck',
  Solved = 'solved',
  Abandoned = 'abandoned',
}

/** Confidence level for a learned insight */
export enum LearningConfidence {
  Tentative = 'tentative',
  Verified = 'verified',
}

/** A problem encountered by the agent */
export interface Problem {
  id: string;
  description: string;
  status: ProblemStatus;
  blocker?: string;
  attempts: number;
  lastApproach?: string;
  retryAfter?: Date;
  created: Date;
  updated: Date;
  resolved?: Date;
  humanVerified: boolean;
  source: 'command' | 'skill' | 'self-detect';
  tags: string[];
}

/** A learned insight from solving (or failing to solve) a problem */
export interface Learning {
  id: string;
  insight: string;
  sourceProblem?: string;
  confidence: LearningConfidence;
  humanVerified: boolean;
  verifiedAt?: Date;
  tags: string[];
  created: Date;
}

/** Result of validating a Problem or Learning object */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_PROBLEM_STATUSES = new Set(Object.values(ProblemStatus));
const VALID_CONFIDENCE_VALUES = new Set(Object.values(LearningConfidence));
const VALID_SOURCES = new Set(['command', 'skill', 'self-detect']);

/** ID format: prob_ followed by exactly 8 lowercase alphanumeric characters */
const PROBLEM_ID_RE = /^prob_[0-9a-z]{8}$/;

/** ID format: learn_ followed by exactly 8 lowercase alphanumeric characters */
const LEARNING_ID_RE = /^learn_[0-9a-z]{8}$/;

/** Check if a string matches the Problem ID format (prob_{uuid8}) */
export function isProblemId(id: string): boolean {
  return PROBLEM_ID_RE.test(id);
}

/** Check if a string matches the Learning ID format (learn_{uuid8}) */
export function isLearningId(id: string): boolean {
  return LEARNING_ID_RE.test(id);
}

/** Validate a Problem object against the schema */
export function validateProblem(obj: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { valid: false, errors: ['Expected a Problem object'] };
  }

  const p = obj as Record<string, unknown>;

  // Required string fields
  for (const field of ['id', 'description'] as const) {
    if (typeof p[field] !== 'string') {
      errors.push(`Missing or invalid required field '${field}'`);
    }
  }

  // ID format
  if (typeof p.id === 'string' && !isProblemId(p.id)) {
    errors.push(`Invalid id format: expected prob_{8 alphanumeric chars}, got '${p.id}'`);
  }

  // Status enum
  if (!VALID_PROBLEM_STATUSES.has(p.status as ProblemStatus)) {
    errors.push(`Invalid status: expected one of ${[...VALID_PROBLEM_STATUSES].join(', ')}, got '${String(p.status)}'`);
  }

  // Source enum
  if (!VALID_SOURCES.has(p.source as string)) {
    errors.push(`Invalid source: expected one of ${[...VALID_SOURCES].join(', ')}, got '${String(p.source)}'`);
  }

  // attempts must be a number
  if (typeof p.attempts !== 'number') {
    errors.push("Missing or invalid required field 'attempts'");
  }

  // humanVerified must be a boolean
  if (typeof p.humanVerified !== 'boolean') {
    errors.push("Missing or invalid required field 'humanVerified'");
  }

  // created and updated must be Date instances
  if (!(p.created instanceof Date)) {
    errors.push("Missing or invalid required field 'created'");
  }
  if (!(p.updated instanceof Date)) {
    errors.push("Missing or invalid required field 'updated'");
  }

  return { valid: errors.length === 0, errors };
}

/** Validate a Learning object against the schema */
export function validateLearning(obj: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { valid: false, errors: ['Expected a Learning object'] };
  }

  const l = obj as Record<string, unknown>;

  // Required string fields
  for (const field of ['id', 'insight'] as const) {
    if (typeof l[field] !== 'string') {
      errors.push(`Missing or invalid required field '${field}'`);
    }
  }

  // ID format
  if (typeof l.id === 'string' && !isLearningId(l.id)) {
    errors.push(`Invalid id format: expected learn_{8 alphanumeric chars}, got '${l.id}'`);
  }

  // Confidence enum
  if (!VALID_CONFIDENCE_VALUES.has(l.confidence as LearningConfidence)) {
    errors.push(`Invalid confidence: expected one of ${[...VALID_CONFIDENCE_VALUES].join(', ')}, got '${String(l.confidence)}'`);
  }

  // humanVerified must be a boolean
  if (typeof l.humanVerified !== 'boolean') {
    errors.push("Missing or invalid required field 'humanVerified'");
  }

  // tags must be an array
  if (!Array.isArray(l.tags)) {
    errors.push("Missing or invalid required field 'tags'");
  }

  // created must be a Date
  if (!(l.created instanceof Date)) {
    errors.push("Missing or invalid required field 'created'");
  }

  return { valid: errors.length === 0, errors };
}
