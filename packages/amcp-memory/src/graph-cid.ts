/**
 * Graph CID computation for JSONL ontology files
 *
 * Computes a CIDv1 (raw codec, SHA-256) for JSONL graph files.
 * Content-addressed: same file content always produces the same CID.
 */

import { readFile } from 'node:fs/promises';
import { computeCID } from './cid.js';

/**
 * Compute CIDv1 of a JSONL graph file
 *
 * Reads the file content and computes a content-addressed CID.
 * The CID is based on the raw file content, not the parsed JSON.
 *
 * @param filePath - Absolute path to a JSONL file
 * @returns CIDv1 string (base32), or null if file doesn't exist
 */
export async function computeGraphCID(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return computeCID(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
