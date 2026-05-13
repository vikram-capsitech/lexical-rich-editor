import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  injectStyle: false,
  external: [
    'react',
    'react-dom',
    'lexical',
    '@lexical/code',
    '@lexical/link',
    '@lexical/list',
    '@lexical/react',
    '@lexical/rich-text',
    '@lexical/selection',
    '@lexical/table',
    '@lexical/utils',
    '@lexical/html',
    '@fluentui/react',
    '@fluentui/react-components',
    '@fluentui/react-icons',
  ],
  treeshake: true,
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.js',
    };
  },
});
