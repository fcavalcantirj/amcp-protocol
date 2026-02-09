/**
 * BIP-39 Mnemonic Support for AMCP
 * 
 * Provides human-memorable recovery phrases that deterministically derive
 * Ed25519 keypairs. Compatible with BIP-39 specification.
 * 
 * Security properties:
 * - 12 words = 128 bits entropy = 3.4×10^38 combinations (brute force infeasible)
 * - 24 words = 256 bits entropy = 1.2×10^77 combinations
 * - PBKDF2 with 2048 iterations for key stretching
 * - Same mnemonic always produces same keypair (deterministic)
 */

import { generateMnemonic as genMnemonic, mnemonicToSeedSync, validateMnemonic as validateMnemo } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import type { Keypair } from './crypto.js';

// Required for @noble/ed25519 v2
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

export type MnemonicStrength = 128 | 256;

/**
 * Generate a new BIP-39 mnemonic phrase
 * 
 * @param strength - 128 for 12 words, 256 for 24 words (default: 128)
 * @returns Array of mnemonic words
 * 
 * @example
 * const words = generateMnemonic(); // 12 words
 * const strongWords = generateMnemonic(256); // 24 words
 */
export function generateMnemonic(strength: MnemonicStrength = 128): string[] {
  if (strength !== 128 && strength !== 256) {
    throw new Error('Strength must be 128 (12 words) or 256 (24 words)');
  }
  const mnemonic = genMnemonic(englishWordlist, strength);
  return mnemonic.split(' ');
}

/**
 * Convert mnemonic words to a seed (deterministic)
 * 
 * Uses BIP-39 PBKDF2 derivation with 2048 iterations.
 * The seed is 64 bytes (512 bits).
 * 
 * @param words - Array of mnemonic words
 * @param passphrase - Optional passphrase for additional security
 * @returns 64-byte seed
 * 
 * @example
 * const seed = mnemonicToSeed(words);
 */
export function mnemonicToSeed(words: string[], passphrase: string = ''): Uint8Array {
  if (!validateMnemonic(words)) {
    throw new Error('Invalid mnemonic phrase');
  }
  const mnemonic = words.join(' ');
  return mnemonicToSeedSync(mnemonic, passphrase);
}

/**
 * Derive an Ed25519 keypair from a mnemonic phrase (deterministic)
 * 
 * Same mnemonic will ALWAYS produce the same keypair.
 * This is the foundation of recovery - backup the words, recover the keys.
 * 
 * @param words - Array of mnemonic words
 * @param passphrase - Optional passphrase for additional security
 * @returns Ed25519 keypair
 * 
 * @example
 * const keypair = keypairFromMnemonic(words);
 * // Later, with same words:
 * const recovered = keypairFromMnemonic(words);
 * // keypair.publicKey === recovered.publicKey (deterministic!)
 */
export function keypairFromMnemonic(words: string[], passphrase: string = ''): Keypair {
  const seed = mnemonicToSeed(words, passphrase);
  
  // Use first 32 bytes of 64-byte seed as Ed25519 private key
  // Ed25519 private keys are 32 bytes (256 bits)
  const privateKey = seed.slice(0, 32);
  const publicKey = ed.getPublicKey(privateKey);
  
  return { publicKey, privateKey };
}

/**
 * Validate a mnemonic phrase
 * 
 * Checks:
 * - All words are in the BIP-39 English wordlist
 * - Checksum is valid
 * - Length is correct (12 or 24 words)
 * 
 * @param words - Array of mnemonic words
 * @returns true if valid, false otherwise
 */
export function validateMnemonic(words: string[]): boolean {
  if (!Array.isArray(words)) {
    return false;
  }
  
  // Valid lengths: 12 words (128 bits) or 24 words (256 bits)
  // BIP-39 also supports 15, 18, 21 words but we only use 12/24
  if (words.length !== 12 && words.length !== 24) {
    return false;
  }
  
  const mnemonic = words.join(' ');
  return validateMnemo(mnemonic, englishWordlist);
}

/**
 * Get word count from mnemonic strength
 */
export function strengthToWordCount(strength: MnemonicStrength): number {
  return strength === 128 ? 12 : 24;
}

/**
 * Get entropy bits from word count
 */
export function wordCountToStrength(wordCount: number): MnemonicStrength {
  if (wordCount === 12) return 128;
  if (wordCount === 24) return 256;
  throw new Error('Word count must be 12 or 24');
}
