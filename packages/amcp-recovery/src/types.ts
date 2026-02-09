/**
 * Recovery Types for AMCP
 * 
 * Implements NIST SP 800-34 principles:
 * - Documented procedures for recovery
 * - Defined Recovery Time Objective (RTO) and Recovery Point Objective (RPO)
 * - Human-readable recovery artifacts
 * 
 * Implements GDPR Article 20 principles:
 * - Data portability - agent owns their data
 * - Structured, commonly used, machine-readable format
 * - Right to transmit data to another controller
 * 
 * @research
 * - NIST SP 800-34 Rev. 1 (Disaster Recovery)
 * - GDPR Article 20 (Data Portability)
 */

import type { AID } from '@amcp/core';
import type { CID } from '@amcp/memory';

/**
 * Recovery Card - Human-readable disaster recovery artifact
 * 
 * NIST SP 800-34 requirements:
 * - Contains all information needed for recovery
 * - Can be printed and stored offline
 * - Documented recovery procedure
 * 
 * GDPR Article 20 requirements:
 * - Portable format (plain text, can be transcribed)
 * - Structured (well-defined fields)
 * - Machine-readable (can be parsed back)
 */
export interface RecoveryCard {
  /** 
   * BIP-39 mnemonic phrase (12 or 24 words)
   * This is the root of trust - derives the keypair deterministically
   */
  phrase: string[];
  
  /**
   * Agent Identifier (self-certifying)
   * Derived from the mnemonic, included for verification
   */
  aid: AID;
  
  /**
   * Content ID of the latest checkpoint
   * Points to the encrypted memory snapshot
   */
  checkpointCid: CID;
  
  /**
   * Storage hint - where to find the checkpoint
   * Examples: "ipfs", "filesystem:/path", "git:repo-url", "pinata"
   */
  storageHint: string;
  
  /**
   * Card creation timestamp (ISO 8601)
   */
  created: string;
  
  /**
   * Protocol version for forward compatibility
   */
  version: string;
}

/**
 * Recovered agent with all restored components
 */
export interface RecoveredAgent {
  /** Restored agent identity */
  agent: import('@amcp/core').Agent;
  
  /** Restored checkpoint data */
  checkpoint: import('@amcp/memory').MemoryCheckpoint;
  
  /** Decrypted secrets */
  secrets: Record<string, unknown>;
  
  /** Raw checkpoint content (the memory data) */
  content: unknown;
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  /** Optional passphrase for additional mnemonic security */
  passphrase?: string;
  
  /** Verify checkpoint signature after recovery */
  verifyCheckpoint?: boolean;
}

/**
 * Card format options
 */
export interface CardFormatOptions {
  /** Include QR code placeholder instructions */
  includeQrInstructions?: boolean;
  
  /** Card title */
  title?: string;
}

/**
 * Recovery validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Validation errors if any */
  errors: string[];
  
  /** Validation warnings (non-fatal) */
  warnings: string[];
}

/** Current protocol version for recovery cards */
export const RECOVERY_CARD_VERSION = '1.0.0';
