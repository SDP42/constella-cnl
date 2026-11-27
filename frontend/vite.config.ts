import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true, ws: true },
    },
  },
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1600,
    // No manual chunks: three.js and MapLibre are only reached through lazy imports, so the bundler already splits
    // them out. A manual rule here also dragged shared modules (React internals, stores) into the 3D chunk, which
    // forced every page, even the inbox, to download all of three.js up front.
  },
})
