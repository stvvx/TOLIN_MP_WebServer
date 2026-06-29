import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      // force the browser build
    },
  },
  optimizeDeps: {
    include: ['mqtt'],
  },
  define: {
    global: 'globalThis', // mqtt uses `global` internally
  },
})