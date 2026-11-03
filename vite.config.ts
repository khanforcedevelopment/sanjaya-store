/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/** Points /sitemap.xml at the sitemap server function of the configured Supabase project. */
function sitemapRedirect(supabaseUrl: string): Plugin {
  return {
    name: 'sitemap-redirect',
    apply: 'build',
    closeBundle() {
      if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseUrl)) return
      const file = 'dist/_redirects'
      const rules = readFileSync(file, 'utf8')
      if (!rules.includes('/sitemap.xml')) writeFileSync(file, `/sitemap.xml  ${supabaseUrl}/functions/v1/sitemap  200\n${rules}`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), sitemapRedirect(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL ?? '')],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // unit tests always run as if no backend is configured, whatever .env.local says
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_STRIPE_PUBLISHABLE_KEY: '' },
  },
}))
