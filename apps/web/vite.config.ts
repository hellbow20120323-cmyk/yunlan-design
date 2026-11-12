import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Cloudflare 上部分账户/WAF 会误拦 /assets/*，改用独立目录
    build: {
      assetsDir: 'yl',
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        // 开发环境下让 /velo 与线上网关保持一致，直接返回静态工坊入口
        name: 'velo-pretty-url',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            const url = req.url || '';
            if (url === '/velo' || url === '/velo/') {
              req.url = '/velo/index.html';
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
