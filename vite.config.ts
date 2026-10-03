import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { keyboardIndex } from './build/keyboard-index.ts';

export default defineConfig({
  // Relative base so the build can be hosted from any path (GitHub Pages, a subfolder, ...).
  base: './',
  plugins: [react(), keyboardIndex()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
