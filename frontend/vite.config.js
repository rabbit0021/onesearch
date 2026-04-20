import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Flask dev server runs on port 5000
const FLASK = 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    proxy: {
      '/feed': FLASK,
      '/subscribe': FLASK,
      '/techteams': FLASK,
      '/subscriptions_for_email': FLASK,
      '/posts': FLASK,
      '/publishers': FLASK,
      '/subscriptions': FLASK,
      '/admin/jobs': { target: FLASK, changeOrigin: false },
      '/admin/notifications': FLASK,
      '/admin/tempdata': FLASK,
      '/interested': FLASK,
      '/feedback': FLASK,
      '/static': FLASK,
      '/auth': {
        target: FLASK,
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
