// @ts-nocheck
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://famores.com',
  devToolbar: {
    enabled: false,
  },
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    host: true,
    port: 3000,
  },
  vite: {
    server: {
      allowedHosts: ['.sslip.io', 'famores.com', '.famores.com'],
    },
    preview: {
      allowedHosts: ['.sslip.io', 'famores.com', '.famores.com'],
    },
  },
});
