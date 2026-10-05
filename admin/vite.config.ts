import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Output to plugin's assets/build/admin/ directory.
    outDir: path.resolve(__dirname, '../assets/build/admin'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 4096,

    rollupOptions: {
      output: {
        format: 'iife',
        // Source repository for WordPress.org compliance (Guideline #4).
        banner: '/*! CodeClove School Management — source: https://github.com/Codeclove/codeclove-school-management */',
        // Predictable filenames so PHP can reliably enqueue them.
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo as { name?: string; names?: string[] }
          if (info.name?.endsWith('.css') || info.names?.some((n: string) => n.endsWith('.css'))) {
            return 'index.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },

    // Target modern browsers only (WP 6.5 dropped IE11 support).
    target: ['es2022'],

    sourcemap: false,
    minify: 'esbuild',
  },

  // Dev server config — only used during `npm run dev`
  server: {
    port: 5174,
    strictPort: true,
    cors: true, // ponytail: CORS is needed so WP can load dev server assets
  },
})
