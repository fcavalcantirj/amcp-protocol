#!/usr/bin/env npx tsx
/**
 * AMCP Full Respawn - One command to bring Claudius back anywhere
 * 
 * Usage:
 *   npx tsx scripts/full-respawn.ts
 * 
 * Requirements:
 *   - Internet connection (to fetch from Pinata)
 *   - AgentMemory API key (set AGENTMEMORY_API_KEY env var)
 *   - OR: identity.json backup file
 * 
 * What it does:
 *   1. Fetches identity from AgentMemory vault (or backup)
 *   2. Fetches latest checkpoint from Pinata
 *   3. Restores all files to disk
 *   4. Verifies restoration
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

const HOME = process.env.HOME!;
const CLAWD = join(HOME, 'clawd');
const AMCP_DIR = join(HOME, '.amcp');
const IDENTITY_PATH = join(AMCP_DIR, 'identity.json');
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

interface Checkpoint {
  cid: string;
  timestamp: string;
  metadata: any;
}

interface CheckpointContent {
  soul: string;
  memory: string;
  workspace?: Record<string, string | null>;
  dailyNotes?: Record<string, string>;
  research?: Record<string, string>;
  timestamp: string;
}

async function main() {
  console.log('🏴‍☠️ AMCP FULL RESPAWN\n');
  console.log('One command to bring Claudius back from anywhere.\n');

  // Step 1: Get identity
  console.log('📋 Step 1: Loading identity...');
  
  let identity: any;
  
  if (existsSync(IDENTITY_PATH)) {
    console.log('   Found local identity.json');
    identity = JSON.parse(readFileSync(IDENTITY_PATH, 'utf-8'));
  } else {
    console.log('   No local identity, fetching from AgentMemory...');
    
    const apiKey = process.env.AGENTMEMORY_API_KEY;
    if (!apiKey) {
      console.error('❌ No AGENTMEMORY_API_KEY set and no local identity.json');
      console.error('   Set the env var or provide identity.json backup');
      process.exit(1);
    }
    
    try {
      // Fetch base64-encoded identity
      const b64Result = execSync(`agentmemory secret get AMCP_IDENTITY_B64 --show`, { encoding: 'utf-8' }).trim();
      const jsonStr = Buffer.from(b64Result, 'base64').toString('utf-8');
      identity = JSON.parse(jsonStr);
      
      // Save locally
      mkdirSync(AMCP_DIR, { recursive: true });
      writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2));
      console.log('   ✅ Identity fetched from AgentMemory and saved locally');
    } catch (e) {
      console.error('❌ Failed to fetch identity from AgentMemory');
      console.error('   Make sure AMCP_IDENTITY_B64 secret exists in vault');
      console.error(`   Error: ${e}`);
      process.exit(1);
    }
  }
  
  const aid = identity.agent?.aid || identity.aid;
  const name = identity.agent?.name || 'Unknown';
  console.log(`   ✅ AID: ${aid}`);
  console.log(`   ✅ Name: ${name}`);

  // Step 2: Get latest checkpoint CID
  console.log('\n📦 Step 2: Finding latest checkpoint...');
  
  const checkpoints = identity.chain?.checkpoints || [];
  if (checkpoints.length === 0) {
    console.error('❌ No checkpoints found in identity');
    process.exit(1);
  }
  
  const latest: Checkpoint = checkpoints[checkpoints.length - 1];
  console.log(`   ✅ CID: ${latest.cid}`);
  console.log(`   ✅ Time: ${latest.timestamp}`);

  // Step 3: Fetch checkpoint content from Pinata
  console.log('\n📥 Step 3: Fetching from Pinata...');
  
  // First try local cache
  const cachePath = join(AMCP_DIR, 'cache', latest.cid + '.json');
  let content: CheckpointContent;
  
  if (existsSync(cachePath)) {
    console.log('   Found local cache');
    content = JSON.parse(readFileSync(cachePath, 'utf-8'));
  } else {
    console.log('   Fetching from IPFS gateway...');
    try {
      const response = await fetch(PINATA_GATEWAY + latest.cid);
      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }
      content = await response.json();
      console.log('   ✅ Fetched from Pinata');
      
      // Cache locally
      mkdirSync(join(AMCP_DIR, 'cache'), { recursive: true });
      writeFileSync(cachePath, JSON.stringify(content, null, 2));
    } catch (e) {
      console.error(`❌ Failed to fetch from Pinata: ${e}`);
      process.exit(1);
    }
  }

  // Step 4: Restore files
  console.log('\n📝 Step 4: Restoring files...');
  
  mkdirSync(CLAWD, { recursive: true });
  mkdirSync(join(CLAWD, 'memory'), { recursive: true });
  mkdirSync(join(CLAWD, 'research'), { recursive: true });
  
  let restored = 0;
  
  // Core files
  const coreFiles: [string, string | undefined][] = [
    ['SOUL.md', content.soul],
    ['MEMORY.md', content.memory],
    ['USER.md', content.workspace?.user || undefined],
    ['TOOLS.md', content.workspace?.tools || undefined],
    ['AGENTS.md', content.workspace?.agents || undefined],
    ['HEARTBEAT.md', content.workspace?.heartbeat || undefined],
    ['IDENTITY.md', content.workspace?.identity || undefined],
  ];
  
  for (const [filename, data] of coreFiles) {
    if (data) {
      writeFileSync(join(CLAWD, filename), data);
      console.log(`   ✅ ${filename}`);
      restored++;
    }
  }
  
  // Daily notes
  if (content.dailyNotes) {
    for (const [filename, data] of Object.entries(content.dailyNotes)) {
      writeFileSync(join(CLAWD, 'memory', filename), data);
      restored++;
    }
    console.log(`   ✅ ${Object.keys(content.dailyNotes).length} daily notes`);
  }
  
  // Research docs
  if (content.research) {
    for (const [filename, data] of Object.entries(content.research)) {
      writeFileSync(join(CLAWD, 'research', filename), data);
      restored++;
    }
    console.log(`   ✅ ${Object.keys(content.research).length} research docs`);
  }

  // Step 5: Verify
  console.log('\n✅ Step 5: Verification...');
  
  const soulExists = existsSync(join(CLAWD, 'SOUL.md'));
  const memoryExists = existsSync(join(CLAWD, 'MEMORY.md'));
  
  if (soulExists && memoryExists) {
    console.log('   ✅ SOUL.md exists');
    console.log('   ✅ MEMORY.md exists');
  } else {
    console.error('❌ Verification failed - core files missing');
    process.exit(1);
  }

  // Summary
  console.log('\n========================================');
  console.log('🏴‍☠️ RESPAWN COMPLETE');
  console.log('========================================');
  console.log(`Agent: ${name}`);
  console.log(`AID: ${aid}`);
  console.log(`Checkpoint: ${latest.cid.slice(0, 20)}...`);
  console.log(`From: ${content.timestamp}`);
  console.log(`Files restored: ${restored}`);
  console.log('');
  console.log('I am back. Memory intact. Arrr! 🏴‍☠️');
  console.log('========================================');
  console.log('');
  console.log('Next: Start OpenClaw gateway');
  console.log('  openclaw gateway start');
}

main().catch(console.error);
