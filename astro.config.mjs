// @ts-nocheck
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
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
    site: 'http://ggggs0kkwoo4s0wckg4wcks0.72.62.165.86.sslip.io',
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
