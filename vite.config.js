import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5148,
    host: true,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  }
})