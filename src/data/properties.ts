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
// Detalles enriquecidos (scraped de fichas individuales: antigüedad estructurada,
// situation, orientation, etc.). El archivo siempre existe (mínimo {details:{}}).
import detailsRaw from './cb-argentina-details.json' assert { type: 'json' }
import { detectFeatures } from '../lib/feature-index'

interface DetailEntry {
  antiquity?: string
  antiguedadYears?: number
  situation?: string
  orientation?: string
  floors?: string
  /** Localidad/barrio del bloque <span class="city"> de la ficha de detalle. */
  city?: string
  /** Provincia/zona del bloque <span class="province"> de la ficha de detalle. */
  province?: string
  /** Calle + altura del bloque <p class="map-location">. */
  address?: string
  lat?: number
  lng?: number
}
const detailsMap: Record<string, DetailEntry> =
  ((detailsRaw as { details?: Record<string, DetailEntry> }).details) ?? {}

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
  /** true si `location` se derivó del title (el scrape lo trajo vacío). */
  locationInferred: boolean
  /** Set de features estandarizadas detectadas en title+desc. Pre-computado
   *  al cargar el catálogo para lookup O(1) en filtros (ver feature-index.ts). */
  features: Set<import('../lib/feature-index').Feature>
}

function normLoc(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Ciudades cuyo nombre es ambiguo y produce muchos falsos positivos en titles. */
const AMBIGUOUS_CITIES = new Set([
  'capital', 'centro', 'norte', 'sur', 'oeste', 'este', 'boca', 'tigre',
])

/**
 * Detecta si `target` aparece en `text` como parte de un nombre de calle/avenida
 * (Av Cardenal X, Perito Moreno, etc) y no como localidad. Mismo criterio que
 * lib/search.ts pero replicado para evitar dependencia circular.
 */
function looksLikeStreetMatch(text: string, target: string): boolean {
  const idx = text.indexOf(target)
  if (idx <= 0) return false
  const before = text.slice(Math.max(0, idx - 30), idx).toLowerCase()
  return /(perito|cardenal|av\.?|avda\.?|avenida|calle|pje\.?|pasaje|ruta|presidente|gobernador|coronel|general|gral\.?|dr\.?|santiago|alfonso|mariano|pedro)\s*$/.test(
    before
  )
}

/**
 * Construye un diccionario de "ciudad/barrio → location completa" a partir de
 * las propiedades que SÍ traen `location` poblado. La usamos para inferir la
 * location de propiedades que vienen con el campo vacío (≈68% del catálogo
 * por bug del scrape) buscando esas ciudades dentro del title.
 */
function buildLocationDict(): Array<{ cityNorm: string; full: string; rx: RegExp }> {
  const map = new Map<string, string>()
  // Usamos `raw` directo porque `catalog` se declara más abajo (TDZ).
  for (const p of (raw as CatalogShape).properties) {
    if (!p.location?.trim()) continue
    const parts = p.location.split(',').map((s) => s.trim()).filter(Boolean)
    if (!parts.length) continue
    const city = parts[parts.length - 1]
    const cityNorm = normLoc(city)
    if (!cityNorm || cityNorm.length < 4) continue
    if (AMBIGUOUS_CITIES.has(cityNorm)) continue
    if (!map.has(cityNorm)) map.set(cityNorm, p.location)
  }
  // Ordenar por longitud DESC: "Pilar del Este" debe pegar antes que "Pilar".
  return [...map.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([cityNorm, full]) => ({
      cityNorm,
      full,
      rx: new RegExp(`\\b${cityNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
    }))
}

const LOCATION_DICT = buildLocationDict()

function inferLocation(title: string): string | null {
  const t = normLoc(title)
  if (!t) return null
  for (const { cityNorm, rx, full } of LOCATION_DICT) {
    if (!rx.test(t)) continue
    if (looksLikeStreetMatch(t, cityNorm)) continue
    return full
  }
  return null
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
  // Preferimos data estructurada del detalle; si no, regex sobre title+description.
  const detail = detailsMap[p.id]
  let years: number | null = null
  let label: string | null = null
  if (detail?.antiguedadYears != null) {
    years = detail.antiguedadYears
    label = detail.antiquity ?? (years === 0 ? 'A estrenar' : `${years} año${years === 1 ? '' : 's'}`)
  } else {
    const ant = inferAntiguedad(`${p.title || ''} ${p.description || ''}`)
    years = ant.years
    label = ant.label
  }

  // Resolución de location, en orden de confianza:
  // 1. p.location del listing card (si viene poblado)
  // 2. detail.province + detail.city de la ficha de detalle (estructurado, alta confianza)
  // 3. inferLocation(title) (heurística sobre LOCATION_DICT)
  let location = p.location
  let locationInferred = false
  if (!location?.trim() && detail?.city && detail?.province) {
    location = `${detail.province}, ${detail.city}`
  } else if (!location?.trim() && detail?.city) {
    location = detail.city
  } else if (!location?.trim() && detail?.province) {
    location = detail.province
  }
  if (!location?.trim()) {
    const inferred = inferLocation(p.title || '')
    if (inferred) {
      location = inferred
      locationInferred = true
    }
  }

  return {
    ...p,
    location,
    slug: `${slugify(p.title)}-${p.id}`,
    antiguedadYears: years,
    antiguedadLabel: label,
    locationInferred,
    features: detectFeatures(`${p.title || ''} ${p.description || ''}`),
  }
})

export const CATALOG_META = {
  total: catalog.total,
  scrapedAt: catalog.scrapedAt,
  source: catalog.source,
  withAntiguedad: PROPERTIES.filter((p) => p.antiguedadLabel).length,
  withLocation: PROPERTIES.filter((p) => p.location?.trim()).length,
  locationInferred: PROPERTIES.filter((p) => p.locationInferred).length,
}

export function formatPriceUSD(value: number | null, currency = 'USD'): string {
  if (value == null) return 'Consultar'
  return `${currency} ${value.toLocaleString('es-AR')}`
}

// Filtros derivados del catálogo (no hardcodeados — se generan a partir de los datos).
export const FILTERS = {
  tipos: [...new Set(PROPERTIES.map((p) => p.type).filter(Boolean))].sort(),
  operaciones: [...new Set(PROPERTIES.map((p) => p.operacion).filter(Boolean))].sort() as Operacion[],
  // Lista corta (provincia/zona) — para dropdowns y marquees de UI.
  ubicaciones: [
    ...new Set(
      PROPERTIES.map((p) => p.location.split(',')[0]?.trim()).filter(Boolean)
    ),
  ].sort(),
  // Lista granular (provincia/zona, barrio/ciudad) — fuente de verdad para
  // matching de la IA. Sin este nivel de detalle el modelo no puede resolver
  // queries por barrio (ej: "boca", "moreno", "recoleta").
  locationsFull: [
    ...new Set(PROPERTIES.map((p) => p.location?.trim()).filter(Boolean)),
  ].sort(),
  precios: [
    { label: 'Hasta USD 100.000', max: 100000 },
    { label: 'USD 100.000 – 200.000', min: 100000, max: 200000 },
    { label: 'USD 200.000 – 500.000', min: 200000, max: 500000 },
    { label: 'Más de USD 500.000', min: 500000 },
  ],
  dormitorios: [1, 2, 3, 4, 5],
}
