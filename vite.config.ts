import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// public/manifest.json is the single source of truth for the PWA metadata
const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('./public/manifest.json', import.meta.url)), 'utf8'),
)

/**
 * The Supabase project's URL and public key, under whichever name they were
 * set: our own VITE_* names, or the ones the Supabase integration on Vercel
 * creates. The first one set wins.
 */
const SUPABASE_ENV = {
  VITE_SUPABASE_URL: ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  VITE_SUPABASE_ANON_KEY: [
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
  ],
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const define = Object.fromEntries(
    Object.entries(SUPABASE_ENV).map(([name, sources]) => [
      `import.meta.env.${name}`,
      JSON.stringify(sources.map((s) => env[s]).find(Boolean) ?? ''),
    ]),
  )
  return {
    define,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        },
      }),
    ],
  }
})
