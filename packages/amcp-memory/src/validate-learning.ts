/**
 * Learning data validation and statistics
 *
 * Validates Problem and Learning JSONL files in a memory/learning/ directory,
 * including cross-reference checks and stats consistency.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProblemStatus, LearningConfidence } from './learning-types.js';

/** Result of validating a learning data directory */
export interface LearningDataValidationResult {
  valid: boolean;
  problemCount: number;
  learningCount: number;
  errors: string[];
}

/** Aggregated learning statistics */
export interface LearningStats {
  totalProblems: number;
  totalSolved: number;
  solvedPostRecovery: number;
  totalLearnings: number;
  problemsByStatus: Record<string, number>;
  learningsByConfidence: Record<string, number>;
}

const VALID_STATUSES = new Set(Object.values(ProblemStatus));
const VALID_CONFIDENCES = new Set(Object.values(LearningConfidence));

/** Read a file, returning null if it doesn't exist */
async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Parse non-empty lines from JSONL content */
function parseLines(content: string): string[] {
  return content.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Validate a learning data directory containing problems.jsonl, learnings.jsonl, stats.json
 *
 * @param dirPath - Path to the memory/learning/ directory
 * @returns Validation result with counts and errors
 */
export async function validateLearningData(dirPath: string): Promise<LearningDataValidationResult> {
  const errors: string[] = [];
  const problemIds = new Set<string>();
  let problemCount = 0;
  let learningCount = 0;

  // Parse problems.jsonl
  const problemsContent = await readFileOrNull(join(dirPath, 'problems.jsonl'));
  if (problemsContent !== null) {
    const lines = parseLines(problemsContent);
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(lines[i]);
      } catch {
        errors.push(`problems.jsonl line ${lineNum}: invalid JSON`);
        continue;
      }

      // Validate required problem fields
      const fieldErrors = validateProblemFields(parsed, lineNum, 'problems.jsonl');
      if (fieldErrors.length > 0) {
        errors.push(...fieldErrors);
      } else {
        problemIds.add(parsed.id as string);
        problemCount++;
      }
    }
  }

  // Parse learnings.jsonl
  const learningsContent = await readFileOrNull(join(dirPath, 'learnings.jsonl'));
  if (learningsContent !== null) {
    const lines = parseLines(learningsContent);
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(lines[i]);
      } catch {
        errors.push(`learnings.jsonl line ${lineNum}: invalid JSON`);
        continue;
      }

      const fieldErrors = validateLearningFields(parsed, lineNum, 'learnings.jsonl');
      if (fieldErrors.length > 0) {
        errors.push(...fieldErrors);
      } else {
        // Cross-reference: sourceProblem must exist
        if (parsed.sourceProblem && !problemIds.has(parsed.sourceProblem as string)) {
          errors.push(`learnings.jsonl line ${lineNum}: sourceProblem ${parsed.sourceProblem} not found`);
        } else {
          learningCount++;
        }
      }
    }
  }

  // Validate stats.json consistency
  const statsContent = await readFileOrNull(join(dirPath, 'stats.json'));
  if (statsContent !== null) {
    try {
      const stats = JSON.parse(statsContent);
      if (typeof stats.totalProblems === 'number' && stats.totalProblems !== problemCount) {
        errors.push(`stats.json: totalProblems is ${stats.totalProblems} but found ${problemCount} problems`);
      }
      if (typeof stats.totalSolved === 'number') {
        const solvedCount = countSolvedProblems(problemsContent);
        if (stats.totalSolved !== solvedCount) {
          errors.push(`stats.json: totalSolved is ${stats.totalSolved} but found ${solvedCount} solved problems`);
        }
      }
    } catch {
      errors.push('stats.json: invalid JSON');
    }
  }

  return {
    valid: errors.length === 0,
    problemCount,
    learningCount,
    errors,
  };
}

/** Count problems with status=solved from raw JSONL content */
function countSolvedProblems(content: string | null): number {
  if (!content) return 0;
  let count = 0;
  for (const line of parseLines(content)) {
    try {
      const obj = JSON.parse(line);
      if (obj.status === 'solved') count++;
    } catch { /* skip invalid */ }
  }
  return count;
}

/** Validate required Problem fields on a parsed line */
function validateProblemFields(obj: Record<string, unknown>, lineNum: number, file: string): string[] {
  const errs: string[] = [];
  for (const field of ['id', 'description', 'status', 'source']) {
    if (typeof obj[field] !== 'string') {
      errs.push(`${file} line ${lineNum}: missing required field ${field}`);
    }
  }
  if (typeof obj.status === 'string' && !VALID_STATUSES.has(obj.status as ProblemStatus)) {
    errs.push(`${file} line ${lineNum}: invalid status '${obj.status}'`);
  }
  if (typeof obj.attempts !== 'number') {
    errs.push(`${file} line ${lineNum}: missing required field attempts`);
  }
  return errs;
}

/** Validate required Learning fields on a parsed line */
function validateLearningFields(obj: Record<string, unknown>, lineNum: number, file: string): string[] {
  const errs: string[] = [];
  for (const field of ['id', 'insight', 'confidence']) {
    if (typeof obj[field] !== 'string') {
      errs.push(`${file} line ${lineNum}: missing required field ${field}`);
    }
  }
  if (typeof obj.confidence === 'string' && !VALID_CONFIDENCES.has(obj.confidence as LearningConfidence)) {
    errs.push(`${file} line ${lineNum}: invalid confidence '${obj.confidence}'`);
  }
  return errs;
}

/**
 * Compute aggregate statistics from JSONL learning files
 *
 * @param dirPath - Path to the memory/learning/ directory
 * @returns Aggregated stats (zeros for missing files)
 */
export async function computeLearningStats(dirPath: string): Promise<LearningStats> {
  const stats: LearningStats = {
    totalProblems: 0,
    totalSolved: 0,
    solvedPostRecovery: 0,
    totalLearnings: 0,
    problemsByStatus: { open: 0, stuck: 0, solved: 0, abandoned: 0 },
    learningsByConfidence: { tentative: 0, verified: 0 },
  };

  // Parse problems
  const problemsContent = await readFileOrNull(join(dirPath, 'problems.jsonl'));
  if (problemsContent !== null) {
    for (const line of parseLines(problemsContent)) {
      try {
        const obj = JSON.parse(line);
        stats.totalProblems++;
        const status = obj.status as string;
        if (status in stats.problemsByStatus) {
          stats.problemsByStatus[status]++;
        }
        if (status === 'solved') {
          stats.totalSolved++;
        }
      } catch { /* skip invalid */ }
    }
  }

  // Parse learnings
  const learningsContent = await readFileOrNull(join(dirPath, 'learnings.jsonl'));
  if (learningsContent !== null) {
    for (const line of parseLines(learningsContent)) {
      try {
        const obj = JSON.parse(line);
        stats.totalLearnings++;
        const confidence = obj.confidence as string;
        if (confidence in stats.learningsByConfidence) {
          stats.learningsByConfidence[confidence]++;
        }
      } catch { /* skip invalid */ }
    }
  }

  return stats;
}
