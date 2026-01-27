import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';

const aurafallRoot = fileURLToPath(new URL('../../packages/aurelia2-aurafall', import.meta.url));
const aurafallDist = fileURLToPath(new URL('../../packages/aurelia2-aurafall/dist/index.js', import.meta.url));
const exampleRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  server: {
    open: !process.env.CI,
    port: 9002,
    fs: {
      allow: [exampleRoot, aurafallRoot],
    },
  },
  resolve: {
    alias: {
      'aurelia2-aurafall': aurafallDist,
    },
  },
  esbuild: {
    target: 'es2022',
  },
  plugins: [
    aurelia({
      useDev: true,
      include: 'src/**/*.{ts,js,html}',
    }),
  ],
});
