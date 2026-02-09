/**
 * Memory checkpoints with agent signatures
 * 
 * A checkpoint is a signed snapshot of agent memory at a point in time.
 */

import { signWithAgent, verifyAgentSignature, type Agent, type AID, type KeyEventLog } from '@amcp/core';
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
 * Create a signed memory checkpoint
 * 
 * @param agent - Agent creating the checkpoint
 * @param content - Memory content to checkpoint (will be hashed to CID)
 * @param prior - CID of previous checkpoint (null for first)
 * @param metadata - Checkpoint metadata
 */
export async function createCheckpoint(
  agent: Agent,
  content: unknown,
  prior: CID | null,
  metadata: CheckpointMetadata
): Promise<{ checkpoint: MemoryCheckpoint; contentCid: CID }> {
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
  
  return { checkpoint, contentCid };
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
