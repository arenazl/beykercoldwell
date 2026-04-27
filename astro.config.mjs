import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'
import sitemap from '@astrojs/sitemap'
import node from '@astrojs/node'

// Hybrid: páginas estáticas por default, endpoints API server-rendered.
export default defineConfig({
  site: 'https://beykerbienesraices.com.ar',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({ changefreq: 'weekly', priority: 0.8, lastmod: new Date() }),
  ],
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
})
