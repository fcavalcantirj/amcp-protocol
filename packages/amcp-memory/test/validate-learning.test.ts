/**
 * Learning validation tests (prd-v1 task 27)
 *
 * Unit tests for validateLearningData() — JSONL parsing and cross-reference checks
 * for Problem and Learning files in the memory/learning/ directory.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateLearningData, computeLearningStats } from '../src/validate-learning.js';

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `amcp-learning-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('validateLearningData', () => {
  it('valid directory with problems.jsonl, learnings.jsonl, stats.json passes validation', async () => {
    await writeFile(join(testDir, 'problems.jsonl'), [
      '{"id":"prob_aaaaaaaa","description":"Bug in parser","status":"open","attempts":1,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"self-detect","tags":[]}',
      '{"id":"prob_bbbbbbbb","description":"Slow test","status":"solved","attempts":2,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"command","tags":[],"resolved":"2026-02-18T01:00:00Z"}',
    ].join('\n'));

    await writeFile(join(testDir, 'learnings.jsonl'), [
      '{"id":"learn_cccccccc","insight":"Use caching for repeated lookups","confidence":"tentative","humanVerified":false,"tags":["performance"],"created":"2026-02-18T00:00:00Z"}',
    ].join('\n'));

    await writeFile(join(testDir, 'stats.json'), JSON.stringify({
      totalProblems: 2,
      totalSolved: 1,
      solvedPostRecovery: 0,
      totalLearnings: 1,
    }));

    const result = await validateLearningData(testDir);

    expect(result.valid).toBe(true);
    expect(result.problemCount).toBe(2);
    expect(result.learningCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('invalid JSON on line 3 of problems.jsonl fails with parse error', async () => {
    await writeFile(join(testDir, 'problems.jsonl'), [
      '{"id":"prob_aaaaaaaa","description":"Bug 1","status":"open","attempts":1,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"self-detect","tags":[]}',
      '{"id":"prob_bbbbbbbb","description":"Bug 2","status":"open","attempts":0,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"command","tags":[]}',
      'this is not valid json',
    ].join('\n'));
    await writeFile(join(testDir, 'learnings.jsonl'), '');
    await writeFile(join(testDir, 'stats.json'), JSON.stringify({
      totalProblems: 2, totalSolved: 0, solvedPostRecovery: 0, totalLearnings: 0,
    }));

    const result = await validateLearningData(testDir);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('problems.jsonl') && e.includes('line 3'))).toBe(true);
  });

  it('learning referencing non-existent Problem ID fails with cross-reference error', async () => {
    await writeFile(join(testDir, 'problems.jsonl'), [
      '{"id":"prob_aaaaaaaa","description":"Bug","status":"open","attempts":1,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"self-detect","tags":[]}',
    ].join('\n'));

    await writeFile(join(testDir, 'learnings.jsonl'), [
      '{"id":"learn_cccccccc","insight":"Insight","sourceProblem":"prob_notfound","confidence":"tentative","humanVerified":false,"tags":[],"created":"2026-02-18T00:00:00Z"}',
    ].join('\n'));

    await writeFile(join(testDir, 'stats.json'), JSON.stringify({
      totalProblems: 1, totalSolved: 0, solvedPostRecovery: 0, totalLearnings: 1,
    }));

    const result = await validateLearningData(testDir);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('prob_notfound') && e.includes('not found'))).toBe(true);
  });

  it('stats.json totalProblems mismatch fails with consistency error', async () => {
    await writeFile(join(testDir, 'problems.jsonl'), [
      '{"id":"prob_aaaaaaaa","description":"Bug","status":"open","attempts":1,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"self-detect","tags":[]}',
    ].join('\n'));
    await writeFile(join(testDir, 'learnings.jsonl'), '');
    await writeFile(join(testDir, 'stats.json'), JSON.stringify({
      totalProblems: 5, // wrong — only 1 problem
      totalSolved: 0,
      solvedPostRecovery: 0,
      totalLearnings: 0,
    }));

    const result = await validateLearningData(testDir);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('totalProblems'))).toBe(true);
  });

  it('empty directory returns valid=true with zero counts', async () => {
    const result = await validateLearningData(testDir);

    expect(result.valid).toBe(true);
    expect(result.problemCount).toBe(0);
    expect(result.learningCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('missing problems.jsonl but learnings.jsonl exists returns partial validation', async () => {
    // No problems.jsonl
    await writeFile(join(testDir, 'learnings.jsonl'), [
      '{"id":"learn_cccccccc","insight":"Insight","confidence":"verified","humanVerified":true,"tags":["testing"],"created":"2026-02-18T00:00:00Z"}',
    ].join('\n'));
    // No stats.json — should still work gracefully

    const result = await validateLearningData(testDir);

    expect(result.valid).toBe(true);
    expect(result.problemCount).toBe(0);
    expect(result.learningCount).toBe(1);
  });
});

describe('computeLearningStats', () => {
  it('matches expected counts for test fixture', async () => {
    await writeFile(join(testDir, 'problems.jsonl'), [
      '{"id":"prob_aaaaaaaa","description":"Bug 1","status":"open","attempts":1,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"self-detect","tags":[]}',
      '{"id":"prob_bbbbbbbb","description":"Bug 2","status":"solved","attempts":2,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"command","tags":[],"resolved":"2026-02-18T01:00:00Z"}',
      '{"id":"prob_cccccccc","description":"Bug 3","status":"stuck","attempts":5,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"skill","tags":[]}',
      '{"id":"prob_dddddddd","description":"Bug 4","status":"abandoned","attempts":0,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"self-detect","tags":[]}',
    ].join('\n'));

    await writeFile(join(testDir, 'learnings.jsonl'), [
      '{"id":"learn_eeeeeeee","insight":"Insight 1","confidence":"tentative","humanVerified":false,"tags":[],"created":"2026-02-18T00:00:00Z"}',
      '{"id":"learn_ffffffff","insight":"Insight 2","confidence":"verified","humanVerified":true,"tags":[],"created":"2026-02-18T00:00:00Z"}',
      '{"id":"learn_11111111","insight":"Insight 3","confidence":"tentative","humanVerified":false,"tags":[],"created":"2026-02-18T00:00:00Z"}',
    ].join('\n'));

    const stats = await computeLearningStats(testDir);

    expect(stats.totalProblems).toBe(4);
    expect(stats.totalSolved).toBe(1);
    expect(stats.totalLearnings).toBe(3);
    expect(stats.problemsByStatus.open).toBe(1);
    expect(stats.problemsByStatus.stuck).toBe(1);
    expect(stats.problemsByStatus.solved).toBe(1);
    expect(stats.problemsByStatus.abandoned).toBe(1);
    expect(stats.learningsByConfidence.tentative).toBe(2);
    expect(stats.learningsByConfidence.verified).toBe(1);
  });

  it('returns zeros for empty directory', async () => {
    const stats = await computeLearningStats(testDir);

    expect(stats.totalProblems).toBe(0);
    expect(stats.totalSolved).toBe(0);
    expect(stats.totalLearnings).toBe(0);
    expect(stats.solvedPostRecovery).toBe(0);
  });
});
