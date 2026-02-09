/**
 * Encrypted secrets blob using X25519 + ChaCha20-Poly1305
 * 
 * Implements ECIES-like encryption:
 * - X25519 for key exchange (RFC 7748)
 * - ChaCha20-Poly1305 for AEAD encryption (RFC 8439)
 * - HKDF for key derivation
 * 
 * Key Separation (Rogaway 2004): Ed25519 signing keys are converted to
 * X25519 encryption keys, maintaining proper key separation.
 * 
 * @module
 */

import { x25519, edwardsToMontgomeryPub, edwardsToMontgomeryPriv } from '@noble/curves/ed25519';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/ciphers/webcrypto';

/**
 * Encrypted blob format for secrets
 */
export interface EncryptedBlob {
  /** 12-byte nonce for ChaCha20-Poly1305 */
  nonce: Uint8Array;
  /** Encrypted data with authentication tag */
  ciphertext: Uint8Array;
  /** Ephemeral X25519 public key for ECDH */
  ephemeralPub: Uint8Array;
}

/**
 * X25519 keypair (converted from Ed25519)
 */
export interface X25519Keypair {
  x25519Pub: Uint8Array;
  x25519Priv: Uint8Array;
}

/** HKDF info string for key derivation */
const HKDF_INFO = new TextEncoder().encode('amcp-secrets-v1');

/** Nonce size for ChaCha20-Poly1305 (12 bytes = 96 bits) */
const NONCE_SIZE = 12;

/** Key size for ChaCha20-Poly1305 (32 bytes = 256 bits) */
const KEY_SIZE = 32;

/**
 * Convert Ed25519 keys to X25519 keys for encryption
 * 
 * This implements key separation (Rogaway 2004) - signing keys and
 * encryption keys should be separate. Ed25519 operates on the twisted
 * Edwards curve, while X25519 operates on the Montgomery curve.
 * Both are birationally equivalent to Curve25519.
 * 
 * @param edPub - Ed25519 public key (32 bytes)
 * @param edPriv - Ed25519 private key (32 bytes)
 * @returns X25519 keypair
 */
export function ed25519ToX25519(edPub: Uint8Array, edPriv: Uint8Array): X25519Keypair {
  if (edPub.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: expected 32, got ${edPub.length}`);
  }
  if (edPriv.length !== 32) {
    throw new Error(`Invalid Ed25519 private key length: expected 32, got ${edPriv.length}`);
  }
  
  const x25519Pub = edwardsToMontgomeryPub(edPub);
  const x25519Priv = edwardsToMontgomeryPriv(edPriv);
  
  return { x25519Pub, x25519Priv };
}

/**
 * Convert Ed25519 public key to X25519 public key (for encryption to recipient)
 * 
 * @param edPub - Ed25519 public key (32 bytes)
 * @returns X25519 public key
 */
export function ed25519PubToX25519(edPub: Uint8Array): Uint8Array {
  if (edPub.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: expected 32, got ${edPub.length}`);
  }
  return edwardsToMontgomeryPub(edPub);
}

/**
 * Derive encryption key from shared secret using HKDF
 * 
 * @param sharedSecret - X25519 shared secret
 * @param ephemeralPub - Ephemeral public key (for domain separation)
 * @returns 32-byte encryption key
 */
function deriveKey(sharedSecret: Uint8Array, ephemeralPub: Uint8Array): Uint8Array {
  // Use ephemeral public key as salt for domain separation
  return hkdf(sha256, sharedSecret, ephemeralPub, HKDF_INFO, KEY_SIZE);
}

/**
 * Encrypt secrets for a recipient
 * 
 * Uses ECIES-like construction:
 * 1. Generate ephemeral X25519 keypair
 * 2. Compute shared secret with recipient's X25519 public key
 * 3. Derive encryption key using HKDF
 * 4. Encrypt with ChaCha20-Poly1305
 * 
 * @param secrets - Object containing secrets to encrypt
 * @param recipientPubKey - Recipient's Ed25519 public key (will be converted to X25519)
 * @returns Encrypted blob containing nonce, ciphertext, and ephemeral public key
 */
export function encryptSecrets(
  secrets: object,
  recipientPubKey: Uint8Array
): EncryptedBlob {
  // Serialize secrets to JSON
  const plaintext = new TextEncoder().encode(JSON.stringify(secrets));
  
  // Convert recipient's Ed25519 public key to X25519
  const recipientX25519Pub = ed25519PubToX25519(recipientPubKey);
  
  // Generate ephemeral X25519 keypair
  const ephemeralPriv = x25519.utils.randomPrivateKey();
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);
  
  // Compute shared secret via X25519 ECDH
  const sharedSecret = x25519.getSharedSecret(ephemeralPriv, recipientX25519Pub);
  
  // Derive encryption key
  const encryptionKey = deriveKey(sharedSecret, ephemeralPub);
  
  // Generate random nonce
  const nonce = randomBytes(NONCE_SIZE);
  
  // Encrypt with ChaCha20-Poly1305
  const cipher = chacha20poly1305(encryptionKey, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  
  return {
    nonce,
    ciphertext,
    ephemeralPub,
  };
}

/**
 * Decrypt secrets using private key
 * 
 * Uses ECIES-like construction:
 * 1. Convert Ed25519 private key to X25519
 * 2. Compute shared secret with ephemeral public key
 * 3. Derive encryption key using HKDF
 * 4. Decrypt with ChaCha20-Poly1305
 * 
 * @param blob - Encrypted blob from encryptSecrets
 * @param privateKey - Recipient's Ed25519 private key (will be converted to X25519)
 * @returns Decrypted secrets object
 * @throws Error if decryption fails (wrong key or corrupted data)
 */
export function decryptSecrets(
  blob: EncryptedBlob,
  privateKey: Uint8Array
): object {
  // Validate blob
  if (!blob.nonce || blob.nonce.length !== NONCE_SIZE) {
    throw new Error(`Invalid nonce length: expected ${NONCE_SIZE}, got ${blob.nonce?.length}`);
  }
  if (!blob.ephemeralPub || blob.ephemeralPub.length !== 32) {
    throw new Error(`Invalid ephemeral public key length: expected 32, got ${blob.ephemeralPub?.length}`);
  }
  if (!blob.ciphertext || blob.ciphertext.length === 0) {
    throw new Error('Invalid ciphertext: empty or missing');
  }
  
  // Convert Ed25519 private key to X25519
  const x25519Priv = edwardsToMontgomeryPriv(privateKey);
  
  // Compute shared secret via X25519 ECDH
  const sharedSecret = x25519.getSharedSecret(x25519Priv, blob.ephemeralPub);
  
  // Derive encryption key
  const encryptionKey = deriveKey(sharedSecret, blob.ephemeralPub);
  
  // Decrypt with ChaCha20-Poly1305
  const cipher = chacha20poly1305(encryptionKey, blob.nonce);
  const plaintext = cipher.decrypt(blob.ciphertext);
  
  // Parse JSON
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json);
}

/**
 * Serialize an EncryptedBlob to a portable format
 * 
 * @param blob - Encrypted blob
 * @returns Base64-encoded JSON string
 */
export function serializeEncryptedBlob(blob: EncryptedBlob): string {
  return JSON.stringify({
    nonce: toBase64(blob.nonce),
    ciphertext: toBase64(blob.ciphertext),
    ephemeralPub: toBase64(blob.ephemeralPub),
  });
}

/**
 * Deserialize an EncryptedBlob from portable format
 * 
 * @param serialized - Base64-encoded JSON string
 * @returns Encrypted blob
 */
export function deserializeEncryptedBlob(serialized: string): EncryptedBlob {
  const parsed = JSON.parse(serialized);
  return {
    nonce: fromBase64(parsed.nonce),
    ciphertext: fromBase64(parsed.ciphertext),
    ephemeralPub: fromBase64(parsed.ephemeralPub),
  };
}

// Base64 helpers (browser-compatible)
function toBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return btoa(result);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
