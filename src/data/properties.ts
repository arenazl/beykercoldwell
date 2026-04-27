/**
 * Catálogo de propiedades.
 *
 * Fuente: scrape de https://coldwellbanker.com.ar/propiedades (catálogo público
 * de toda la red Coldwell Banker Argentina). Se persiste en
 * `src/data/cb-argentina.json` y se carga acá al import.
 *
 * Para refrescar el catálogo: `node scripts/scrape-cb-argentina.mjs`
 */
import raw from './cb-argentina.json' assert { type: 'json' }

export type Operacion = 'venta' | 'alquiler' | 'reserva' | 'alquiler temporario'

export interface RawProperty {
  id: string
  type: string
  title: string
  description: string
  location: string
  operacion: string
  priceCurrency: string
  priceValue: number | null
  priceValidUntil?: string
  bedrooms: number | null
  bathrooms: number | null
  surfaceM2: number | null
  reference: string
  image: string
  detailUrl: string
  sourcePage?: string
}

export interface Property extends RawProperty {
  slug: string
  /** Antigüedad inferida del title+description. null si no se pudo inferir. */
  antiguedadYears: number | null
  /** Label para mostrar en UI: "A estrenar", "5 años", null si null. */
  antiguedadLabel: string | null
}

interface CatalogShape {
  scrapedAt: string
  source: string
  total: number
  properties: RawProperty[]
}

const catalog = raw as CatalogShape

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Infiere antigüedad a partir de title+description. Conservador:
 * - "a estrenar" / "estrenar" / "en pozo" / "a construir" → 0
 * - "X años de antigüedad" / "antigüedad de X años" → X
 * - Si nada matchea, devuelve null (no inventamos).
 */
function inferAntiguedad(text: string): { years: number | null; label: string | null } {
  if (!text) return { years: null, label: null }
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  if (/\b(a estrenar|sin estrenar|estrenar)\b/.test(t)) {
    return { years: 0, label: 'A estrenar' }
  }
  if (/\b(en pozo|en construccion|a construir|preventa)\b/.test(t)) {
    return { years: 0, label: 'En pozo' }
  }

  const patterns = [
    /antiguedad[^0-9]{0,30}(\d{1,3})\s*anos?/,
    /(\d{1,3})\s*anos?\s*de\s*antiguedad/,
    /(\d{1,3})\s*anos?\s*de\s*construccion/,
  ]
  for (const rx of patterns) {
    const m = t.match(rx)
    if (m) {
      const y = Number(m[1])
      if (y >= 0 && y <= 150) {
        if (y === 0) return { years: 0, label: 'A estrenar' }
        return { years: y, label: `${y} año${y === 1 ? '' : 's'}` }
      }
    }
  }
  return { years: null, label: null }
}

export const PROPERTIES: Property[] = catalog.properties.map((p) => {
  const ant = inferAntiguedad(`${p.title || ''} ${p.description || ''}`)
  return {
    ...p,
    slug: `${slugify(p.title)}-${p.id}`,
    antiguedadYears: ant.years,
    antiguedadLabel: ant.label,
  }
})

export const CATALOG_META = {
  total: catalog.total,
  scrapedAt: catalog.scrapedAt,
  source: catalog.source,
  withAntiguedad: PROPERTIES.filter((p) => p.antiguedadLabel).length,
}

export function formatPriceUSD(value: number | null, currency = 'USD'): string {
  if (value == null) return 'Consultar'
  return `${currency} ${value.toLocaleString('es-AR')}`
}

// Filtros derivados del catálogo (no hardcodeados — se generan a partir de los datos).
export const FILTERS = {
  tipos: [...new Set(PROPERTIES.map((p) => p.type).filter(Boolean))].sort(),
  operaciones: [...new Set(PROPERTIES.map((p) => p.operacion).filter(Boolean))].sort() as Operacion[],
  ubicaciones: [
    ...new Set(
      PROPERTIES.map((p) => p.location.split(',')[0]?.trim()).filter(Boolean)
    ),
  ].sort(),
  precios: [
    { label: 'Hasta USD 100.000', max: 100000 },
    { label: 'USD 100.000 – 200.000', min: 100000, max: 200000 },
    { label: 'USD 200.000 – 500.000', min: 200000, max: 500000 },
    { label: 'Más de USD 500.000', min: 500000 },
  ],
  dormitorios: [1, 2, 3, 4, 5],
}
