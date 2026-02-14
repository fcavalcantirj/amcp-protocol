/**
 * File-based identity validation
 *
 * Reads an identity file from disk, parses JSON, and runs the full
 * validation pipeline (schema + AID crypto + KEL integrity).
 *
 * Designed for reuse by any consumer: CLI tools, proactive-amcp, openclaw-deploy.
 */

import { readFile } from 'node:fs/promises';
import { validateIdentityFull, type IdentityValidationResult } from './validate-identity.js';

/**
 * Validate an identity file at the given path.
 *
 * Composes all checks:
 * 1. File exists and is readable
 * 2. Valid JSON
 * 3. JSON is an object (not array, null, etc.)
 * 4. Schema validation (required fields, types, KERI prefix)
 * 5. AID cryptographic validation (Ed25519 on-curve)
 * 6. AID-publicKey consistency
 * 7. KEL integrity (if present)
 *
 * @param path - Absolute or relative path to the identity JSON file
 * @returns Validation result: { valid: boolean, errors: string[] }
 */
export async function validateIdentityFile(path: string): Promise<IdentityValidationResult> {
  // Step 1: Read file
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [`Failed to read identity file: ${message}`] };
  }

  // Step 2: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [`Failed to parse JSON: ${message}`] };
  }

  // Step 3: Must be a non-null object
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Identity file must contain a JSON object'] };
  }

  // Steps 4-7: Full identity validation (schema + AID crypto + KEL)
  return validateIdentityFull(parsed as Record<string, unknown>);
}
