/**
 * Key Event Log (KEL) implementation
 * 
 * KERI-lite: simplified key event structure for agent identity.
 * Supports inception and rotation events with pre-rotation commitment.
 */

import { hash, sign, verify, toBase64url, fromBase64url, type Keypair } from './crypto.js';
import { aidFromPublicKey } from './aid.js';

/** Autonomic Identifier - self-certifying from public key */
export type AID = string;

/** Base key event structure */
export interface KeyEventBase {
  /** Event type */
  type: 'inception' | 'rotation' | 'interaction';
  /** Agent's AID (derived from inception key) */
  aid: AID;
  /** Sequence number (0 for inception) */
  sn: number;
  /** Hash of prior event (null for inception) */
  prior: string | null;
  /** ISO timestamp */
  timestamp: string;
  /** Self-signature over event */
  signature: string;
}

/** Inception event - establishes the AID */
export interface InceptionEvent extends KeyEventBase {
  type: 'inception';
  sn: 0;
  prior: null;
  /** Current signing key(s) - base64url encoded */
  keys: string[];
  /** Hash of next key(s) for pre-rotation - base64url encoded */
  next: string;
}

/** Rotation event - rotates to pre-committed key */
export interface RotationEvent extends KeyEventBase {
  type: 'rotation';
  /** New signing key(s) - must match prior event's 'next' commitment */
  keys: string[];
  /** Hash of next key(s) for future rotation */
  next: string;
}

export type KeyEvent = InceptionEvent | RotationEvent;

/** Complete Key Event Log */
export interface KeyEventLog {
  events: KeyEvent[];
}

/**
 * Compute the hash commitment for pre-rotation
 */
export function computeNextKeyHash(publicKey: Uint8Array): string {
  return toBase64url(hash(publicKey).slice(0, 32)); // Use first 32 bytes
}

/**
 * Serialize event for signing (excludes signature field)
 */
function serializeForSigning(event: Omit<KeyEvent, 'signature'>): string {
  return JSON.stringify(event, Object.keys(event).filter(k => k !== 'signature').sort());
}

/**
 * Compute hash of an event (for chaining)
 */
export function hashEvent(event: KeyEvent): string {
  return toBase64url(hash(new TextEncoder().encode(JSON.stringify(event))).slice(0, 32));
}

/**
 * Create an inception event (establishes agent identity)
 */
export async function createInceptionEvent(
  currentKeypair: Keypair,
  nextPublicKey: Uint8Array
): Promise<InceptionEvent> {
  const aid = aidFromPublicKey(currentKeypair.publicKey);
  
  const eventWithoutSig: Omit<InceptionEvent, 'signature'> = {
    type: 'inception',
    aid,
    sn: 0,
    prior: null,
    keys: [toBase64url(currentKeypair.publicKey)],
    next: computeNextKeyHash(nextPublicKey),
    timestamp: new Date().toISOString()
  };

  const message = new TextEncoder().encode(serializeForSigning(eventWithoutSig));
  const signature = await sign(message, currentKeypair.privateKey);

  return {
    ...eventWithoutSig,
    signature: toBase64url(signature)
  };
}

/**
 * Create a rotation event (rotates to pre-committed key)
 */
export async function createRotationEvent(
  kel: KeyEventLog,
  currentKeypair: Keypair,
  nextPublicKey: Uint8Array
): Promise<RotationEvent> {
  if (kel.events.length === 0) {
    throw new Error('Cannot rotate: no inception event');
  }

  const lastEvent = kel.events[kel.events.length - 1];
  const aid = lastEvent.aid;
  const sn = lastEvent.sn + 1;
  const prior = hashEvent(lastEvent);

  // Verify current key matches the pre-commitment
  const expectedHash = lastEvent.next;
  const actualHash = computeNextKeyHash(currentKeypair.publicKey);
  if (expectedHash !== actualHash) {
    throw new Error('Current key does not match pre-rotation commitment');
  }

  const eventWithoutSig: Omit<RotationEvent, 'signature'> = {
    type: 'rotation',
    aid,
    sn,
    prior,
    keys: [toBase64url(currentKeypair.publicKey)],
    next: computeNextKeyHash(nextPublicKey),
    timestamp: new Date().toISOString()
  };

  const message = new TextEncoder().encode(serializeForSigning(eventWithoutSig));
  const signature = await sign(message, currentKeypair.privateKey);

  return {
    ...eventWithoutSig,
    signature: toBase64url(signature)
  };
}

/**
 * Verify a single key event
 */
export async function verifyEvent(event: KeyEvent, expectedAid?: AID): Promise<boolean> {
  // Check AID if provided
  if (expectedAid && event.aid !== expectedAid) {
    return false;
  }

  // Get the signing key from the event
  const publicKeyB64 = event.keys[0];
  const publicKey = fromBase64url(publicKeyB64);

  // For inception, AID must match the key
  if (event.type === 'inception') {
    const derivedAid = aidFromPublicKey(publicKey);
    if (derivedAid !== event.aid) {
      return false;
    }
  }

  // Verify signature
  const eventWithoutSig = { ...event } as Record<string, unknown>;
  delete eventWithoutSig.signature;
  const message = new TextEncoder().encode(serializeForSigning(eventWithoutSig as Omit<KeyEvent, 'signature'>));
  const signature = fromBase64url(event.signature);

  return verify(signature, message, publicKey);
}

/**
 * Verify an entire Key Event Log
 */
export async function verifyKEL(kel: KeyEventLog): Promise<boolean> {
  if (kel.events.length === 0) {
    return false;
  }

  // First event must be inception
  const inception = kel.events[0];
  if (inception.type !== 'inception' || inception.sn !== 0 || inception.prior !== null) {
    return false;
  }

  // Verify each event
  for (let i = 0; i < kel.events.length; i++) {
    const event = kel.events[i];
    
    // Verify signature
    if (!await verifyEvent(event, inception.aid)) {
      return false;
    }

    // Verify chain integrity (except for inception)
    if (i > 0) {
      const prevEvent = kel.events[i - 1];
      
      // Sequence must increment
      if (event.sn !== prevEvent.sn + 1) {
        return false;
      }
      
      // Prior hash must match
      if (event.prior !== hashEvent(prevEvent)) {
        return false;
      }

      // For rotation, key must match pre-commitment
      if (event.type === 'rotation') {
        const expectedHash = prevEvent.next;
        const actualHash = computeNextKeyHash(fromBase64url(event.keys[0]));
        if (expectedHash !== actualHash) {
          return false;
        }
      }
    }
  }

  return true;
}
