/**
 * @amcp/exchange - Platform-agnostic exchange bundles for AI agent portability
 * 
 * Enables agents to export their complete state (identity, memory, secrets)
 * into a portable format that can be imported on any platform.
 * 
 * Research Backing:
 * - NIST SP 800-34: Disaster recovery through portable backups
 * - IEEE Interoperability Standards: Exchange formats prevent lock-in
 * 
 * Features:
 * - Complete agent state export (identity + memory + secrets)
 * - X25519 + ChaCha20-Poly1305 encryption (agent's key)
 * - Optional passphrase-based transport encryption (double encryption)
 * - Integrity verification via checksums
 * - Version-tagged format for forward compatibility
 * 
 * @example
 * ```typescript
 * import { exportAgent, importAgent, validateBundle } from '@amcp/exchange';
 * 
 * // Export agent to bundle
 * const bundle = await exportAgent(agent, checkpoint, secrets, services, 'transport-password');
 * 
 * // Validate bundle before import
 * const validation = validateBundle(bundle);
 * if (validation.valid) {
 *   // Import on new platform
 *   const { agent, checkpoint, secrets } = await importAgent(bundle, privateKey, 'transport-password');
 * }
 * ```
 * 
 * @module
 */

// Core exchange functions
export {
  exportAgent,
  importAgent,
  validateBundle,
  extractBundleHeader
} from './exchange.js';

// Types
export type {
  ServiceIdentity,
  BundleHeader,
  BundlePayload,
  ExportBundle,
  EncryptedBundlePayload,
  ImportResult,
  ValidationResult
} from './types.js';

// Re-exported from @amcp/core
export type { SerializedAgentData } from './types.js';
