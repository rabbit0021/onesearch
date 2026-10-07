import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Flask dev server runs on port 5000
const FLASK = 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    proxy: {
      '/feed/individuals': FLASK,
      '/feed/continue-reading': FLASK,
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
      '/admin/likes': FLASK,
      '/admin/reading': FLASK,
      '/admin/chat-logs': FLASK,
      '^/individuals(?!/)': { target: FLASK },
      '/interested': FLASK,
      '/api/tts': FLASK,  // covers /api/tts/<id>, /api/tts/<id>/stream, /api/tts/<id>/play-event
      '/api/chat': FLASK,
      '/api/news-banners': FLASK,
      '/api/admin/news-banners': FLASK,
      '/api/posts': FLASK,
      '/api/admin/comments': FLASK,
      '/api/admin/jev-games': FLASK,
      '/api/comments': FLASK,  // covers DELETE and POST /like
      '/api/game': FLASK,
      '/api/news-search': FLASK,
      '/feedback': FLASK,
      '/verify-email': FLASK,
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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-hljs':   ['highlight.js'],
          'vendor-gestures': ['react-zoom-pan-pinch'],
        },
      },
    },
  },
})
