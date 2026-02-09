/**
 * @amcp/recovery - Human-readable recovery for AI agent identities
 * 
 * Implements NIST SP 800-34 (Disaster Recovery) and GDPR Article 20 (Data Portability)
 * to provide robust, documented recovery procedures for AI agents.
 * 
 * Key Principles:
 * - Recovery card: Human-readable artifact that fits on paper
 * - Deterministic: Same mnemonic always produces same identity
 * - Portable: Works across any AMCP-compatible platform
 * - Documented: Clear procedures with validation
 * 
 * Recovery Flow:
 * 1. Generate recovery card when creating/checkpointing agent
 * 2. Store card securely (print, safe deposit box, etc.)
 * 3. To recover: parse card, fetch checkpoint, decrypt secrets
 * 4. Verify recovered identity matches original
 * 
 * @example
 * // Generate a recovery card
 * import { generateRecoveryCard, formatRecoveryCard } from '@amcp/recovery';
 * const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'ipfs');
 * const printable = formatRecoveryCard(card);
 * 
 * // Later, recover the agent
 * import { parseRecoveryCard, recoverAgent } from '@amcp/recovery';
 * const card = parseRecoveryCard(printable);
 * const { agent, secrets } = await recoverAgent(card, backend);
 * 
 * @module
 */

// Types
export {
  type RecoveryCard,
  type RecoveredAgent,
  type RecoveryOptions,
  type CardFormatOptions,
  type ValidationResult,
  RECOVERY_CARD_VERSION
} from './types.js';

// Card generation and parsing
export {
  generateRecoveryCard,
  formatRecoveryCard,
  parseRecoveryCard,
  validateRecoveryCard
} from './card.js';

// Recovery operations
export {
  recoverAgent,
  recoverIdentity,
  verifyRecovery,
  createRecoveryBundle,
  estimateRTO
} from './recovery.js';
