import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';
export default defineConfig({
  server: { port: 9011, strictPort: true, fs: { allow: ['../..'] } },
  resolve: {
    dedupe: [
      'aurelia',
      '@aurelia/kernel',
      '@aurelia/runtime',
      '@aurelia/runtime-html',
      '@aurelia/platform',
      '@aurelia/platform-browser',
      '@aurelia/template-compiler',
      '@aurelia/router',
    ],
  },
  build: { target: 'es2022' },
  plugins: [aurelia()],
});
