/**
 * Agent identity management
 * 
 * High-level API for creating and managing agent identities.
 */

import { generateKeypair, type Keypair, toBase64url, fromBase64url } from './crypto.js';
import { aidFromPublicKey } from './aid.js';
import { 
  createInceptionEvent, 
  createRotationEvent, 
  verifyKEL,
  type KeyEventLog, 
  type AID 
} from './kel.js';

export interface AgentConfig {
  /** Optional name for the agent */
  name?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface Agent {
  /** Self-certifying identifier */
  aid: AID;
  /** Agent name (optional) */
  name?: string;
  /** Key Event Log */
  kel: KeyEventLog;
  /** Current signing keypair */
  currentKeypair: Keypair;
  /** Pre-generated next keypair (for rotation) */
  nextKeypair: Keypair;
  /** Creation timestamp */
  createdAt: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/** Serialized agent for storage */
export interface SerializedAgent {
  aid: AID;
  name?: string;
  kel: KeyEventLog;
  currentPrivateKey: string;
  currentPublicKey: string;
  nextPrivateKey: string;
  nextPublicKey: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new agent identity
 */
export async function createAgent(config: AgentConfig = {}): Promise<Agent> {
  // Generate current and next keypairs
  const currentKeypair = await generateKeypair();
  const nextKeypair = await generateKeypair();

  // Create inception event
  const inceptionEvent = await createInceptionEvent(currentKeypair, nextKeypair.publicKey);

  const agent: Agent = {
    aid: inceptionEvent.aid,
    name: config.name,
    kel: { events: [inceptionEvent] },
    currentKeypair,
    nextKeypair,
    createdAt: inceptionEvent.timestamp,
    metadata: config.metadata
  };

  return agent;
}

/**
 * Rotate agent keys
 * 
 * Uses pre-committed next key, generates new next key for future rotation.
 */
export async function rotateKeys(agent: Agent): Promise<Agent> {
  // Generate new next keypair
  const newNextKeypair = await generateKeypair();

  // Current next becomes new current
  const newCurrentKeypair = agent.nextKeypair;

  // Create rotation event
  const rotationEvent = await createRotationEvent(
    agent.kel,
    newCurrentKeypair,
    newNextKeypair.publicKey
  );

  return {
    ...agent,
    kel: { events: [...agent.kel.events, rotationEvent] },
    currentKeypair: newCurrentKeypair,
    nextKeypair: newNextKeypair
  };
}

/**
 * Serialize agent for storage (CAUTION: includes private keys)
 */
export function serializeAgent(agent: Agent): SerializedAgent {
  return {
    aid: agent.aid,
    name: agent.name,
    kel: agent.kel,
    currentPrivateKey: toBase64url(agent.currentKeypair.privateKey),
    currentPublicKey: toBase64url(agent.currentKeypair.publicKey),
    nextPrivateKey: toBase64url(agent.nextKeypair.privateKey),
    nextPublicKey: toBase64url(agent.nextKeypair.publicKey),
    createdAt: agent.createdAt,
    metadata: agent.metadata
  };
}

/**
 * Load agent from serialized form
 */
export async function loadAgent(serialized: SerializedAgent): Promise<Agent> {
  // Verify the KEL is valid
  if (!await verifyKEL(serialized.kel)) {
    throw new Error('Invalid Key Event Log');
  }

  const agent: Agent = {
    aid: serialized.aid,
    name: serialized.name,
    kel: serialized.kel,
    currentKeypair: {
      privateKey: fromBase64url(serialized.currentPrivateKey),
      publicKey: fromBase64url(serialized.currentPublicKey)
    },
    nextKeypair: {
      privateKey: fromBase64url(serialized.nextPrivateKey),
      publicKey: fromBase64url(serialized.nextPublicKey)
    },
    createdAt: serialized.createdAt,
    metadata: serialized.metadata
  };

  // Verify AID matches current key
  const derivedAid = aidFromPublicKey(agent.currentKeypair.publicKey);
  const lastEvent = agent.kel.events[agent.kel.events.length - 1];
  const expectedKeyB64 = lastEvent.keys[0];
  const actualKeyB64 = toBase64url(agent.currentKeypair.publicKey);
  
  if (expectedKeyB64 !== actualKeyB64) {
    throw new Error('Current keypair does not match latest KEL event');
  }

  return agent;
}

/**
 * Sign arbitrary data with agent's current key
 */
export async function signWithAgent(
  agent: Agent, 
  data: Uint8Array
): Promise<{ signature: string; aid: AID }> {
  const { sign } = await import('./crypto.js');
  const signature = await sign(data, agent.currentKeypair.privateKey);
  return {
    signature: toBase64url(signature),
    aid: agent.aid
  };
}

/**
 * Verify a signature from an agent
 */
export async function verifyAgentSignature(
  aid: AID,
  data: Uint8Array,
  signature: string,
  kel: KeyEventLog
): Promise<boolean> {
  // Verify KEL
  if (!await verifyKEL(kel)) {
    return false;
  }

  // Get current key from latest event
  const lastEvent = kel.events[kel.events.length - 1];
  if (lastEvent.aid !== aid) {
    return false;
  }

  const { verify, fromBase64url } = await import('./crypto.js');
  const publicKey = fromBase64url(lastEvent.keys[0]);
  const sigBytes = fromBase64url(signature);

  return verify(sigBytes, data, publicKey);
}
