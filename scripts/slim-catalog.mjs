/**
 * Genera una versión slim del catálogo para que entre en una Netlify Function.
 * Recorta descripciones largas y campos no usados en runtime.
 *
 * Uso: node scripts/slim-catalog.mjs
 */
import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const FULL = resolve(ROOT, 'src/data/cb-argentina.json')
const SLIM = resolve(ROOT, 'src/data/cb-argentina.json')

const raw = JSON.parse(await readFile(FULL, 'utf8'))
const before = (await stat(FULL)).size

const slim = {
  scrapedAt: raw.scrapedAt,
  source: raw.source,
  total: raw.total,
  properties: raw.properties.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    description: (p.description || '').slice(0, 280),
    location: p.location,
    operacion: p.operacion,
    priceCurrency: p.priceCurrency,
    priceValue: p.priceValue,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    surfaceM2: p.surfaceM2,
    reference: p.reference,
    image: p.image,
    detailUrl: p.detailUrl,
  })),
}

await writeFile(SLIM, JSON.stringify(slim))
const after = (await stat(SLIM)).size
console.log(`[slim] ${(before / 1024 / 1024).toFixed(1)} MB → ${(after / 1024 / 1024).toFixed(1)} MB · ${slim.properties.length} props`)
