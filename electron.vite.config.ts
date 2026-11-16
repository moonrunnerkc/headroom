import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

const productionPolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Vite's dev server needs inline module preambles and a websocket; the packaged
// renderer never receives these relaxations.
const developmentPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob:",
  "connect-src 'self' ws://localhost:*",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  let policy = productionPolicy;
  return {
    name: 'headroom-content-security-policy',
    configResolved(config) {
      policy = config.command === 'serve' ? developmentPolicy : productionPolicy;
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

const commonJsOutput = {
  rolldownOptions: { output: { format: 'cjs' as const, entryFileNames: '[name].cjs' } },
};

// electron-vite requires its configuration as the module's default export.
export default defineConfig({
  main: {
    build: { ...commonJsOutput, externalizeDeps: true },
  },
  // Sandboxed preloads cannot require packages, so zod is bundled into the preload.
  preload: {
    build: { ...commonJsOutput, externalizeDeps: false },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    plugins: [react(), contentSecurityPolicy()],
    build: {
      rolldownOptions: { input: resolve(import.meta.dirname, 'src/renderer/index.html') },
    },
  },
});
