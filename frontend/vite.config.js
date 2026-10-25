import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,jsx}'],
    css: false,
    // Some tests render whole pages; a busy machine can exceed the 5 s default.
    testTimeout: 15000,
  },
})
