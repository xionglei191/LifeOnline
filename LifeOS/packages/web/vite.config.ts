import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiHost = process.env.LIFEOS_API_HOST || '192.168.31.246';
const apiPort = process.env.LIFEOS_API_PORT || '3000';
const apiHttpTarget = `http://${apiHost}:${apiPort}`;
const apiWsTarget = `ws://${apiHost}:${apiPort}`;

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': apiHttpTarget,
      '/ws': {
        target: apiWsTarget,
        ws: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/zrender')) {
            return 'zrender';
          }
          if (id.includes('node_modules/echarts')) {
            return 'echarts';
          }
        }
      }
    }
  }
});
