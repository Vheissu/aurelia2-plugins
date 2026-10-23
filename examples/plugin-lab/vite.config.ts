import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';

export default defineConfig({
  server: { port: 9010, strictPort: true, fs: { allow: ['../..'] } },
  // Linked packages and the app must use the same Aurelia runtime.
  resolve: {
    dedupe: [
      'aurelia',
      '@aurelia/kernel',
      '@aurelia/runtime',
      '@aurelia/runtime-html',
      '@aurelia/platform',
      '@aurelia/platform-browser',
      '@aurelia/template-compiler',
    ],
  },
  build: { target: 'es2022' },
  plugins: [aurelia()],
});
