import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5148,
    host: true,
    proxy: {
      '/ws': {
        target: 'wss://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  }
})