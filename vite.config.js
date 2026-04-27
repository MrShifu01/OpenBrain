import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// Sentry source-map upload only runs when ALL three env vars are present.
// In Vercel: add SENTRY_AUTH_TOKEN (Sentry → Settings → Auth Tokens, scope
// project:write), SENTRY_ORG (slug), and SENTRY_PROJECT (slug). Without
// them the plugin is a no-op so local + preview builds keep working.
const sentryEnabled = !!(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
)

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://everion.smashburgerbar.co.za',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Sentry needs source maps to symbolicate stack traces. We emit them
    // and let the plugin upload + delete after upload so they don't ship
    // to the public bundle.
    sourcemap: sentryEnabled ? true : false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase';
          if (id.includes('/node_modules/@sentry/')) return 'sentry';
          // pdfjs/mammoth/exceljs are dynamically imported in fileExtract.ts.
          // Letting Vite auto-chunk them keeps small shared utilities out of
          // the eagerly-modulepreloaded set — manual chunking these would
          // pin shared utility modules into a "named" chunk that the entry
          // statically pulls (~120KB gzip pdfjs preload regression we saw in
          // the bundle audit).
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    sentryEnabled && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Strip source maps from the public bundle after upload. Stack
      // traces remain readable inside Sentry; visitors can't fetch them.
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      telemetry: false,
    }),
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
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/.claude/**',
      '**/e2e/**',
    ],
  },
})
