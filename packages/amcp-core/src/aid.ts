/**
 * Autonomic Identifier (AID) utilities
 * 
 * KERI-style self-certifying identifiers derived from public keys.
 * Format: "B" prefix + base64url(publicKey)
 * 
 * The "B" prefix indicates Ed25519 (following KERI's derivation codes).
 */

import { toBase64url, fromBase64url } from './crypto.js';
import { Point } from '@noble/ed25519';

// KERI derivation code for Ed25519 public keys
const ED25519_PREFIX = 'B';

/**
 * Derive an AID from a public key
 * 
 * @param publicKey - Ed25519 public key (32 bytes)
 * @returns Self-certifying identifier string
 */
export function aidFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: expected 32, got ${publicKey.length}`);
  }
  return ED25519_PREFIX + toBase64url(publicKey);
}

/**
 * Extract the public key from an AID
 * 
 * @param aid - Self-certifying identifier
 * @returns Ed25519 public key
 */
export function publicKeyFromAid(aid: string): Uint8Array {
  if (!aid.startsWith(ED25519_PREFIX)) {
    throw new Error(`Invalid AID prefix: expected '${ED25519_PREFIX}', got '${aid[0]}'`);
  }
  const publicKey = fromBase64url(aid.slice(1));
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length in AID: expected 32, got ${publicKey.length}`);
  }
  return publicKey;
}

/**
 * Validate an AID — checks prefix, length, AND Ed25519 on-curve validity.
 *
 * Rejects AIDs where the decoded bytes are not a valid Ed25519 point
 * (e.g. sha256 hash output passes length check but fails curve check).
 */
export function isValidAid(aid: string): boolean {
  try {
    const publicKey = publicKeyFromAid(aid);
    // On-curve validation: throws if bytes are not a valid Ed25519 point
    const point = Point.fromBytes(publicKey, false);
    // Reject small-order / torsion points (not valid public keys)
    if (point.clearCofactor().equals(Point.ZERO)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
