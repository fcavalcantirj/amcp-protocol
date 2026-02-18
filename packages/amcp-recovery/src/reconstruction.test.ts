/**
 * Reconstruction sequence tests
 *
 * Verifies the canonical memory loading order API, including
 * ReconstructionStep enum, loadMemorySequence(), and error handling
 * for missing required vs optional files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ReconstructionStep,
  loadMemorySequence,
  type ReconstructionProgress,
} from './reconstruction.js';

let testDir: string;
let checkpointDir: string;
let outputDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `amcp-recon-test-${Date.now()}`);
  checkpointDir = join(testDir, 'checkpoint');
  outputDir = join(testDir, 'output');
  await mkdir(checkpointDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('ReconstructionStep enum', () => {
  it('has canonical step values 0-7', () => {
    expect(ReconstructionStep.SOUL).toBe(0);
    expect(ReconstructionStep.USER).toBe(1);
    expect(ReconstructionStep.ONTOLOGY_SCHEMA).toBe(2);
    expect(ReconstructionStep.ONTOLOGY_GRAPH).toBe(3);
    expect(ReconstructionStep.CURATED_MEMORY).toBe(4);
    expect(ReconstructionStep.EPHEMERAL_NOTES).toBe(5);
    expect(ReconstructionStep.TOOLS).toBe(6);
    expect(ReconstructionStep.SEAM).toBe(7);
  });

  it('has exactly 8 steps', () => {
    // Numeric enums produce both forward and reverse mappings, so filter to numbers only
    const numericValues = Object.values(ReconstructionStep).filter(
      v => typeof v === 'number'
    );
    expect(numericValues).toHaveLength(8);
  });
});

describe('loadMemorySequence', () => {
  it('follows canonical order with all files present', async () => {
    // Create all required and optional files
    await writeFile(join(checkpointDir, 'SOUL.md'), '# Soul\nI am a test agent');
    await writeFile(join(checkpointDir, 'USER.md'), '# User\nPreferences here');
    await writeFile(join(checkpointDir, 'ontology-schema.json'), '{"version":"1.0"}');
    await writeFile(join(checkpointDir, 'graph.jsonl'), '{"type":"entity","id":"e1"}');
    await writeFile(join(checkpointDir, 'MEMORY.md'), '# Memory\nCurated notes');
    await writeFile(join(checkpointDir, 'notes'), ''); // will be a directory
    await rm(join(checkpointDir, 'notes')); // remove file
    await mkdir(join(checkpointDir, 'notes'), { recursive: true });
    await writeFile(join(checkpointDir, 'notes', '2026-02-18.md'), 'Daily note');
    await writeFile(join(checkpointDir, 'TOOLS.md'), '# Tools\nAvailable tools');

    const result = await loadMemorySequence(checkpointDir, outputDir);

    expect(result.seam_crossed).toBe(true);
    expect(result.steps_completed).toContain(ReconstructionStep.SOUL);
    expect(result.steps_completed).toContain(ReconstructionStep.USER);
    expect(result.steps_completed).toContain(ReconstructionStep.CURATED_MEMORY);
    expect(result.steps_completed).toContain(ReconstructionStep.TOOLS);
    expect(result.steps_completed).toContain(ReconstructionStep.SEAM);
    expect(result.current_step).toBe(ReconstructionStep.SEAM);
    expect(result.errors).toHaveLength(0);
  });

  it('fails immediately when SOUL.md is missing (identity required)', async () => {
    // No SOUL.md — identity is required
    await writeFile(join(checkpointDir, 'USER.md'), '# User');
    await writeFile(join(checkpointDir, 'MEMORY.md'), '# Memory');

    const result = await loadMemorySequence(checkpointDir, outputDir);

    expect(result.seam_crossed).toBe(false);
    expect(result.current_step).toBe(ReconstructionStep.SOUL);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('SOUL.md'))).toBe(true);
  });

  it('skips ontology steps when ontology files are missing (optional)', async () => {
    await writeFile(join(checkpointDir, 'SOUL.md'), '# Soul');
    await writeFile(join(checkpointDir, 'USER.md'), '# User');
    await writeFile(join(checkpointDir, 'MEMORY.md'), '# Memory');
    await writeFile(join(checkpointDir, 'TOOLS.md'), '# Tools');
    // No ontology-schema.json or graph.jsonl

    const result = await loadMemorySequence(checkpointDir, outputDir);

    expect(result.seam_crossed).toBe(true);
    expect(result.steps_completed).not.toContain(ReconstructionStep.ONTOLOGY_SCHEMA);
    expect(result.steps_completed).not.toContain(ReconstructionStep.ONTOLOGY_GRAPH);
    expect(result.errors).toHaveLength(0);
  });

  it('seam_crossed is only true after all steps complete', async () => {
    // Only SOUL.md present — stops after SOUL
    await writeFile(join(checkpointDir, 'SOUL.md'), '# Soul');

    const result = await loadMemorySequence(checkpointDir, outputDir);

    // SOUL loaded, but rest are missing optional files — should still complete
    expect(result.seam_crossed).toBe(true);
    expect(result.steps_completed).toContain(ReconstructionStep.SOUL);
    expect(result.steps_completed).toContain(ReconstructionStep.SEAM);
  });

  it('missing optional files do not block progression', async () => {
    // Only SOUL.md — everything else is optional
    await writeFile(join(checkpointDir, 'SOUL.md'), '# Soul\nMinimal agent');

    const result = await loadMemorySequence(checkpointDir, outputDir);

    expect(result.seam_crossed).toBe(true);
    expect(result.errors).toHaveLength(0);
    // SOUL should be completed even if others are skipped
    expect(result.steps_completed).toContain(ReconstructionStep.SOUL);
  });

  it('copies files to output directory', async () => {
    await writeFile(join(checkpointDir, 'SOUL.md'), '# Soul content');
    await writeFile(join(checkpointDir, 'MEMORY.md'), '# Memory content');

    await loadMemorySequence(checkpointDir, outputDir);

    // Verify files were copied to output
    const { readFile } = await import('node:fs/promises');
    const soulContent = await readFile(join(outputDir, 'SOUL.md'), 'utf-8');
    expect(soulContent).toBe('# Soul content');
    const memoryContent = await readFile(join(outputDir, 'MEMORY.md'), 'utf-8');
    expect(memoryContent).toBe('# Memory content');
  });

  it('returns correct progress structure', async () => {
    await writeFile(join(checkpointDir, 'SOUL.md'), '# Soul');

    const result: ReconstructionProgress = await loadMemorySequence(checkpointDir, outputDir);

    expect(typeof result.current_step).toBe('number');
    expect(Array.isArray(result.steps_completed)).toBe(true);
    expect(typeof result.seam_crossed).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
