import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts',
  },
  format: ['cjs'],
  target: 'node25',
  platform: 'node',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  dts: true,
  external: ['node:sqlite'],
  removeNodeProtocol: false,
  noExternal: ['@smmachine/core', '@smmachine/utils'],
  outExtension() {
    return {
      js: '.cjs',
    };
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
});
