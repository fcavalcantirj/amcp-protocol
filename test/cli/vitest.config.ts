/**
 * Vitest configuration for CLI tests
 *
 * NO workspace aliases — these tests must work without monorepo resolution,
 * simulating the standalone deployment environment on child VMs.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globals: true,
    testTimeout: 30000,
  }
});
