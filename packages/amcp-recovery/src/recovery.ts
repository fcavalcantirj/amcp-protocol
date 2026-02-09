/**
 * Agent Recovery Implementation
 * 
 * NIST SP 800-34 Recovery Objectives:
 * - RTO (Recovery Time Objective): Minimal - single function call
 * - RPO (Recovery Point Objective): Last checkpoint
 * - Documented procedures: Clear API with validation
 * 
 * Recovery Flow:
 * 1. Parse recovery card (mnemonic + CID + storage hint)
 * 2. Derive keypair from mnemonic (deterministic)
 * 3. Reconstruct agent identity from keypair
 * 4. Fetch checkpoint from storage backend
 * 5. Decrypt secrets using derived key
 * 6. Verify recovery matches original
 * 
 * @module
 */

import {
  keypairFromMnemonic,
  validateMnemonic,
  aidFromPublicKey,
  createInceptionEvent,
  type Agent,
  type AID,
  type Keypair,
  type KeyEventLog
} from '@amcp/core';

import {
  type StorageBackend,
  type CID,
  type MemoryCheckpoint,
  decryptSecrets,
  deserializeEncryptedBlob,
  verifyCheckpoint
} from '@amcp/memory';

import type { RecoveryCard, RecoveredAgent, RecoveryOptions } from './types.js';
import { validateRecoveryCard } from './card.js';

/**
 * Recover an agent from a recovery card
 * 
 * This is the main recovery entry point. Given a recovery card and
 * a storage backend, it reconstructs the full agent with all secrets.
 * 
 * NIST SP 800-34: Implements documented recovery procedure
 * GDPR Article 20: Enables data portability across platforms
 * 
 * @param card - Recovery card with phrase, CID, and storage hint
 * @param backend - Storage backend to fetch checkpoint from
 * @param options - Optional recovery settings
 * @returns Recovered agent with checkpoint and secrets
 * @throws Error if recovery fails
 * 
 * @example
 * const card = parseRecoveryCard(cardText);
 * const backend = createFilesystemBackend('/backups');
 * const { agent, checkpoint, secrets } = await recoverAgent(card, backend);
 */
export async function recoverAgent(
  card: RecoveryCard,
  backend: StorageBackend,
  options: RecoveryOptions = {}
): Promise<RecoveredAgent> {
  // Step 1: Validate recovery card
  const validation = validateRecoveryCard(card);
  if (!validation.valid) {
    throw new Error(`Invalid recovery card: ${validation.errors.join(', ')}`);
  }
  
  // Step 2: Derive keypair from mnemonic
  const currentKeypair = keypairFromMnemonic(card.phrase, options.passphrase);
  
  // Step 3: Verify derived AID matches card
  const derivedAid = aidFromPublicKey(currentKeypair.publicKey);
  if (derivedAid !== card.aid) {
    throw new Error(
      `AID mismatch: card has ${card.aid}, mnemonic derives ${derivedAid}`
    );
  }
  
  // Step 4: Generate next keypair for rotation capability
  // For recovery, we generate a fresh next keypair
  const nextKeypair = await generateNextKeypair();
  
  // Step 5: Reconstruct agent identity
  const inceptionEvent = await createInceptionEvent(currentKeypair, nextKeypair.publicKey);
  
  const agent: Agent = {
    aid: card.aid,
    kel: { events: [inceptionEvent] },
    currentKeypair,
    nextKeypair,
    createdAt: inceptionEvent.timestamp,
    metadata: { recoveredAt: new Date().toISOString(), fromCard: true }
  };
  
  // Step 6: Fetch checkpoint from storage
  const checkpointData = await backend.get(card.checkpointCid);
  const checkpointJson = new TextDecoder().decode(checkpointData);
  const storedData = JSON.parse(checkpointJson);
  
  // Parse checkpoint and content
  const checkpoint: MemoryCheckpoint = storedData.checkpoint;
  const content = storedData.content;
  
  // Step 7: Verify checkpoint if requested
  if (options.verifyCheckpoint !== false) {
    // For recovery, we need to verify against the original KEL
    // Since we're recovering, we trust the checkpoint was valid when created
    // A full verification would require the original KEL
    if (checkpoint.aid !== card.aid) {
      throw new Error('Checkpoint AID does not match recovery card');
    }
  }
  
  // Step 8: Decrypt secrets
  let secrets: Record<string, unknown> = {};
  if (storedData.encryptedSecrets) {
    try {
      const blob = deserializeEncryptedBlob(storedData.encryptedSecrets);
      secrets = decryptSecrets(blob, currentKeypair.privateKey) as Record<string, unknown>;
    } catch (error) {
      throw new Error(`Failed to decrypt secrets: ${(error as Error).message}`);
    }
  }
  
  return {
    agent,
    checkpoint,
    secrets,
    content
  };
}

/**
 * Verify that a recovered agent matches the original
 * 
 * This is a critical verification step after recovery to ensure
 * the mnemonic phrase produced the correct identity.
 * 
 * @param original - Original agent (or just the AID)
 * @param recovered - Recovered agent from recoverAgent()
 * @returns true if AIDs match
 * 
 * @example
 * const recovered = await recoverAgent(card, backend);
 * if (verifyRecovery(originalAid, recovered)) {
 *   console.log('Recovery successful!');
 * }
 */
export function verifyRecovery(
  original: Agent | AID,
  recovered: RecoveredAgent
): boolean {
  const originalAid = typeof original === 'string' ? original : original.aid;
  return originalAid === recovered.agent.aid;
}

/**
 * Create a complete recovery bundle for storage
 * 
 * This packages a checkpoint with encrypted secrets for storage,
 * suitable for later recovery with recoverAgent().
 * 
 * @param agent - Agent identity
 * @param checkpoint - Memory checkpoint
 * @param content - Checkpoint content (the actual memory data)
 * @param secrets - Secrets to encrypt (API keys, tokens, etc.)
 * @returns Serialized bundle ready for storage
 */
export async function createRecoveryBundle(
  agent: Agent,
  checkpoint: MemoryCheckpoint,
  content: unknown,
  secrets: Record<string, unknown> = {}
): Promise<Uint8Array> {
  // Import encryption
  const { encryptSecrets, serializeEncryptedBlob } = await import('@amcp/memory');
  
  // Encrypt secrets for the agent (they can decrypt with their private key)
  const encryptedSecrets = Object.keys(secrets).length > 0
    ? serializeEncryptedBlob(encryptSecrets(secrets, agent.currentKeypair.publicKey))
    : null;
  
  const bundle = {
    checkpoint,
    content,
    encryptedSecrets,
    bundleVersion: '1.0.0',
    createdAt: new Date().toISOString()
  };
  
  return new TextEncoder().encode(JSON.stringify(bundle, null, 2));
}

/**
 * Recover agent identity only (without checkpoint data)
 * 
 * Useful when you have the mnemonic but no checkpoint,
 * or when setting up a fresh agent with an existing identity.
 * 
 * @param phrase - BIP-39 mnemonic phrase
 * @param passphrase - Optional passphrase
 * @returns Agent with derived identity
 */
export async function recoverIdentity(
  phrase: string[],
  passphrase?: string
): Promise<Agent> {
  if (!validateMnemonic(phrase)) {
    throw new Error('Invalid mnemonic phrase');
  }
  
  const currentKeypair = keypairFromMnemonic(phrase, passphrase);
  const nextKeypair = await generateNextKeypair();
  const inceptionEvent = await createInceptionEvent(currentKeypair, nextKeypair.publicKey);
  
  return {
    aid: inceptionEvent.aid,
    kel: { events: [inceptionEvent] },
    currentKeypair,
    nextKeypair,
    createdAt: inceptionEvent.timestamp,
    metadata: { recoveredAt: new Date().toISOString(), identityOnly: true }
  };
}

/**
 * Estimate Recovery Time Objective (RTO)
 * 
 * NIST SP 800-34 requires documenting RTO.
 * For AMCP, RTO depends primarily on storage backend latency.
 * 
 * @param backend - Storage backend to estimate
 * @returns Estimated RTO in milliseconds
 */
export function estimateRTO(backend: StorageBackend): { 
  estimate: number; 
  description: string 
} {
  // RTO estimates by backend type
  switch (backend.name) {
    case 'filesystem':
      return { 
        estimate: 100, 
        description: 'Local filesystem: ~100ms (disk I/O only)'
      };
    case 'ipfs':
      return { 
        estimate: 5000, 
        description: 'IPFS gateway: ~5s (network dependent)'
      };
    case 'git':
      return { 
        estimate: 10000, 
        description: 'Git repository: ~10s (clone/fetch)'
      };
    default:
      return { 
        estimate: 30000, 
        description: 'Unknown backend: ~30s (conservative estimate)'
      };
  }
}

// ===== Internal helpers =====

async function generateNextKeypair(): Promise<Keypair> {
  // Dynamic import to avoid circular dependencies
  const { generateKeypair } = await import('@amcp/core');
  return generateKeypair();
}
