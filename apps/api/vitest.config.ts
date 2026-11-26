import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Sidequest is a process-wide singleton; run test files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    server: {
      deps: {
        // Sidequest's inline runner import()s PrintJob itself. Processing Sidequest through Vitest makes that import
        // resolve to the same module instance the tests (and PrintQueue) use, as tsx does in production.
        inline: [/sidequest/],
      },
    },
  },
});
