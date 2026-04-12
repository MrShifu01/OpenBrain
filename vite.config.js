import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: [
      // Cosmograph internals: CSS modules are pre-compiled as .css.js
      { find: /^@\/cosmograph\/(.*)\.css$/, replacement: path.resolve(__dirname, 'node_modules/@cosmograph/cosmograph/cosmograph/$1.css.js') },
      // gl-bench ships CJS by default — point to its ESM build so rolldown gets a default export
      { find: 'gl-bench', replacement: path.resolve(__dirname, 'node_modules/gl-bench/dist/gl-bench.module.js') },
      // App-level @ alias
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  optimizeDeps: {
    include: ['@cosmograph/react', '@cosmograph/cosmograph'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://everion.smashburgerbar.co.za',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      manifest: {
        name: 'Everion',
        short_name: 'Everion',
        description: "Chris's personal memory & knowledge OS",
        theme_color: '#0f0f23',
        background_color: '#0f0f23',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**', '**/.claude/**'],
  },
})
