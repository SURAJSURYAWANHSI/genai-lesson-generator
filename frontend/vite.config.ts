import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// VITE_API_PROXY_TARGET lets a second backend instance be used without editing this file.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: {
      // http-proxy streams responses as they arrive, so SSE is not buffered here.
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
