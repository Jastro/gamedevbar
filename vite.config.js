import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5148,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  }
})