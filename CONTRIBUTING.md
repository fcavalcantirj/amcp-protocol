# Contributing to AMCP

Thanks for your interest in AMCP! This document provides guidelines for contributing.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/fcavalcantirj/amcp-protocol.git
cd amcp-protocol

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Project Structure

```
amcp-protocol/
├── spec/                    # Protocol specifications
├── packages/
│   ├── amcp-core/          # Identity (KERI-lite)
│   ├── amcp-memory/        # Memory checkpoints (IPLD)
│   ├── amcp-ucan/          # Capability delegation
│   └── amcp-middleware/    # LLM-safe API
└── examples/               # Integration examples
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add tests for new functionality
5. Run `pnpm test` to ensure tests pass
6. Commit with a clear message
7. Push and open a Pull Request

## Commit Messages

Use clear, descriptive commit messages:
- `feat: add key rotation to amcp-core`
- `fix: handle empty KEL in verification`
- `docs: update README with examples`
- `test: add checkpoint verification tests`

## Code Style

- TypeScript with strict mode
- ES modules (no CommonJS)
- Functional style preferred
- Document public APIs with JSDoc

## Questions?

Open an issue or reach out to the maintainers.

---

*Think like an emperor. Contribute like a pirate.* 🏴‍☠️
