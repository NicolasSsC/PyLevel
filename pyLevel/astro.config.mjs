// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)), quiet: true });
const appOrigin = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN) : undefined;
if (appOrigin && !['http:', 'https:'].includes(appOrigin.protocol)) throw new Error('APP_ORIGIN debe ser una URL HTTP o HTTPS.');

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: {
    // Astro validates Host before constructing Request.url used by CSRF checks.
    allowedDomains: [
      { hostname: 'localhost', protocol: 'http' },
      { hostname: '127.0.0.1', protocol: 'http' },
      ...(appOrigin ? [{ hostname: appOrigin.hostname, protocol: appOrigin.protocol.slice(0, -1), port: appOrigin.port }] : []),
    ],
  },
  vite: {
    plugins: [
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api/execute': 'http://127.0.0.1:8787',
        '/api/health': 'http://127.0.0.1:8787',
      },
    },
  },
});
