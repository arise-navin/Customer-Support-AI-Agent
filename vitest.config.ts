import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@signet/database': path.resolve(__dirname, 'packages/database/src/index.ts'),
      '@signet/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@signet/agents': path.resolve(__dirname, 'packages/agents/src/index.ts'),
      '@signet/tools': path.resolve(__dirname, 'packages/tools/src/index.ts'),
      '@signet/signet-adapter': path.resolve(__dirname, 'packages/signet-adapter/src/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**']
  }
});
