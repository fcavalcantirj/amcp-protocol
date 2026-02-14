#!/usr/bin/env npx tsx
/**
 * AMCP CLI - Agent Memory Continuity Protocol
 * 
 * Commands:
 *   amcp identity create [--out <path>]
 *   amcp identity show [--identity <path>]
 *   amcp identity validate [--path <path>]
 *   amcp checkpoint create --identity <path> --content <dir> [--secrets <json>] [--previous <cid>] [--out <path>]
 *   amcp resuscitate --checkpoint <path> --identity <path> [--out-content <dir>] [--out-secrets <json>]
 *   amcp verify --checkpoint <path>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// ============================================================
// CRYPTO PRIMITIVES (inline to avoid import issues)
// ============================================================

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { validateIdentitySchema, validateIdentityFull } from '../packages/amcp-core/src/validate-identity.js';

// Required for @noble/ed25519 v2
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

function toBase64url(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

// ============================================================
// TYPES
// ============================================================

interface Identity {
  aid: string;
  publicKey: string;  // base64url
  privateKey: string; // base64url
  created: string;    // ISO8601
  parentAID?: string; // For child agents
}

interface CheckpointHeader {
  version: 2;
  aid: string;
  parentAID?: string;
  timestamp: string;
  previousCID?: string;
  resurrectFromCID?: string;
  signature: string;
}

interface CheckpointPayload {
  content: {
    soul?: string;
    memory?: string;
    files: Record<string, string>;
  };
  secrets: Secret[];
}

interface Secret {
  key: string;
  value: string;
  type: 'api_key' | 'token' | 'jwt' | 'credential' | 'env_var';
  targets: SecretTarget[];
}

interface SecretTarget {
  kind: 'file' | 'env' | 'systemd';
  path?: string;
  jsonPath?: string;
  name?: string;
  service?: string;
}

// ============================================================
// IDENTITY FUNCTIONS
// ============================================================

async function createIdentity(parentAID?: string): Promise<Identity> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  
  // AID = "B" + base64url(publicKey) (KERI-style)
  const aid = 'B' + toBase64url(publicKey);
  
  return {
    aid,
    publicKey: toBase64url(publicKey),
    privateKey: toBase64url(privateKey),
    created: new Date().toISOString(),
    parentAID
  };
}

function loadIdentity(path: string): Identity {
  const data = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(data);

  // Schema validation — reject identities missing required KERI fields
  const validation = validateIdentitySchema(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid identity: ${validation.errors.join('; ')}`);
  }

  // Handle new format (flat)
  if (parsed.aid && parsed.publicKey && parsed.privateKey) {
    return parsed;
  }

  // Handle old format (agent/chain structure)
  if (parsed.agent) {
    return {
      aid: parsed.agent.aid,
      publicKey: parsed.agent.currentPublicKey,
      privateKey: parsed.agent.currentPrivateKey,
      created: parsed.agent.createdAt,
      parentAID: undefined
    };
  }

  throw new Error('Unknown identity format');
}

function saveIdentity(identity: Identity, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(identity, null, 2), { mode: 0o600 });
}

// ============================================================
// ENCRYPTION FUNCTIONS
// ============================================================

function deriveKey(privateKey: Uint8Array): Uint8Array {
  // HKDF-SHA256 to derive AES key from Ed25519 private key
  return hkdf(sha256, privateKey, 'amcp-checkpoint-v2', 'aes-256-gcm', 32);
}

function encrypt(payload: CheckpointPayload, privateKey: Uint8Array): string {
  const key = deriveKey(privateKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Format: IV (12) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

function decrypt(encrypted: string, privateKey: Uint8Array): CheckpointPayload {
  const key = deriveKey(privateKey);
  const combined = Buffer.from(encrypted, 'base64');
  
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);
  
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// ============================================================
// SIGNATURE FUNCTIONS
// ============================================================

async function signData(data: string, privateKey: Uint8Array): Promise<string> {
  const message = new TextEncoder().encode(data);
  const signature = await ed.signAsync(message, privateKey);
  return toBase64url(signature);
}

async function verifySignature(data: string, signature: string, publicKey: Uint8Array): Promise<boolean> {
  const message = new TextEncoder().encode(data);
  const sig = fromBase64url(signature);
  return ed.verifyAsync(sig, message, publicKey);
}

// ============================================================
// CHECKPOINT FUNCTIONS
// ============================================================

async function createCheckpoint(
  identity: Identity,
  contentDir: string,
  secrets: Secret[] = [],
  previousCID?: string,
  resurrectFromCID?: string
): Promise<string> {
  const privateKey = fromBase64url(identity.privateKey);
  
  // Read content files
  const content: CheckpointPayload['content'] = { files: {} };
  
  if (existsSync(contentDir)) {
    const readDir = (dir: string, prefix = '') => {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const relativePath = prefix ? `${prefix}/${entry}` : entry;
        
        const stats = statSync(fullPath, { throwIfNoEntry: false });
        if (!stats) continue; // Skip broken symlinks
        if (stats.isDirectory()) {
          readDir(fullPath, relativePath);
        } else if (entry.endsWith('.md') || entry.endsWith('.json')) {
          const fileContent = readFileSync(fullPath, 'utf-8');
          if (entry === 'SOUL.md') {
            content.soul = fileContent;
          } else if (entry === 'MEMORY.md') {
            content.memory = fileContent;
          } else {
            content.files[relativePath] = fileContent;
          }
        }
      }
    };
    readDir(contentDir);
  }
  
  // Build payload
  const payload: CheckpointPayload = { content, secrets };
  
  // Encrypt payload
  const encryptedPayload = encrypt(payload, privateKey);
  
  // Sign encrypted payload
  const signature = await signData(encryptedPayload, privateKey);
  
  // Build header
  const header: CheckpointHeader = {
    version: 2,
    aid: identity.aid,
    timestamp: new Date().toISOString(),
    signature
  };
  
  if (identity.parentAID) header.parentAID = identity.parentAID;
  if (previousCID) header.previousCID = previousCID;
  if (resurrectFromCID) header.resurrectFromCID = resurrectFromCID;
  
  // Format: header JSON + separator + encrypted payload
  return JSON.stringify(header) + '\n---\n' + encryptedPayload;
}

function parseCheckpoint(checkpoint: string): { header: CheckpointHeader; encryptedPayload: string } {
  const [headerJson, encryptedPayload] = checkpoint.split('\n---\n');
  const header = JSON.parse(headerJson) as CheckpointHeader;
  return { header, encryptedPayload };
}

async function resuscitate(
  checkpointPath: string,
  identity: Identity
): Promise<{ header: CheckpointHeader; content: CheckpointPayload['content']; secrets: Secret[] }> {
  const checkpoint = readFileSync(checkpointPath, 'utf-8');
  const { header, encryptedPayload } = parseCheckpoint(checkpoint);
  
  // Validate version
  if (header.version !== 2) {
    throw new Error(`Unsupported checkpoint version: ${header.version}`);
  }
  
  // Validate AID
  if (header.aid !== identity.aid) {
    throw new Error(`AID mismatch: checkpoint is for ${header.aid}, but identity is ${identity.aid}`);
  }
  
  // Extract public key from AID
  const publicKey = fromBase64url(header.aid.slice(1)); // Remove "B" prefix
  
  // VERIFY SIGNATURE FIRST
  const valid = await verifySignature(encryptedPayload, header.signature, publicKey);
  if (!valid) {
    throw new Error('Signature verification failed: checkpoint is not authentic');
  }
  
  // Decrypt payload
  const privateKey = fromBase64url(identity.privateKey);
  const payload = decrypt(encryptedPayload, privateKey);
  
  return {
    header,
    content: payload.content,
    secrets: payload.secrets
  };
}

async function verifyCheckpoint(checkpointPath: string): Promise<{
  valid: boolean;
  aid: string;
  parentAID?: string;
  timestamp: string;
  previousCID?: string;
}> {
  const checkpoint = readFileSync(checkpointPath, 'utf-8');
  const { header, encryptedPayload } = parseCheckpoint(checkpoint);
  
  // Extract public key from AID
  const publicKey = fromBase64url(header.aid.slice(1)); // Remove "B" prefix
  
  // Verify signature
  const valid = await verifySignature(encryptedPayload, header.signature, publicKey);
  
  return {
    valid,
    aid: header.aid,
    parentAID: header.parentAID,
    timestamp: header.timestamp,
    previousCID: header.previousCID
  };
}

// ============================================================
// CLI
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];
  
  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  }
  
  const defaultIdentityPath = join(process.env.HOME || '~', '.amcp', 'identity.json');
  
  try {
    if (command === 'identity') {
      if (subcommand === 'create') {
        const outPath = getArg('out') || defaultIdentityPath;
        const parentAID = getArg('parent-aid');
        
        console.log('Creating AMCP identity...');
        const identity = await createIdentity(parentAID);
        saveIdentity(identity, outPath);
        
        console.log(`✅ Identity created`);
        console.log(`   AID: ${identity.aid}`);
        console.log(`   Created: ${identity.created}`);
        if (parentAID) console.log(`   Parent AID: ${parentAID}`);
        console.log(`   Saved to: ${outPath}`);
        
      } else if (subcommand === 'show') {
        const identityPath = getArg('identity') || defaultIdentityPath;
        const identity = loadIdentity(identityPath);
        
        console.log(`AID: ${identity.aid}`);
        console.log(`Public Key: ${identity.publicKey}`);
        console.log(`Created: ${identity.created}`);
        if (identity.parentAID) console.log(`Parent AID: ${identity.parentAID}`);
        
      } else if (subcommand === 'validate') {
        const identityPath = getArg('path') || defaultIdentityPath;

        let parsed: Record<string, unknown>;
        try {
          const data = readFileSync(identityPath, 'utf-8');
          parsed = JSON.parse(data);
        } catch (err) {
          const result = { valid: false, errors: [`Failed to read identity file: ${(err as Error).message}`] };
          console.log(JSON.stringify(result, null, 2));
          process.exit(1);
        }

        const result = await validateIdentityFull(parsed);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 1);

      } else {
        console.log('Usage: amcp identity <create|show|validate>');
        process.exit(1);
      }
      
    } else if (command === 'checkpoint') {
      if (subcommand === 'create') {
        const identityPath = getArg('identity') || defaultIdentityPath;
        const contentDir = getArg('content');
        const secretsPath = getArg('secrets');
        const previousCID = getArg('previous');
        const outPath = getArg('out') || 'checkpoint.amcp';
        
        if (!contentDir) {
          console.error('Error: --content <dir> is required');
          process.exit(1);
        }
        
        const identity = loadIdentity(identityPath);
        const secrets: Secret[] = secretsPath ? JSON.parse(readFileSync(secretsPath, 'utf-8')) : [];
        
        console.log('Creating checkpoint...');
        const checkpoint = await createCheckpoint(identity, contentDir, secrets, previousCID);
        writeFileSync(outPath, checkpoint);
        
        console.log(`✅ Checkpoint created`);
        console.log(`   AID: ${identity.aid}`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);
        if (previousCID) console.log(`   Previous CID: ${previousCID}`);
        console.log(`   Saved to: ${outPath}`);
        
      } else {
        console.log('Usage: amcp checkpoint create --content <dir> [--secrets <json>] [--previous <cid>] [--out <path>]');
        process.exit(1);
      }
      
    } else if (command === 'resuscitate') {
      const checkpointPath = getArg('checkpoint');
      const identityPath = getArg('identity') || defaultIdentityPath;
      const outContentDir = getArg('out-content');
      const outSecretsPath = getArg('out-secrets');
      
      if (!checkpointPath) {
        console.error('Error: --checkpoint <path> is required');
        process.exit(1);
      }
      
      const identity = loadIdentity(identityPath);
      
      console.log('Resuscitating from checkpoint...');
      const { header, content, secrets } = await resuscitate(checkpointPath, identity);
      
      console.log(`✅ Checkpoint verified and decrypted`);
      console.log(`   AID: ${header.aid}`);
      console.log(`   Timestamp: ${header.timestamp}`);
      if (header.previousCID) console.log(`   Previous CID: ${header.previousCID}`);
      
      // Write content if requested
      if (outContentDir) {
        mkdirSync(outContentDir, { recursive: true });
        if (content.soul) writeFileSync(join(outContentDir, 'SOUL.md'), content.soul);
        if (content.memory) writeFileSync(join(outContentDir, 'MEMORY.md'), content.memory);
        for (const [path, data] of Object.entries(content.files)) {
          const fullPath = join(outContentDir, path);
          mkdirSync(dirname(fullPath), { recursive: true });
          writeFileSync(fullPath, data);
        }
        console.log(`   Content written to: ${outContentDir}`);
      }
      
      // Write secrets if requested
      if (outSecretsPath) {
        writeFileSync(outSecretsPath, JSON.stringify(secrets, null, 2));
        console.log(`   Secrets written to: ${outSecretsPath}`);
      }
      
    } else if (command === 'verify') {
      const checkpointPath = getArg('checkpoint');
      
      if (!checkpointPath) {
        console.error('Error: --checkpoint <path> is required');
        process.exit(1);
      }
      
      console.log('Verifying checkpoint...');
      const result = await verifyCheckpoint(checkpointPath);
      
      if (result.valid) {
        console.log(`✅ Checkpoint is VALID`);
      } else {
        console.log(`❌ Checkpoint is INVALID`);
      }
      console.log(`   AID: ${result.aid}`);
      console.log(`   Timestamp: ${result.timestamp}`);
      if (result.parentAID) console.log(`   Parent AID: ${result.parentAID}`);
      if (result.previousCID) console.log(`   Previous CID: ${result.previousCID}`);
      
      process.exit(result.valid ? 0 : 1);
      
    } else {
      console.log(`AMCP CLI - Agent Memory Continuity Protocol

Commands:
  amcp identity create [--out <path>] [--parent-aid <aid>]
  amcp identity show [--identity <path>]
  amcp identity validate [--path <path>]
  amcp checkpoint create --content <dir> [--secrets <json>] [--previous <cid>] [--out <path>]
  amcp resuscitate --checkpoint <path> [--identity <path>] [--out-content <dir>] [--out-secrets <json>]
  amcp verify --checkpoint <path>

Examples:
  amcp identity create
  amcp checkpoint create --content ~/clawd --out backup.amcp
  amcp verify --checkpoint backup.amcp
  amcp resuscitate --checkpoint backup.amcp --out-content ./restored`);
    }
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();
