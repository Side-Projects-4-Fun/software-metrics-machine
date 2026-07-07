import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node25',
  platform: 'node',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  dts: true,
  external: ['node:sqlite'],
  removeNodeProtocol: false,
  noExternal: ['@smmachine/core', '@smmachine/utils', '@smmachine/mcp'],
  outExtension() {
    return {
      js: '.cjs',
    };
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
});
