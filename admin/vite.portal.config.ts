import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: './tailwind.portal.config.ts' }),
        autoprefixer(),
      ],
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Output to plugin's assets/build/portal/ directory.
    outDir: path.resolve(__dirname, '../assets/build/portal'),
    emptyOutDir: true,
    cssCodeSplit: false,

    rollupOptions: {
      input: path.resolve(__dirname, './src/portal/main.tsx'),
      output: {
        format: 'iife',
        // Source repository for WordPress.org compliance (Guideline #4).
        banner: '/*! CodeClove School Management Portal — source: https://github.com/Codeclove/codeclove-school-management */',
        // Predictable filenames so PHP can reliably enqueue them.
        entryFileNames: 'index.js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo as { name?: string; names?: string[] }
          if (info.name?.endsWith('.css') || info.names?.some((n: string) => n.endsWith('.css'))) {
            return 'index.css'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },

    // Target modern browsers only.
    target: ['es2022'],

    sourcemap: false,
    minify: 'esbuild',
  },
})
