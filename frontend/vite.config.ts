import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Explicitly tell the HMR client which port to use for WebSocket.
    // Without this, remote browsers may try ws://localhost:5173 and fail,
    // causing them to serve stale cached JS after each code change.
    hmr: {
      clientPort: 5173,
    },
    // No-store so remote laptops always get fresh code on hard-refresh.
    headers: {
      'Cache-Control': 'no-store',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
