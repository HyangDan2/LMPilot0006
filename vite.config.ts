import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react()],
    // Local-only proxy for NVIDIA's hosted API. This lets the browser call the
    // same-origin Vite server, avoiding provider CORS restrictions in dev.
    server: {
      proxy: {
        '/__nvidia_api_proxy__': {
          target: 'https://integrate.api.nvidia.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__nvidia_api_proxy__/, ''),
        },
      },
    },
    // Override with VITE_BASE_PATH when deploying below a repository path.
    base: env.VITE_BASE_PATH || '/',
  };
});
