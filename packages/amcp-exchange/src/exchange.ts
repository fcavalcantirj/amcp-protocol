/**
 * Exchange bundle creation and import for agent portability
 * 
 * Research Backing:
 * - NIST SP 800-34: Disaster recovery requires portable backups
 * - IEEE Interoperability: Standard formats prevent lock-in
 * 
 * Security Model:
 * - Base encryption: X25519 + ChaCha20-Poly1305 (agent's key)
 * - Transport encryption: PBKDF2 + ChaCha20-Poly1305 (passphrase)
 * 
 * @module
 */

import { x25519 } from '@noble/curves/ed25519';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { 
  type Agent, 
  type AMCPCheckpointContent,
  serializeAgent,
  toBase64url,
  fromBase64url
} from '@amcp/core';
import { ed25519PubToX25519 } from '@amcp/memory';

import type {
  ExportBundle,
  BundleHeader,
  BundlePayload,
  EncryptedBundlePayload,
  ServiceIdentity,
  ImportResult,
  ValidationResult
} from './types.js';
import type { SerializedAgentData } from './types.js';

// Constants
const BUNDLE_VERSION = '1.0.0' as const;
const BUNDLE_FORMAT = 'amcp-exchange-bundle' as const;
const HKDF_INFO = new TextEncoder().encode('amcp-exchange-v1');
const PBKDF2_ITERATIONS = 100000;
const KEY_SIZE = 32;
const NONCE_SIZE = 12;
const SALT_SIZE = 16;

/**
 * Export an agent to a portable bundle
 * 
 * Creates an encrypted bundle containing:
 * - Agent identity (KEL, keys)
 * - Memory checkpoint
 * - Decrypted secrets
 * - Service identities
 * 
 * @param agent - The agent to export
 * @param checkpoint - Full checkpoint content
 * @param secrets - Decrypted secrets object
 * @param services - Service identity mappings (optional)
 * @param passphrase - Optional passphrase for transport encryption
 * @returns Serialized bundle as Uint8Array
 */
export async function exportAgent(
  agent: Agent,
  checkpoint: AMCPCheckpointContent,
  secrets: Record<string, unknown>,
  services: ServiceIdentity[] = [],
  passphrase?: string
): Promise<Uint8Array> {
  // Serialize agent data (uses @amcp/core serializeAgent format)
  const serialized = serializeAgent(agent);
  const agentData: SerializedAgentData = {
    aid: serialized.aid,
    name: serialized.name,
    kel: serialized.kel,
    currentPublicKey: serialized.currentPublicKey,
    currentPrivateKey: serialized.currentPrivateKey,
    nextPublicKey: serialized.nextPublicKey,
    nextPrivateKey: serialized.nextPrivateKey,
    createdAt: serialized.createdAt,
    metadata: serialized.metadata
  };
  
  // Build payload
  const payload: BundlePayload = {
    agent: agentData,
    checkpoint,
    secrets,
    services
  };
  
  // Serialize payload to JSON
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  
  // Encrypt with agent's public key
  const recipientX25519Pub = ed25519PubToX25519(
    fromBase64url(serialized.currentPublicKey)
  );
  
  // Generate ephemeral keypair for ECDH
  const ephemeralPriv = x25519.utils.randomPrivateKey();
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);
  
  // Compute shared secret
  const sharedSecret = x25519.getSharedSecret(ephemeralPriv, recipientX25519Pub);
  const encryptionKey = hkdf(sha256, sharedSecret, ephemeralPub, HKDF_INFO, KEY_SIZE);
  
  // Encrypt payload
  const nonce = randomBytes(NONCE_SIZE);
  const cipher = chacha20poly1305(encryptionKey, nonce);
  let ciphertext = cipher.encrypt(payloadBytes);
  
  // Build encrypted payload
  const encryptedPayload: EncryptedBundlePayload = {
    ephemeralPub: toBase64(ephemeralPub),
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext)
  };
  
  // Apply transport encryption if passphrase provided
  if (passphrase) {
    const transportSalt = randomBytes(SALT_SIZE);
    const transportKey = pbkdf2(sha256, passphrase, transportSalt, {
      c: PBKDF2_ITERATIONS,
      dkLen: KEY_SIZE
    });
    
    // Re-encrypt the entire ciphertext
    const transportNonce = randomBytes(NONCE_SIZE);
    const transportCipher = chacha20poly1305(transportKey, transportNonce);
    const doubleEncrypted = transportCipher.encrypt(
      fromBase64(encryptedPayload.ciphertext)
    );
    
    encryptedPayload.ciphertext = toBase64(doubleEncrypted);
    encryptedPayload.transportNonce = toBase64(transportNonce);
    encryptedPayload.transportSalt = toBase64(transportSalt);
  }
  
  // Compute checksum
  const payloadChecksum = computeChecksum(encryptedPayload.ciphertext);
  
  // Build bundle
  const bundle: ExportBundle = {
    header: {
      version: BUNDLE_VERSION,
      format: BUNDLE_FORMAT,
      createdAt: new Date().toISOString(),
      aid: agent.aid,
      hasTransportEncryption: !!passphrase,
      payloadChecksum
    },
    encryptedPayload
  };
  
  // Serialize to Uint8Array
  const bundleJson = JSON.stringify(bundle);
  return new TextEncoder().encode(bundleJson);
}

/**
 * Import an agent from a bundle
 * 
 * @param bundleBytes - Serialized bundle
 * @param phrase - Mnemonic phrase to derive private key for decryption
 * @param passphrase - Transport passphrase (required if bundle has transport encryption)
 * @returns Imported agent data, checkpoint, and secrets
 */
export async function importAgent(
  bundleBytes: Uint8Array,
  privateKey: Uint8Array,
  passphrase?: string
): Promise<ImportResult> {
  // Parse bundle
  const bundleJson = new TextDecoder().decode(bundleBytes);
  const bundle: ExportBundle = JSON.parse(bundleJson);
  
  // Validate basic structure
  if (bundle.header.format !== BUNDLE_FORMAT) {
    throw new Error(`Unknown bundle format: ${bundle.header.format}`);
  }
  
  // Verify checksum
  const checksum = computeChecksum(bundle.encryptedPayload.ciphertext);
  if (checksum !== bundle.header.payloadChecksum) {
    throw new Error('Bundle checksum mismatch - data may be corrupted');
  }
  
  let ciphertext = fromBase64(bundle.encryptedPayload.ciphertext);
  
  // Remove transport encryption if present
  if (bundle.header.hasTransportEncryption) {
    if (!passphrase) {
      throw new Error('Bundle has transport encryption but no passphrase provided');
    }
    if (!bundle.encryptedPayload.transportNonce || !bundle.encryptedPayload.transportSalt) {
      throw new Error('Bundle missing transport encryption parameters');
    }
    
    const transportSalt = fromBase64(bundle.encryptedPayload.transportSalt);
    const transportKey = pbkdf2(sha256, passphrase, transportSalt, {
      c: PBKDF2_ITERATIONS,
      dkLen: KEY_SIZE
    });
    
    const transportNonce = fromBase64(bundle.encryptedPayload.transportNonce);
    const transportCipher = chacha20poly1305(transportKey, transportNonce);
    
    try {
      ciphertext = transportCipher.decrypt(ciphertext);
    } catch {
      throw new Error('Invalid transport passphrase');
    }
  }
  
  // Convert Ed25519 private key to X25519
  const { edwardsToMontgomeryPriv } = await import('@noble/curves/ed25519');
  const x25519Priv = edwardsToMontgomeryPriv(privateKey);
  
  // Compute shared secret with ephemeral public key
  const ephemeralPub = fromBase64(bundle.encryptedPayload.ephemeralPub);
  const sharedSecret = x25519.getSharedSecret(x25519Priv, ephemeralPub);
  const decryptionKey = hkdf(sha256, sharedSecret, ephemeralPub, HKDF_INFO, KEY_SIZE);
  
  // Decrypt payload
  const nonce = fromBase64(bundle.encryptedPayload.nonce);
  const cipher = chacha20poly1305(decryptionKey, nonce);
  
  let plaintext: Uint8Array;
  try {
    plaintext = cipher.decrypt(ciphertext);
  } catch {
    throw new Error('Failed to decrypt bundle - invalid private key');
  }
  
  // Parse payload
  const payloadJson = new TextDecoder().decode(plaintext);
  const payload: BundlePayload = JSON.parse(payloadJson);
  
  return {
    agent: payload.agent,
    checkpoint: payload.checkpoint,
    secrets: payload.secrets,
    services: payload.services
  };
}

/**
 * Validate a bundle without decrypting
 * 
 * Checks:
 * - Valid JSON structure
 * - Correct format identifier
 * - Checksum integrity
 * - Required fields present
 * 
 * @param bundleBytes - Serialized bundle
 * @returns Validation result
 */
export function validateBundle(bundleBytes: Uint8Array): ValidationResult {
  const errors: string[] = [];
  let header: BundleHeader | undefined;
  
  try {
    // Parse JSON
    const bundleJson = new TextDecoder().decode(bundleBytes);
    let bundle: ExportBundle;
    
    try {
      bundle = JSON.parse(bundleJson);
    } catch {
      return { valid: false, errors: ['Invalid JSON'] };
    }
    
    // Check header exists
    if (!bundle.header) {
      errors.push('Missing header');
      return { valid: false, errors };
    }
    
    header = bundle.header;
    
    // Check format
    if (bundle.header.format !== BUNDLE_FORMAT) {
      errors.push(`Invalid format: expected '${BUNDLE_FORMAT}', got '${bundle.header.format}'`);
    }
    
    // Check version
    if (bundle.header.version !== BUNDLE_VERSION) {
      errors.push(`Unsupported version: ${bundle.header.version}`);
    }
    
    // Check required header fields
    if (!bundle.header.aid) {
      errors.push('Missing AID in header');
    }
    if (!bundle.header.createdAt) {
      errors.push('Missing createdAt in header');
    }
    if (typeof bundle.header.hasTransportEncryption !== 'boolean') {
      errors.push('Missing hasTransportEncryption in header');
    }
    if (!bundle.header.payloadChecksum) {
      errors.push('Missing payloadChecksum in header');
    }
    
    // Check encrypted payload
    if (!bundle.encryptedPayload) {
      errors.push('Missing encryptedPayload');
    } else {
      if (!bundle.encryptedPayload.ephemeralPub) {
        errors.push('Missing ephemeralPub in payload');
      }
      if (!bundle.encryptedPayload.nonce) {
        errors.push('Missing nonce in payload');
      }
      if (!bundle.encryptedPayload.ciphertext) {
        errors.push('Missing ciphertext in payload');
      }
      
      // Check transport encryption fields if needed
      if (bundle.header.hasTransportEncryption) {
        if (!bundle.encryptedPayload.transportNonce) {
          errors.push('Missing transportNonce (bundle has transport encryption)');
        }
        if (!bundle.encryptedPayload.transportSalt) {
          errors.push('Missing transportSalt (bundle has transport encryption)');
        }
      }
      
      // Verify checksum
      if (bundle.encryptedPayload.ciphertext && bundle.header.payloadChecksum) {
        const checksum = computeChecksum(bundle.encryptedPayload.ciphertext);
        if (checksum !== bundle.header.payloadChecksum) {
          errors.push('Checksum mismatch - bundle may be corrupted');
        }
      }
    }
    
  } catch (e) {
    errors.push(`Validation error: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    header
  };
}

/**
 * Extract bundle header without decryption
 * 
 * Useful for inspecting bundles before import
 */
export function extractBundleHeader(bundleBytes: Uint8Array): BundleHeader | null {
  try {
    const bundleJson = new TextDecoder().decode(bundleBytes);
    const bundle: ExportBundle = JSON.parse(bundleJson);
    return bundle.header;
  } catch {
    return null;
  }
}

// Helper functions

function computeChecksum(data: string): string {
  const hash = sha256(new TextEncoder().encode(data));
  return toBase64(hash).slice(0, 16); // First 16 chars for readability
}

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
