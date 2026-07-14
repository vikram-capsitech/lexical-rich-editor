import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

// The example playground displays which package version it's demoing (navbar
// badge + deprecation notice) — read from the root package.json at build time
// instead of a hand-edited string, so it can't drift out of sync with what's
// actually published on the next release.
const rootPackageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'lexical-rich-editor': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(rootPackageJson.version),
  },
});
