/**
 * Identity schema validation
 *
 * Validates that an identity JSON object has the required KERI fields.
 * Rejects identities with missing/wrong-typed fields and non-KERI AIDs
 * (e.g. SHA256-derived AIDs from openclaw-deploy).
 */

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
