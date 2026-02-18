/**
 * Learning checkpoint integration tests (prd-v1 task 28)
 *
 * Verifies learning data roundtrip through checkpoint/restore:
 * serialize Problem/Learning arrays into checkpoint metadata,
 * deserialize back, and verify data integrity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAgent } from '@amcp/core';
import { createCheckpoint, type CheckpointMetadata } from '../src/checkpoint.js';
import { ProblemStatus, LearningConfidence, type Problem, type Learning } from '../src/learning-types.js';
import { computeLearningStats, type LearningStats } from '../src/validate-learning.js';

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `amcp-learn-ckpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

/** Serialize Date fields to ISO strings for JSON roundtrip */
function serializeProblem(p: Problem): Record<string, unknown> {
  return {
    ...p,
    created: p.created.toISOString(),
    updated: p.updated.toISOString(),
    resolved: p.resolved?.toISOString(),
    retryAfter: p.retryAfter?.toISOString(),
  };
}

function serializeLearning(l: Learning): Record<string, unknown> {
  return {
    ...l,
    created: l.created.toISOString(),
    verifiedAt: l.verifiedAt?.toISOString(),
  };
}

const baseMeta: CheckpointMetadata = {
  platform: 'test',
  version: '1.0.0',
  sessionCount: 1,
};

describe('learning checkpoint integration', () => {
  it('checkpoint with unresolvedProblems includes serialized problems in metadata', async () => {
    const agent = await createAgent({ name: 'LearnAgent' });
    const problems: Problem[] = [
      {
        id: 'prob_aaaaaaaa', description: 'Parser bug', status: ProblemStatus.Open,
        attempts: 2, created: new Date('2026-02-18'), updated: new Date('2026-02-18'),
        humanVerified: false, source: 'self-detect', tags: ['parsing'],
      },
      {
        id: 'prob_bbbbbbbb', description: 'Memory leak', status: ProblemStatus.Stuck,
        attempts: 5, blocker: 'No heap profiler', created: new Date('2026-02-17'),
        updated: new Date('2026-02-18'), humanVerified: false, source: 'command', tags: [],
      },
    ];

    const metadata: CheckpointMetadata = {
      ...baseMeta,
      custom: { unresolvedProblems: problems.map(serializeProblem) },
    };
    const result = await createCheckpoint(agent, { data: 'test' }, null, metadata);

    // Roundtrip through JSON
    const roundtripped = JSON.parse(JSON.stringify(result.checkpoint));
    const restored = roundtripped.metadata.custom.unresolvedProblems;
    expect(restored).toHaveLength(2);
    expect(restored[0].id).toBe('prob_aaaaaaaa');
    expect(restored[0].status).toBe('open');
    expect(restored[1].blocker).toBe('No heap profiler');
  });

  it('checkpoint with recentLearnings includes serialized learnings in metadata', async () => {
    const agent = await createAgent({ name: 'LearnAgent' });
    const learnings: Learning[] = [
      {
        id: 'learn_cccccccc', insight: 'Cache repeated lookups',
        confidence: LearningConfidence.Verified, humanVerified: true,
        verifiedAt: new Date('2026-02-18'), tags: ['performance'], created: new Date('2026-02-18'),
      },
    ];

    const metadata: CheckpointMetadata = {
      ...baseMeta,
      custom: { recentLearnings: learnings.map(serializeLearning) },
    };
    const result = await createCheckpoint(agent, { data: 'test' }, null, metadata);

    const roundtripped = JSON.parse(JSON.stringify(result.checkpoint));
    const restored = roundtripped.metadata.custom.recentLearnings;
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('learn_cccccccc');
    expect(restored[0].confidence).toBe('verified');
    expect(restored[0].verifiedAt).toBeTruthy();
  });

  it('checkpoint with learningStats preserves stats through serialize/deserialize', async () => {
    const agent = await createAgent({ name: 'LearnAgent' });
    const stats: LearningStats = {
      totalProblems: 5, totalSolved: 2, solvedPostRecovery: 1, totalLearnings: 3,
      problemsByStatus: { open: 1, stuck: 1, solved: 2, abandoned: 1 },
      learningsByConfidence: { tentative: 2, verified: 1 },
    };

    const metadata: CheckpointMetadata = {
      ...baseMeta,
      custom: { learningStats: stats },
    };
    const result = await createCheckpoint(agent, { data: 'test' }, null, metadata);

    const roundtripped = JSON.parse(JSON.stringify(result.checkpoint));
    const restored = roundtripped.metadata.custom.learningStats as LearningStats;
    expect(restored.totalProblems).toBe(5);
    expect(restored.totalSolved).toBe(2);
    expect(restored.solvedPostRecovery).toBe(1);
    expect(restored.totalLearnings).toBe(3);
    expect(restored.problemsByStatus.open).toBe(1);
    expect(restored.learningsByConfidence.verified).toBe(1);
  });

  it('checkpoint without learning fields is backward compatible', async () => {
    const agent = await createAgent({ name: 'LearnAgent' });
    const result = await createCheckpoint(agent, { data: 'test' }, null, baseMeta);

    expect(result.checkpoint).toBeDefined();
    expect(result.checkpoint.metadata.custom).toBeUndefined();
    expect(result.checkpoint.signature).toBeTruthy();
  });

  it('restoring checkpoint recreates learning directory correctly', async () => {
    const agent = await createAgent({ name: 'LearnAgent' });

    // Create learning data on disk
    const learningDir = join(testDir, 'learning');
    await mkdir(learningDir, { recursive: true });

    const problemLine = '{"id":"prob_aaaaaaaa","description":"Bug","status":"open","attempts":1,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"self-detect","tags":[]}';
    const learningLine = '{"id":"learn_cccccccc","insight":"Insight","confidence":"tentative","humanVerified":false,"tags":[],"created":"2026-02-18T00:00:00Z"}';

    await writeFile(join(learningDir, 'problems.jsonl'), problemLine);
    await writeFile(join(learningDir, 'learnings.jsonl'), learningLine);

    // Capture learning data in checkpoint metadata
    const statsBeforeCheckpoint = await computeLearningStats(learningDir);
    const metadata: CheckpointMetadata = {
      ...baseMeta,
      custom: {
        learningStats: statsBeforeCheckpoint,
        problemsJsonl: problemLine,
        learningsJsonl: learningLine,
      },
    };
    const result = await createCheckpoint(agent, { data: 'memories' }, null, metadata);

    // Simulate restore: read from checkpoint, write to new directory
    const roundtripped = JSON.parse(JSON.stringify(result.checkpoint));
    const restoredDir = join(testDir, 'restored-learning');
    await mkdir(restoredDir, { recursive: true });
    await writeFile(join(restoredDir, 'problems.jsonl'), roundtripped.metadata.custom.problemsJsonl);
    await writeFile(join(restoredDir, 'learnings.jsonl'), roundtripped.metadata.custom.learningsJsonl);

    // Verify restored content matches original
    const restoredProblems = await readFile(join(restoredDir, 'problems.jsonl'), 'utf-8');
    const restoredLearnings = await readFile(join(restoredDir, 'learnings.jsonl'), 'utf-8');
    expect(restoredProblems).toBe(problemLine);
    expect(restoredLearnings).toBe(learningLine);

    // Verify stats match
    const statsAfterRestore = await computeLearningStats(restoredDir);
    expect(statsAfterRestore.totalProblems).toBe(statsBeforeCheckpoint.totalProblems);
    expect(statsAfterRestore.totalLearnings).toBe(statsBeforeCheckpoint.totalLearnings);
  });

  it('solvedPostRecovery increments after solve-post-restore', async () => {
    const agent = await createAgent({ name: 'LearnAgent' });

    // Step 1: Create checkpoint with unresolved problem
    const learningDir = join(testDir, 'learning');
    await mkdir(learningDir, { recursive: true });

    const problemBefore = '{"id":"prob_aaaaaaaa","description":"Bug","status":"open","attempts":1,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T00:00:00Z","humanVerified":false,"source":"self-detect","tags":[]}';
    await writeFile(join(learningDir, 'problems.jsonl'), problemBefore);

    const statsBefore = await computeLearningStats(learningDir);
    expect(statsBefore.totalSolved).toBe(0);

    const metadata1: CheckpointMetadata = {
      ...baseMeta,
      custom: {
        learningStats: statsBefore,
        problemsJsonl: problemBefore,
      },
    };
    const checkpoint1 = await createCheckpoint(agent, { step: 1 }, null, metadata1);

    // Step 2: Simulate restore + solve
    const restoredDir = join(testDir, 'restored');
    await mkdir(restoredDir, { recursive: true });
    const roundtripped = JSON.parse(JSON.stringify(checkpoint1.checkpoint));
    const problemAfter = '{"id":"prob_aaaaaaaa","description":"Bug","status":"solved","attempts":2,"created":"2026-02-18T00:00:00Z","updated":"2026-02-18T01:00:00Z","humanVerified":false,"source":"self-detect","tags":[],"resolved":"2026-02-18T01:00:00Z"}';
    await writeFile(join(restoredDir, 'problems.jsonl'), problemAfter);

    const statsAfter = await computeLearningStats(restoredDir);
    expect(statsAfter.totalSolved).toBe(1);

    // Calculate solvedPostRecovery: solved now minus solved before checkpoint
    const previousSolved = (roundtripped.metadata.custom.learningStats as LearningStats).totalSolved;
    const solvedPostRecovery = statsAfter.totalSolved - previousSolved;
    expect(solvedPostRecovery).toBe(1);

    // Step 3: Create second checkpoint with updated metric
    const metadata2: CheckpointMetadata = {
      ...baseMeta,
      custom: {
        learningStats: { ...statsAfter, solvedPostRecovery },
        problemsJsonl: problemAfter,
      },
    };
    const checkpoint2 = await createCheckpoint(agent, { step: 2 }, checkpoint1.contentCid, metadata2);

    const final = JSON.parse(JSON.stringify(checkpoint2.checkpoint));
    expect(final.metadata.custom.learningStats.solvedPostRecovery).toBe(1);
    expect(final.metadata.custom.learningStats.totalSolved).toBe(1);
  });
});
