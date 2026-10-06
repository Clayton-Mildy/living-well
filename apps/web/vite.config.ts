import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the Hono server (SSE included). allowedHosts lets a Cloudflare quick tunnel
// (https://*.trycloudflare.com) reach the dev server; set VITE_HMR_CLIENT_PORT=443 when tunnelling dev.
const hmrPort = process.env.VITE_HMR_CLIENT_PORT ? Number(process.env.VITE_HMR_CLIENT_PORT) : undefined;
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT || 5173),
    strictPort: true,
    allowedHosts: ['localhost', '.trycloudflare.com', '.cfargotunnel.com', '.local'],
    hmr: hmrPort ? { clientPort: hmrPort } : undefined,
    proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 8787}`, changeOrigin: false } },
  },
  preview: { port: 5173, allowedHosts: ['localhost', '.trycloudflare.com', '.cfargotunnel.com'] },
  build: { outDir: 'dist', sourcemap: true },
});
