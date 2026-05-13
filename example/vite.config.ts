import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

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
});
