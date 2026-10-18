import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { name: 'domain', environment: 'node', include: ['src/**/*.test.ts'] } },
      { extends: true, test: { name: 'ui', environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.tsx'] } },
    ],
  },
});
