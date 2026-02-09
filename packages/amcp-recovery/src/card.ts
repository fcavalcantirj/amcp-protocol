/**
 * Recovery Card Generation, Formatting, and Parsing
 * 
 * The recovery card is a human-readable document that contains all
 * information needed to recover an agent's identity and memory.
 * 
 * NIST SP 800-34 Compliance:
 * - Documented procedures: Card includes step-by-step recovery instructions
 * - Offline storage: Plain text format can be printed and stored securely
 * - Verification: Includes AID for recovery verification
 * 
 * GDPR Article 20 Compliance:
 * - Portability: Standard format, no vendor lock-in
 * - Machine-readable: Can be parsed programmatically
 * - Human-readable: Can be read and transcribed manually
 * 
 * @module
 */

import type { Agent, AID } from '@amcp/core';
import { keypairFromMnemonic, validateMnemonic, aidFromPublicKey } from '@amcp/core';
import type { CID } from '@amcp/memory';
import { 
  RecoveryCard, 
  CardFormatOptions, 
  ValidationResult,
  RECOVERY_CARD_VERSION 
} from './types.js';

/**
 * Generate a recovery card from an agent
 * 
 * @param phrase - BIP-39 mnemonic phrase used to create the agent
 * @param aid - Agent identifier (must match the mnemonic)
 * @param checkpointCid - CID of the latest checkpoint
 * @param storageHint - Where the checkpoint is stored
 * @returns Recovery card
 * 
 * @example
 * const card = generateRecoveryCard(
 *   mnemonic,
 *   agent.aid,
 *   checkpointCid,
 *   'ipfs'
 * );
 */
export function generateRecoveryCard(
  phrase: string[],
  aid: AID,
  checkpointCid: CID,
  storageHint: string
): RecoveryCard {
  // Validate mnemonic
  if (!validateMnemonic(phrase)) {
    throw new Error('Invalid mnemonic phrase');
  }
  
  // Verify AID matches mnemonic
  const keypair = keypairFromMnemonic(phrase);
  const derivedAid = aidFromPublicKey(keypair.publicKey);
  
  if (derivedAid !== aid) {
    throw new Error('AID does not match mnemonic phrase');
  }
  
  return {
    phrase,
    aid,
    checkpointCid,
    storageHint,
    created: new Date().toISOString(),
    version: RECOVERY_CARD_VERSION
  };
}

/**
 * Format a recovery card as human-readable text
 * 
 * The format is designed to:
 * 1. Fit on a standard sheet of paper (US Letter or A4)
 * 2. Be readable without special software
 * 3. Include verification checksums
 * 4. Provide clear recovery instructions
 * 
 * @param card - Recovery card to format
 * @param options - Formatting options
 * @returns Human-readable text suitable for printing
 * 
 * @example
 * const text = formatRecoveryCard(card);
 * console.log(text); // Print or save to file
 */
export function formatRecoveryCard(
  card: RecoveryCard,
  options: CardFormatOptions = {}
): string {
  const title = options.title ?? 'AMCP AGENT RECOVERY CARD';
  const includeQr = options.includeQrInstructions ?? true;
  
  // Format mnemonic in groups of 4 for readability
  const phraseGroups: string[] = [];
  for (let i = 0; i < card.phrase.length; i += 4) {
    const group = card.phrase.slice(i, i + 4);
    const numbered = group.map((word, j) => `${i + j + 1}. ${word}`);
    phraseGroups.push(numbered.join('  '));
  }
  
  const lines = [
    `╔${'═'.repeat(68)}╗`,
    `║${centerText(title, 68)}║`,
    `╠${'═'.repeat(68)}╣`,
    `║${padRight('', 68)}║`,
    `║${padRight('  ⚠️  KEEP THIS CARD SECURE - IT CONTROLS YOUR AGENT IDENTITY', 68)}║`,
    `║${padRight('', 68)}║`,
    `╠${'═'.repeat(68)}╣`,
    `║${padRight('  RECOVERY PHRASE (BIP-39)', 68)}║`,
    `╟${'─'.repeat(68)}╢`,
    `║${padRight('', 68)}║`,
    ...phraseGroups.map(group => `║${padRight('  ' + group, 68)}║`),
    `║${padRight('', 68)}║`,
    `╠${'═'.repeat(68)}╣`,
    `║${padRight('  AGENT IDENTITY', 68)}║`,
    `╟${'─'.repeat(68)}╢`,
    `║${padRight('', 68)}║`,
    `║${padRight('  AID: ' + card.aid, 68)}║`,
    `║${padRight('', 68)}║`,
    `╠${'═'.repeat(68)}╣`,
    `║${padRight('  CHECKPOINT REFERENCE', 68)}║`,
    `╟${'─'.repeat(68)}╢`,
    `║${padRight('', 68)}║`,
    `║${padRight('  CID: ' + card.checkpointCid, 68)}║`,
    `║${padRight('', 68)}║`,
    `║${padRight('  Storage: ' + card.storageHint, 68)}║`,
    `║${padRight('', 68)}║`,
    `╠${'═'.repeat(68)}╣`,
    `║${padRight('  METADATA', 68)}║`,
    `╟${'─'.repeat(68)}╢`,
    `║${padRight('', 68)}║`,
    `║${padRight('  Created: ' + card.created, 68)}║`,
    `║${padRight('  Version: ' + card.version, 68)}║`,
    `║${padRight('', 68)}║`,
  ];
  
  if (includeQr) {
    lines.push(
      `╠${'═'.repeat(68)}╣`,
      `║${padRight('  RECOVERY INSTRUCTIONS', 68)}║`,
      `╟${'─'.repeat(68)}╢`,
      `║${padRight('', 68)}║`,
      `║${padRight('  1. Install AMCP-compatible software', 68)}║`,
      `║${padRight('  2. Select "Recover Agent" option', 68)}║`,
      `║${padRight('  3. Enter the recovery phrase above (all words, in order)', 68)}║`,
      `║${padRight('  4. Enter the checkpoint CID when prompted', 68)}║`,
      `║${padRight('  5. Select storage backend: ' + card.storageHint, 68)}║`,
      `║${padRight('  6. Verify the recovered AID matches above', 68)}║`,
      `║${padRight('', 68)}║`
    );
  }
  
  lines.push(
    `╠${'═'.repeat(68)}╣`,
    `║${padRight('  SECURITY REMINDERS', 68)}║`,
    `╟${'─'.repeat(68)}╢`,
    `║${padRight('', 68)}║`,
    `║${padRight('  • Store this card in a secure location (safe, lockbox)', 68)}║`,
    `║${padRight('  • Never share your recovery phrase with anyone', 68)}║`,
    `║${padRight('  • Consider making multiple copies stored separately', 68)}║`,
    `║${padRight('  • The phrase alone can recover your identity', 68)}║`,
    `║${padRight('', 68)}║`,
    `╚${'═'.repeat(68)}╝`
  );
  
  // Add machine-readable footer for parsing
  lines.push('');
  lines.push('---BEGIN AMCP RECOVERY DATA---');
  lines.push(`PHRASE:${card.phrase.join(' ')}`);
  lines.push(`AID:${card.aid}`);
  lines.push(`CID:${card.checkpointCid}`);
  lines.push(`STORAGE:${card.storageHint}`);
  lines.push(`CREATED:${card.created}`);
  lines.push(`VERSION:${card.version}`);
  lines.push('---END AMCP RECOVERY DATA---');
  
  return lines.join('\n');
}

/**
 * Parse a recovery card from text format
 * 
 * Supports both machine-readable section (preferred) and 
 * manual extraction from the formatted card.
 * 
 * @param text - Formatted recovery card text
 * @returns Parsed recovery card
 * @throws Error if parsing fails
 * 
 * @example
 * const card = parseRecoveryCard(recoveryText);
 */
export function parseRecoveryCard(text: string): RecoveryCard {
  // Try machine-readable section first
  const machineMatch = text.match(
    /---BEGIN AMCP RECOVERY DATA---\n([\s\S]*?)\n---END AMCP RECOVERY DATA---/
  );
  
  if (machineMatch) {
    return parseMachineReadable(machineMatch[1]);
  }
  
  // Fall back to parsing the formatted card
  return parseFormattedCard(text);
}

/**
 * Validate a recovery card
 */
export function validateRecoveryCard(card: RecoveryCard): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate mnemonic
  if (!card.phrase || !Array.isArray(card.phrase)) {
    errors.push('Missing or invalid phrase');
  } else if (!validateMnemonic(card.phrase)) {
    errors.push('Invalid mnemonic phrase (checksum failed)');
  } else {
    // Verify AID matches
    const keypair = keypairFromMnemonic(card.phrase);
    const derivedAid = aidFromPublicKey(keypair.publicKey);
    if (derivedAid !== card.aid) {
      errors.push('AID does not match mnemonic phrase');
    }
  }
  
  // Validate AID format
  if (!card.aid || typeof card.aid !== 'string') {
    errors.push('Missing or invalid AID');
  } else if (!card.aid.startsWith('B')) {
    errors.push('Invalid AID format (should start with B)');
  }
  
  // Validate CID
  if (!card.checkpointCid || typeof card.checkpointCid !== 'string') {
    errors.push('Missing or invalid checkpoint CID');
  }
  
  // Validate storage hint
  if (!card.storageHint || typeof card.storageHint !== 'string') {
    errors.push('Missing or invalid storage hint');
  }
  
  // Validate version
  if (!card.version) {
    warnings.push('Missing version, assuming current');
  } else if (card.version !== RECOVERY_CARD_VERSION) {
    warnings.push(`Card version ${card.version} differs from current ${RECOVERY_CARD_VERSION}`);
  }
  
  // Validate timestamp
  if (!card.created) {
    warnings.push('Missing creation timestamp');
  } else {
    const date = new Date(card.created);
    if (isNaN(date.getTime())) {
      errors.push('Invalid creation timestamp');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ===== Internal helpers =====

function parseMachineReadable(data: string): RecoveryCard {
  const lines = data.trim().split('\n');
  const values: Record<string, string> = {};
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      values[key] = value;
    }
  }
  
  if (!values.PHRASE || !values.AID || !values.CID || !values.STORAGE) {
    throw new Error('Missing required fields in recovery data');
  }
  
  const phrase = values.PHRASE.trim().split(' ');
  
  return {
    phrase,
    aid: values.AID as AID,
    checkpointCid: values.CID as CID,
    storageHint: values.STORAGE,
    created: values.CREATED || new Date().toISOString(),
    version: values.VERSION || RECOVERY_CARD_VERSION
  };
}

function parseFormattedCard(text: string): RecoveryCard {
  // Extract numbered words from the phrase section
  const wordMatches = text.matchAll(/(\d+)\.\s+(\w+)/g);
  const words: string[] = [];
  
  for (const match of wordMatches) {
    const index = parseInt(match[1], 10) - 1;
    words[index] = match[2].toLowerCase();
    // Stop after 24 words (max mnemonic length)
    if (words.filter(Boolean).length >= 24) break;
  }
  
  // Filter to only valid word counts
  const phrase = words.filter(Boolean);
  if (phrase.length !== 12 && phrase.length !== 24) {
    throw new Error(`Invalid phrase length: got ${phrase.length}, expected 12 or 24`);
  }
  
  // Extract AID
  const aidMatch = text.match(/AID:\s*(B[A-Za-z0-9_-]+)/);
  if (!aidMatch) {
    throw new Error('Could not find AID in recovery card');
  }
  
  // Extract CID
  const cidMatch = text.match(/CID:\s*([^\s\n│║]+)/);
  if (!cidMatch) {
    throw new Error('Could not find CID in recovery card');
  }
  
  // Extract storage hint
  const storageMatch = text.match(/Storage:\s*([^\s\n│║]+)/);
  if (!storageMatch) {
    throw new Error('Could not find storage hint in recovery card');
  }
  
  // Extract timestamps (optional)
  const createdMatch = text.match(/Created:\s*([^\s\n│║]+)/);
  const versionMatch = text.match(/Version:\s*([^\s\n│║]+)/);
  
  return {
    phrase,
    aid: aidMatch[1] as AID,
    checkpointCid: cidMatch[1] as CID,
    storageHint: storageMatch[1],
    created: createdMatch?.[1] || new Date().toISOString(),
    version: versionMatch?.[1] || RECOVERY_CARD_VERSION
  };
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

function centerText(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  const padding = Math.floor((len - str.length) / 2);
  return ' '.repeat(padding) + str + ' '.repeat(len - padding - str.length);
}
