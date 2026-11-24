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
    // Listen on all interfaces (IPv4 + IPv6) so http://localhost:5173 works in every browser
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
