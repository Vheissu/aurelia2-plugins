import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';

export default defineConfig({
  server: {
    open: !process.env.CI,
    port: 9000,
  },
  oxc: {
    target: 'es2022'
  },
  plugins: [
    aurelia({
      useDev: true,
    }),
  ],
});
