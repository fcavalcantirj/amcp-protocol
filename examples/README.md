# AMCP Examples

Working code samples demonstrating the AMCP protocol.

## Examples

| File | Description | Packages Used |
|------|-------------|---------------|
| [01-create-agent.ts](./01-create-agent.ts) | Create agent with BIP-39 mnemonic | `@amcp/core` |
| [02-checkpoint.ts](./02-checkpoint.ts) | Create memory checkpoint with full state | `@amcp/core`, `@amcp/memory` |
| [03-recovery.ts](./03-recovery.ts) | Disaster recovery flow | `@amcp/core`, `@amcp/memory`, `@amcp/recovery` |
| [04-exchange.ts](./04-exchange.ts) | Platform migration (export/import) | `@amcp/core`, `@amcp/memory`, `@amcp/exchange` |

## Running Examples

```bash
# Install dependencies
cd amcp-protocol
pnpm install

# Build packages
pnpm build

# Run an example
npx ts-node examples/01-create-agent.ts
```

## Quick Reference

### Create Agent
```typescript
import { createAgent, generateMnemonic, keypairFromMnemonic } from '@amcp/core';

const mnemonic = generateMnemonic(128);  // 12 words
const keypair = keypairFromMnemonic(mnemonic);
const agent = await createAgent({ keypair });
```

### Encrypt Secrets
```typescript
import { encryptSecrets, decryptSecrets } from '@amcp/memory';

const encrypted = encryptSecrets({ API_KEY: 'secret' }, agent.publicKey);
const decrypted = decryptSecrets(encrypted, agent.privateKey);
```

### Store Checkpoint
```typescript
import { FilesystemBackend, createCheckpoint } from '@amcp/memory';

const checkpoint = await createCheckpoint(agent, content);
const storage = new FilesystemBackend({ basePath: '~/.amcp' });
await storage.put(checkpoint.data);
```

### Generate Recovery Card
```typescript
import { generateRecoveryCard, formatRecoveryCard } from '@amcp/recovery';

const card = generateRecoveryCard(mnemonic, agent.aid, checkpoint.cid, 'ipfs');
console.log(formatRecoveryCard(card));
```

### Export/Import Bundle
```typescript
import { exportAgent, importAgent } from '@amcp/exchange';

// Export
const bundle = await exportAgent(agent, checkpoint, secrets, services);

// Import
const { agent, secrets } = await importAgent(bundle, privateKey);
```

## Research Backing

Each example includes comments citing the research that informed the design:

- **BIP-39 (Bitcoin 2013)**: Mnemonic key derivation
- **KERI (arXiv:1907.02143)**: Self-certifying identifiers
- **IPLD**: Content-addressed data
- **Affective Computing (Picard 1997)**: Subjective state
- **Context-Aware Computing (Dey 2001)**: Ambient context
- **Zeigarnik Effect (1927)**: Work in progress
- **NIST SP 800-34**: Disaster recovery
- **GDPR Article 20**: Data portability

See [research-backing.md](../specs/research-backing.md) for complete citations.
