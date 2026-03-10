import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './test/setup.ts',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
