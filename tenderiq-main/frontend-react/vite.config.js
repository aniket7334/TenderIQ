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
    // Same as Vercel in production: the API is reached on the site's own address,
    // so the HttpOnly login cookies are first-party
    proxy: {
      '/api/v1': { target: 'http://localhost:8000', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
