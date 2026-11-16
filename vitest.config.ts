import { defineConfig } from 'vitest/config';

// Vitest requires its configuration as the module's default export.
export default defineConfig({
  test: {
    restoreMocks: true,
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.test.ts'] } },
      {
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/ui/**/*.test.tsx'],
          setupFiles: ['tests/ui/setup.ts'],
        },
      },
    ],
  },
});
