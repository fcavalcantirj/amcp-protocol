/**
 * Reconstruction sequence utilities
 *
 * Defines the canonical memory loading order for agent reconstruction.
 * Each step validates before proceeding; missing required files (SOUL.md)
 * halt reconstruction, while missing optional files are skipped.
 */

import { readFile, writeFile, readdir, mkdir, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';

/** Canonical reconstruction step order (0-7) */
export enum ReconstructionStep {
  /** Load SOUL.md — agent identity (required) */
  SOUL = 0,
  /** Load USER.md — user preferences */
  USER = 1,
  /** Load ontology schema (if exists) */
  ONTOLOGY_SCHEMA = 2,
  /** Validate and load graph.jsonl (if exists) */
  ONTOLOGY_GRAPH = 3,
  /** Load MEMORY.md — curated memory */
  CURATED_MEMORY = 4,
  /** Load daily/ephemeral notes */
  EPHEMERAL_NOTES = 5,
  /** Load TOOLS.md — available tools */
  TOOLS = 6,
  /** Identity has fully coalesced */
  SEAM = 7,
}

/** Progress tracker for the reconstruction sequence */
export interface ReconstructionProgress {
  /** Current (or last attempted) step */
  current_step: ReconstructionStep;
  /** Steps that completed successfully */
  steps_completed: ReconstructionStep[];
  /** True only after all steps complete */
  seam_crossed: boolean;
  /** Errors encountered during reconstruction */
  errors: string[];
}

/** Check if a file exists */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Copy a single file from source to destination, creating parent dirs */
async function copyFileToOutput(srcPath: string, destPath: string): Promise<void> {
  const content = await readFile(srcPath);
  await writeFile(destPath, content);
}

/** Copy a directory's contents recursively to destination */
async function copyDirToOutput(srcDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirToOutput(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Load memory in canonical reconstruction order
 *
 * @param checkpointPath - Directory containing checkpoint files
 * @param outputDir - Directory to write reconstructed files to
 * @returns Reconstruction progress with completed steps and errors
 */
export async function loadMemorySequence(
  checkpointPath: string,
  outputDir: string,
): Promise<ReconstructionProgress> {
  const progress: ReconstructionProgress = {
    current_step: ReconstructionStep.SOUL,
    steps_completed: [],
    seam_crossed: false,
    errors: [],
  };

  await mkdir(outputDir, { recursive: true });

  // Step 0: SOUL.md (REQUIRED — identity)
  progress.current_step = ReconstructionStep.SOUL;
  const soulPath = join(checkpointPath, 'SOUL.md');
  if (await fileExists(soulPath)) {
    await copyFileToOutput(soulPath, join(outputDir, 'SOUL.md'));
    progress.steps_completed.push(ReconstructionStep.SOUL);
  } else {
    progress.errors.push('Missing required file: SOUL.md (agent identity)');
    return progress;
  }

  // Step 1: USER.md (optional)
  progress.current_step = ReconstructionStep.USER;
  const userPath = join(checkpointPath, 'USER.md');
  if (await fileExists(userPath)) {
    await copyFileToOutput(userPath, join(outputDir, 'USER.md'));
    progress.steps_completed.push(ReconstructionStep.USER);
  }

  // Step 2: Ontology schema (optional)
  progress.current_step = ReconstructionStep.ONTOLOGY_SCHEMA;
  const schemaPath = join(checkpointPath, 'ontology-schema.json');
  if (await fileExists(schemaPath)) {
    await copyFileToOutput(schemaPath, join(outputDir, 'ontology-schema.json'));
    progress.steps_completed.push(ReconstructionStep.ONTOLOGY_SCHEMA);
  }

  // Step 3: Ontology graph (optional, only if schema exists)
  progress.current_step = ReconstructionStep.ONTOLOGY_GRAPH;
  const graphPath = join(checkpointPath, 'graph.jsonl');
  if (await fileExists(graphPath)) {
    await copyFileToOutput(graphPath, join(outputDir, 'graph.jsonl'));
    progress.steps_completed.push(ReconstructionStep.ONTOLOGY_GRAPH);
  }

  // Step 4: MEMORY.md — curated memory (optional)
  progress.current_step = ReconstructionStep.CURATED_MEMORY;
  const memoryPath = join(checkpointPath, 'MEMORY.md');
  if (await fileExists(memoryPath)) {
    await copyFileToOutput(memoryPath, join(outputDir, 'MEMORY.md'));
    progress.steps_completed.push(ReconstructionStep.CURATED_MEMORY);
  }

  // Step 5: Ephemeral notes directory (optional)
  progress.current_step = ReconstructionStep.EPHEMERAL_NOTES;
  const notesPath = join(checkpointPath, 'notes');
  if (await fileExists(notesPath)) {
    try {
      await copyDirToOutput(notesPath, join(outputDir, 'notes'));
      progress.steps_completed.push(ReconstructionStep.EPHEMERAL_NOTES);
    } catch {
      // notes exists but isn't a directory — skip
    }
  }

  // Step 6: TOOLS.md (optional)
  progress.current_step = ReconstructionStep.TOOLS;
  const toolsPath = join(checkpointPath, 'TOOLS.md');
  if (await fileExists(toolsPath)) {
    await copyFileToOutput(toolsPath, join(outputDir, 'TOOLS.md'));
    progress.steps_completed.push(ReconstructionStep.TOOLS);
  }

  // Step 7: SEAM — identity has fully coalesced
  progress.current_step = ReconstructionStep.SEAM;
  progress.steps_completed.push(ReconstructionStep.SEAM);
  progress.seam_crossed = true;

  return progress;
}
