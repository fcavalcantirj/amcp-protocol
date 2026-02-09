/**
 * Memory chain management
 * 
 * A memory chain is a linked list of checkpoints, each pointing to its predecessor.
 */

import { type Agent, type KeyEventLog } from '@amcp/core';
import { createCheckpoint, verifyCheckpoint, type MemoryCheckpoint, type CheckpointMetadata } from './checkpoint.js';
import { type CID } from './cid.js';

export interface MemoryChain {
  /** Agent who owns this chain */
  aid: string;
  /** All checkpoints in order (oldest first) */
  checkpoints: MemoryCheckpoint[];
  /** Map of CID -> content for retrieval */
  contentStore: Map<CID, unknown>;
}

/**
 * Create a new memory chain with initial content
 */
export async function createMemoryChain(
  agent: Agent,
  initialContent: unknown,
  metadata: CheckpointMetadata
): Promise<MemoryChain> {
  const { checkpoint, contentCid } = await createCheckpoint(
    agent,
    initialContent,
    null, // No prior for first checkpoint
    metadata
  );
  
  const contentStore = new Map<CID, unknown>();
  contentStore.set(contentCid, initialContent);
  
  return {
    aid: agent.aid,
    checkpoints: [checkpoint],
    contentStore
  };
}

/**
 * Append a new checkpoint to the chain
 */
export async function appendToChain(
  chain: MemoryChain,
  agent: Agent,
  content: unknown,
  metadata: CheckpointMetadata
): Promise<MemoryChain> {
  if (agent.aid !== chain.aid) {
    throw new Error('Agent AID does not match chain owner');
  }
  
  // Get the CID of the last checkpoint
  const lastCheckpoint = chain.checkpoints[chain.checkpoints.length - 1];
  const priorCid = lastCheckpoint.cid;
  
  // Create new checkpoint
  const { checkpoint, contentCid } = await createCheckpoint(
    agent,
    content,
    priorCid,
    metadata
  );
  
  // Update content store
  const newContentStore = new Map(chain.contentStore);
  newContentStore.set(contentCid, content);
  
  return {
    ...chain,
    checkpoints: [...chain.checkpoints, checkpoint],
    contentStore: newContentStore
  };
}

/**
 * Verify the entire memory chain
 */
export async function verifyChain(
  chain: MemoryChain,
  kel: KeyEventLog
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  if (chain.checkpoints.length === 0) {
    return { valid: false, errors: ['Chain is empty'] };
  }
  
  // First checkpoint must have no prior
  if (chain.checkpoints[0].prior !== null) {
    errors.push('First checkpoint must have null prior');
  }
  
  for (let i = 0; i < chain.checkpoints.length; i++) {
    const checkpoint = chain.checkpoints[i];
    
    // Verify signature
    const valid = await verifyCheckpoint(checkpoint, kel);
    if (!valid) {
      errors.push(`Checkpoint ${i} has invalid signature`);
    }
    
    // Verify chain linkage (except first)
    if (i > 0) {
      const prevCheckpoint = chain.checkpoints[i - 1];
      if (checkpoint.prior !== prevCheckpoint.cid) {
        errors.push(`Checkpoint ${i} prior does not match previous CID`);
      }
    }
    
    // Verify AID consistency
    if (checkpoint.aid !== chain.aid) {
      errors.push(`Checkpoint ${i} AID does not match chain owner`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get content by CID from the chain
 */
export function getContent(chain: MemoryChain, cid: CID): unknown | undefined {
  return chain.contentStore.get(cid);
}

/**
 * Get the latest checkpoint
 */
export function getLatestCheckpoint(chain: MemoryChain): MemoryCheckpoint | undefined {
  return chain.checkpoints[chain.checkpoints.length - 1];
}

/**
 * Serialize chain for storage (without content - content must be stored separately)
 */
export function serializeChain(chain: MemoryChain): { aid: string; checkpoints: MemoryCheckpoint[] } {
  return {
    aid: chain.aid,
    checkpoints: chain.checkpoints
  };
}
