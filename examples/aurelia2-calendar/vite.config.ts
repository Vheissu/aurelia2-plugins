import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';

const calendarRoot = fileURLToPath(new URL('../../packages/aurelia2-calendar', import.meta.url));
const calendarDist = fileURLToPath(new URL('../../packages/aurelia2-calendar/dist/index.js', import.meta.url));
const exampleRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  server: {
    open: !process.env.CI,
    port: 9001,
    fs: {
      allow: [exampleRoot, calendarRoot],
    },
  },
  resolve: {
    alias: {
      'aurelia2-calendar': calendarDist,
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
