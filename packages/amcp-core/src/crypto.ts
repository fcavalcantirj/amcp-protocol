/**
 * Cryptographic primitives using Ed25519
 * 
 * Uses @noble/ed25519 for a pure JS implementation that works everywhere.
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// Required for @noble/ed25519 v2
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

export interface Keypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * Generate a new Ed25519 keypair
 */
export async function generateKeypair(): Promise<Keypair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

/**
 * Generate keypair synchronously (for use in constructors)
 */
export function generateKeypairSync(): Keypair {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Sign a message with a private key
 */
export async function sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  return ed.signAsync(message, privateKey);
}

/**
 * Sign synchronously
 */
export function signSync(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed.sign(message, privateKey);
}

/**
 * Verify a signature
 */
export async function verify(
  signature: Uint8Array, 
  message: Uint8Array, 
  publicKey: Uint8Array
): Promise<boolean> {
  return ed.verifyAsync(signature, message, publicKey);
}

/**
 * Verify synchronously
 */
export function verifySync(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): boolean {
  return ed.verify(signature, message, publicKey);
}

/**
 * Hash data using SHA-512 (used for pre-rotation commitment)
 */
export function hash(data: Uint8Array): Uint8Array {
  return sha512(data);
}

/**
 * Convert bytes to base64url (URL-safe, no padding)
 */
export function toBase64url(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert base64url to bytes
 */
export function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}
