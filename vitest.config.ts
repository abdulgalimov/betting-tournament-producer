import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: [
      '**/*.integration.test.ts',
      '**/*.e2e.test.ts',
      'test/e2e.test.ts',
    ],
    testTimeout: 10000,
  },
});
