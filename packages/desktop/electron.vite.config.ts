import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

// @moonlight/core ships its *published* build as CommonJS (for Node/Jest,
// and so `tsc` has .d.ts files to resolve against). Rollup's commonjs
// interop can't statically see through TS's `export * from './x'` barrel
// pattern in a CJS file, which breaks named imports like `WorklightStore`
// when bundling against packages/core/dist. Aliasing straight to the
// TypeScript source instead lets Vite/esbuild compile it as ESM alongside
// everything else — no interop layer, and no separate `core` build step
// needed before `electron-vite dev`.
const coreSrc = resolve(__dirname, '../core/src/index.ts');

export default defineConfig({
  main: {
    resolve: { alias: { '@moonlight/core': coreSrc } },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    resolve: { alias: { '@moonlight/core': coreSrc } },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias: { '@moonlight/core': coreSrc } },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    plugins: [react()],
  },
});
