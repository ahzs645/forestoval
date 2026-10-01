import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The engine and its artwork live in bc-ministry-primitives-v5/, the generated
// primitives one level up; allow Vite to read the whole checkout.
const workspace = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  server: { fs: { allow: [workspace] } },
});
