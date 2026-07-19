import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: ['.app.github.dev'],
  },
});
