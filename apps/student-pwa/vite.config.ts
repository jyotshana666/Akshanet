import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Akshanet',
        short_name: 'Akshanet',
        description: 'APAAR ID Student Portal',
        theme_color: '#1A3C6E',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/student\/me$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'student-profile', expiration: { maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /\/api\/v1\/notifications\/mine$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'student-notifications', expiration: { maxAgeSeconds: 1800 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
