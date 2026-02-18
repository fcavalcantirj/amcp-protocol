/**
 * Memory checkpoints with agent signatures
 * 
 * A checkpoint is a signed snapshot of agent memory at a point in time.
 */

import { signWithAgent, verifyAgentSignature, type Agent, type AID, type KeyEventLog, type PinningProvider } from '@amcp/core';
import { computeJSONCID, type CID } from './cid.js';

export interface CheckpointMetadata {
  /** Platform that created this checkpoint */
  platform: string;
  /** Platform version */
  version: string;
  /** Session count since inception */
  sessionCount?: number;
  /** Custom metadata */
  custom?: Record<string, unknown>;
  /** CIDv1 of memory/ontology/graph.jsonl — omit if no ontology graph exists */
  ontologyGraphCID?: string;
  /** SHA-256 hash of SOUL.md content for drift detection */
  soulHash?: string;
  /** Reconstruction sequence step (0-7) when identity coalesced. Default: 7 = post-context-load */
  reconstructionSeam?: number;
}

export interface MemoryCheckpoint {
  /** Agent who owns this memory */
  aid: AID;
  /** CID of memory content */
  cid: CID;
  /** CID of previous checkpoint (null for first) */
  prior: CID | null;
  /** ISO timestamp */
  timestamp: string;
  /** Checkpoint metadata */
  metadata: CheckpointMetadata;
  /** Agent signature over: aid + cid + prior + timestamp + metadata */
  signature: string;
}

export interface UnsignedCheckpoint {
  aid: AID;
  cid: CID;
  prior: CID | null;
  timestamp: string;
  metadata: CheckpointMetadata;
}

/**
 * Options for checkpoint creation
 */
export interface CreateCheckpointOptions {
  /** Optional pinning provider to pin the content CID after checkpoint creation */
  pinningProvider?: PinningProvider;
}

/**
 * Result of checkpoint creation
 */
export interface CreateCheckpointResult {
  checkpoint: MemoryCheckpoint;
  contentCid: CID;
  /** Name of the pinning provider used, if any */
  providerUsed?: string;
}

/**
 * Create a signed memory checkpoint
 *
 * @param agent - Agent creating the checkpoint
 * @param content - Memory content to checkpoint (will be hashed to CID)
 * @param prior - CID of previous checkpoint (null for first)
 * @param metadata - Checkpoint metadata
 * @param options - Optional: pinning provider to pin content after creation
 */
export async function createCheckpoint(
  agent: Agent,
  content: unknown,
  prior: CID | null,
  metadata: CheckpointMetadata,
  options?: CreateCheckpointOptions
): Promise<CreateCheckpointResult> {
  // Compute CID of content
  const contentCid = computeJSONCID(content);

  // Build unsigned checkpoint
  const unsigned: UnsignedCheckpoint = {
    aid: agent.aid,
    cid: contentCid,
    prior,
    timestamp: new Date().toISOString(),
    metadata
  };

  // Sign the checkpoint
  const payload = JSON.stringify(unsigned, Object.keys(unsigned).sort());
  const payloadBytes = new TextEncoder().encode(payload);
  const { signature } = await signWithAgent(agent, payloadBytes);

  const checkpoint: MemoryCheckpoint = {
    ...unsigned,
    signature
  };

  // Pin via provider if given
  let providerUsed: string | undefined;
  if (options?.pinningProvider) {
    const provider = options.pinningProvider;
    await provider.pin(contentCid, `amcp-checkpoint-${contentCid.slice(0, 12)}`);
    providerUsed = provider.name;
  }

  return { checkpoint, contentCid, providerUsed };
}

/**
 * Verify a memory checkpoint signature
 * 
 * @param checkpoint - Checkpoint to verify
 * @param kel - Agent's Key Event Log
 */
export async function verifyCheckpoint(
  checkpoint: MemoryCheckpoint,
  kel: KeyEventLog
): Promise<boolean> {
  // Reconstruct unsigned payload
  const unsigned: UnsignedCheckpoint = {
    aid: checkpoint.aid,
    cid: checkpoint.cid,
    prior: checkpoint.prior,
    timestamp: checkpoint.timestamp,
    metadata: checkpoint.metadata
  };
  
  const payload = JSON.stringify(unsigned, Object.keys(unsigned).sort());
  const payloadBytes = new TextEncoder().encode(payload);
  
  return verifyAgentSignature(
    checkpoint.aid,
    payloadBytes,
    checkpoint.signature,
    kel
  );
}
