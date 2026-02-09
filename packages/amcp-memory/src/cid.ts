/**
 * Content Identifier (CID) utilities
 * 
 * Simplified IPLD-compatible content addressing using SHA-256.
 */

import { sha256 } from '@noble/hashes/sha256';
import { base32 } from 'multiformats/bases/base32';

/** Content Identifier (IPLD-style) */
export type CID = string;

// CIDv1 components
const VERSION = 0x01;
const RAW_CODEC = 0x55;  // raw binary
const DAG_CBOR_CODEC = 0x71;  // dag-cbor
const SHA256_CODE = 0x12;
const SHA256_LENGTH = 32;

/**
 * Compute a CID for arbitrary content
 * 
 * @param content - Content to hash (string or bytes)
 * @returns CIDv1 string (base32)
 */
export function computeCID(content: string | Uint8Array): CID {
  const bytes = typeof content === 'string' 
    ? new TextEncoder().encode(content)
    : content;
  
  const hash = sha256(bytes);
  
  // Build CIDv1: version + codec + multihash
  const multihash = new Uint8Array([SHA256_CODE, SHA256_LENGTH, ...hash]);
  const cid = new Uint8Array([VERSION, RAW_CODEC, ...multihash]);
  
  return 'b' + base32.encode(cid).slice(1); // lowercase base32
}

/**
 * Compute CID for a JSON object (deterministic serialization)
 */
export function computeJSONCID(obj: unknown): CID {
  const canonical = JSON.stringify(obj, Object.keys(obj as object).sort());
  return computeCID(canonical);
}

/**
 * Verify that content matches a CID
 */
export function verifyCID(cid: CID, content: string | Uint8Array): boolean {
  return computeCID(content) === cid;
}
