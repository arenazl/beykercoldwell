import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'
import node from '@astrojs/node'
import netlify from '@astrojs/netlify'

/**
 * Selección de adapter por env:
 *   DEPLOY_TARGET=netlify  → @astrojs/netlify (Netlify Functions)
 *   DEPLOY_TARGET=heroku   → @astrojs/node (server standalone)
 *   sin set                → @astrojs/node (default — dev local + Heroku)
 *
 * Netlify setea DEPLOY_TARGET en netlify.toml, Heroku no necesita nada extra.
 */
const target = process.env.DEPLOY_TARGET ?? 'node'
const adapter = target === 'netlify' ? netlify() : node({ mode: 'standalone' })

export default defineConfig({
  site: 'https://beykerbienesraices.com.ar',
  integrations: [
    tailwind({ applyBaseStyles: false }),
  ],
  output: 'hybrid',
  adapter,
})
