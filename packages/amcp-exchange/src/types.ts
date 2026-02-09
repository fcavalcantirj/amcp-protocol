/**
 * Exchange bundle types for platform-agnostic agent portability
 * 
 * Research Backing:
 * - NIST SP 800-34: Disaster recovery, data portability
 * - IEEE Interoperability Standards: Exchange formats enable migration
 * 
 * Principle: Export/import enables portability and collaboration.
 * No vendor lock-in, standard format for agent migration.
 * 
 * @module
 */

import type { AID, AMCPCheckpointContent, SerializedAgent } from '@amcp/core';

// SerializedAgentData is just an alias for SerializedAgent from core
export type SerializedAgentData = SerializedAgent;

/**
 * ServiceIdentity: Reference to an external service account.
 * 
 * The actual credentials are stored in the encrypted secrets blob.
 * This interface tracks which services the agent is connected to.
 */
export interface ServiceIdentity {
  /** Service name (e.g., "solvr", "github", "agentmail") */
  service: string;
  
  /** Identifier on that service (e.g., username, email, agent ID) */
  identifier: string;
  
  /** Reference key to look up credential in secrets object */
  credentialRef: string;
}

/**
 * Bundle header containing metadata about the export
 */
export interface BundleHeader {
  /** Bundle format version */
  version: '1.0.0';
  
  /** Bundle format identifier */
  format: 'amcp-exchange-bundle';
  
  /** When this bundle was created */
  createdAt: string;
  
  /** Agent's AID for quick identification */
  aid: AID;
  
  /** Whether bundle has transport encryption (passphrase) */
  hasTransportEncryption: boolean;
  
  /** Checksum of encrypted payload for integrity verification */
  payloadChecksum: string;
}

/**
 * The payload that gets encrypted in the bundle
 */
export interface BundlePayload {
  /** Serialized agent (KEL + current keys) */
  agent: SerializedAgentData;
  
  /** Full checkpoint content */
  checkpoint: AMCPCheckpointContent;
  
  /** Decrypted secrets object (will be re-encrypted in bundle) */
  secrets: Record<string, unknown>;
  
  /** Service identities for reference */
  services: ServiceIdentity[];
}

// Note: SerializedAgentData is re-exported from @amcp/core as SerializedAgent
// This ensures type compatibility between exchange bundles and core agent format

/**
 * ExportBundle: The complete encrypted export format.
 * 
 * Structure:
 * - Header: Unencrypted metadata for identification
 * - Payload: Encrypted using agent's public key
 * - Optional: Double-encrypted with passphrase for transport security
 */
export interface ExportBundle {
  /** Bundle header (unencrypted) */
  header: BundleHeader;
  
  /**
   * Encrypted payload
   * 
   * If hasTransportEncryption is false:
   *   - Encrypted with agent's Ed25519 public key (converted to X25519)
   * 
   * If hasTransportEncryption is true:
   *   - First encrypted with agent's public key
   *   - Then encrypted with passphrase-derived key (ChaCha20-Poly1305)
   */
  encryptedPayload: EncryptedBundlePayload;
}

/**
 * Encrypted bundle payload structure
 */
export interface EncryptedBundlePayload {
  /** Ephemeral X25519 public key for ECDH */
  ephemeralPub: string;
  
  /** Random nonce (base64) */
  nonce: string;
  
  /** Encrypted ciphertext (base64) */
  ciphertext: string;
  
  /** Transport encryption nonce (if double-encrypted) */
  transportNonce?: string;
  
  /** Transport encryption salt (for key derivation) */
  transportSalt?: string;
}

/**
 * Result of import operation
 */
export interface ImportResult {
  /** Restored agent data */
  agent: SerializedAgentData;
  
  /** Restored checkpoint */
  checkpoint: AMCPCheckpointContent;
  
  /** Decrypted secrets */
  secrets: Record<string, unknown>;
  
  /** Service identities */
  services: ServiceIdentity[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether bundle is valid */
  valid: boolean;
  
  /** Validation errors if invalid */
  errors: string[];
  
  /** Bundle header (available even if payload is invalid) */
  header?: BundleHeader;
}
