import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@support/database': path.resolve(__dirname, 'packages/database/src/index.ts'),
      '@support/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@support/agents': path.resolve(__dirname, 'packages/agents/src/index.ts'),
      '@support/tools': path.resolve(__dirname, 'packages/tools/src/index.ts'),
    }
  },
  test: {
    globals: true,
    fileParallelism: false,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**']
  }
});
