// @ts-check
import { defineConfig } from 'astro/config';






/// https://astro.build/config
export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  output: 'static',
  vite: {

    server: {
      allowedHosts: ['.sslip.io', 'famores.com', '.famores.com'],
    },
    preview: {
      allowedHosts: ['.sslip.io', 'famores.com', '.famores.com'],
    },
  },
});
