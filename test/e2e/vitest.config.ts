/**
 * Vitest configuration for E2E tests
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globals: true,
    testTimeout: 30000, // 30s for E2E tests
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@amcp/core': resolve(__dirname, '../../packages/amcp-core/dist/index.js'),
      '@amcp/memory': resolve(__dirname, '../../packages/amcp-memory/dist/index.js'),
      '@amcp/recovery': resolve(__dirname, '../../packages/amcp-recovery/dist/index.js'),
    }
  }
});
