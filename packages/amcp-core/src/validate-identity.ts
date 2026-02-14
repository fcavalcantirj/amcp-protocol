/**
 * Identity validation
 *
 * Schema validation: validates that an identity JSON object has the required KERI fields.
 * Full validation: schema + AID crypto (Ed25519 on-curve) + KEL integrity check.
 *
 * Rejects identities with missing/wrong-typed fields, non-KERI AIDs
 * (e.g. SHA256-derived AIDs from openclaw-deploy), and corrupt KELs.
 */

import { isValidAid } from './aid.js';
import { aidFromPublicKey } from './aid.js';
import { fromBase64url } from './crypto.js';
import { verifyKEL, type KeyEventLog } from './kel.js';

/** KERI derivation code for Ed25519 public keys */
const ED25519_PREFIX = 'B';

export interface IdentityValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate parsed identity JSON against the AMCP identity schema.
 *
 * Supports two formats:
 * - Flat format: { aid, publicKey, privateKey, created?, parentAID? }
 * - Old agent format: { agent: { aid, currentPublicKey, currentPrivateKey, createdAt? } }
 *
 * @param parsed - The parsed JSON object to validate
 * @returns Validation result with collected errors
 */
export function validateIdentitySchema(parsed: Record<string, unknown>): IdentityValidationResult {
  const errors: string[] = [];

  // Detect format: old (agent wrapper) vs flat
  if (parsed.agent && typeof parsed.agent === 'object') {
    return validateOldFormat(parsed.agent as Record<string, unknown>);
  }

  // Flat format validation
  validateRequiredString(parsed, 'aid', errors);
  validateRequiredString(parsed, 'publicKey', errors);
  validateRequiredString(parsed, 'privateKey', errors);

  // If aid is present and a string, validate KERI prefix
  if (typeof parsed.aid === 'string') {
    validateKeriPrefix(parsed.aid, errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate old-format identity (agent wrapper structure)
 */
function validateOldFormat(agent: Record<string, unknown>): IdentityValidationResult {
  const errors: string[] = [];

  validateRequiredString(agent, 'aid', errors);
  validateRequiredString(agent, 'currentPublicKey', errors);
  validateRequiredString(agent, 'currentPrivateKey', errors);

  if (typeof agent.aid === 'string') {
    validateKeriPrefix(agent.aid, errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check that a field exists and is a string
 */
function validateRequiredString(
  obj: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  if (typeof obj[field] !== 'string') {
    errors.push(`Missing required field: ${field} (expected string)`);
  }
}

/**
 * Validate that an AID starts with the KERI Ed25519 derivation prefix "B"
 */
function validateKeriPrefix(aid: string, errors: string[]): void {
  if (!aid.startsWith(ED25519_PREFIX)) {
    errors.push(
      `Invalid AID: expected KERI Ed25519 prefix '${ED25519_PREFIX}', got '${aid[0] ?? ''}'. ` +
      `AID must be a KERI self-certifying identifier (B + base64url public key)`
    );
  }
}

/**
 * Extract AID and publicKey from a parsed identity, supporting both formats.
 */
function extractIdentityFields(parsed: Record<string, unknown>): { aid?: string; publicKey?: string } {
  if (parsed.agent && typeof parsed.agent === 'object') {
    const agent = parsed.agent as Record<string, unknown>;
    return {
      aid: typeof agent.aid === 'string' ? agent.aid : undefined,
      publicKey: typeof agent.currentPublicKey === 'string' ? agent.currentPublicKey : undefined
    };
  }
  return {
    aid: typeof parsed.aid === 'string' ? parsed.aid : undefined,
    publicKey: typeof parsed.publicKey === 'string' ? parsed.publicKey : undefined
  };
}

/**
 * Full identity validation: schema check + AID crypto check + KEL integrity.
 *
 * Composes all validation layers:
 * 1. Schema validation (required fields, types, KERI prefix)
 * 2. AID cryptographic validation (Ed25519 on-curve check)
 * 3. AID-publicKey consistency check
 * 4. KEL integrity check (if KEL is present)
 *
 * @param parsed - The parsed identity JSON object
 * @returns Validation result with all collected errors
 */
export async function validateIdentityFull(parsed: Record<string, unknown>): Promise<IdentityValidationResult> {
  const errors: string[] = [];

  // Layer 1: Schema validation
  const schemaResult = validateIdentitySchema(parsed);
  errors.push(...schemaResult.errors);

  // Extract fields for deeper checks (works for both flat and old formats)
  const { aid, publicKey } = extractIdentityFields(parsed);

  // Layer 2: AID cryptographic validation (Ed25519 on-curve)
  if (aid && aid.startsWith(ED25519_PREFIX)) {
    if (!isValidAid(aid)) {
      errors.push('AID is not a valid Ed25519 public key (failed on-curve check)');
    }
  }

  // Layer 3: AID-publicKey consistency check
  if (aid && publicKey && aid.startsWith(ED25519_PREFIX)) {
    try {
      const pubKeyBytes = fromBase64url(publicKey);
      const derivedAid = aidFromPublicKey(pubKeyBytes);
      if (derivedAid !== aid) {
        errors.push(`AID does not match publicKey: expected ${derivedAid}, got ${aid}`);
      }
    } catch {
      // publicKey decode failed — already caught by schema or crypto checks
    }
  }

  // Layer 4: KEL integrity check (if present)
  const kel = parsed.kel as KeyEventLog | undefined;
  if (kel && typeof kel === 'object' && Array.isArray(kel.events)) {
    const kelValid = await verifyKEL(kel);
    if (!kelValid) {
      errors.push('KEL integrity check failed (invalid or corrupt Key Event Log)');
    }
    // Check KEL AID matches identity AID
    if (kelValid && aid && kel.events.length > 0 && kel.events[0].aid !== aid) {
      errors.push(`KEL AID mismatch: identity AID is ${aid}, but KEL inception AID is ${kel.events[0].aid}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
