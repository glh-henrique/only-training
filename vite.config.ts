import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { readFileSync } from 'node:fs'

// Upload de source maps só quando o token existe (CI); build local fica igual.
const sentryEnabled = !!process.env.SENTRY_AUTH_TOKEN

// Lê a versão direto do package.json no momento do build (robusto: pega o valor
// já bumpado pelo predeploy, sem depender da env var npm_package_version).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: '/',
  build: {
    sourcemap: sentryEnabled, // gerado só p/ upload; os .map são apagados antes do deploy
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@sentry')) return 'sentry'
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n'
          if (id.includes('date-fns')) return 'date'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('react-router')) return 'router'
          return 'vendor'
        }
      }
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        id: '/',
        name: 'OnlyTraining',
        short_name: 'OnlyTraining',
        description: 'Seu app de treino definitivo',
        lang: 'pt-BR',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/?source=pwa',
        scope: '/',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            // TODO(T2): substituir por um PNG maskable dedicado com safe-zone
            // (ícone ocupando ~80% central). Gerar em https://maskable.app
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      }
    }),
    sentryEnabled && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // gh-pages é público: sobe os maps pro Sentry e apaga do dist
      sourcemaps: { filesToDeleteAfterUpload: 'dist/**/*.map' },
    })
  ],
})
