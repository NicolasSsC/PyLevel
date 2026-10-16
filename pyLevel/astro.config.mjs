// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  vite: {
    server: {
      proxy: {
        '/api/execute': 'http://127.0.0.1:8787',
        '/api/health': 'http://127.0.0.1:8787',
      },
    },
  },
});
