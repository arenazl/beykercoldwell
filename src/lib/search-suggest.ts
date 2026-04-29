import type { Property } from '../data/properties'
import type { AISearchFilters } from './gemini'

/**
 * Sugerencia de la próxima dimensión a refinar, calculada del propio resultset.
 *
 * Reglas:
 *  - Solo proponemos una dimensión por turno (la más prioritaria que aún no
 *    esté seteada y que tenga variedad real en los matches).
 *  - 100% data-driven: rangos de precio/superficie salen de cuartiles del
 *    resultset actual, no de listas hardcodeadas. Si el dataset cambia, los
 *    chips también.
 *  - No proponemos si solo hay una opción válida (no aporta filtrado).
 */
export type MissingOption = {
  label: string
  /** Patch a mergear sobre los filters actuales al hacer click. */
  filterPatch: Partial<AISearchFilters>
  count: number
}

export type Missing = {
  dimension: 'operacion' | 'bedrooms' | 'priceUSD' | 'surfaceM2' | 'antiguedad'
  question: string
  options: MissingOption[]
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo)
}

function roundPrice(n: number): number {
  if (n >= 1_000_000) return Math.round(n / 50_000) * 50_000
  if (n >= 100_000) return Math.round(n / 10_000) * 10_000
  if (n >= 10_000) return Math.round(n / 1_000) * 1_000
  return Math.round(n / 100) * 100
}

function formatPriceUSD(usd: number): string {
  if (usd >= 1_000_000) return `USD ${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `USD ${Math.round(usd / 1_000)}k`
  return `USD ${Math.round(usd)}`
}

function tryOperacion(filters: AISearchFilters, props: Property[]): Missing | null {
  if (filters.operacion) return null
  const counts = new Map<string, number>()
  for (const p of props) if (p.operacion) counts.set(p.operacion, (counts.get(p.operacion) ?? 0) + 1)
  if (counts.size <= 1) return null
  const options: MissingOption[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({
      label: value.charAt(0).toUpperCase() + value.slice(1),
      filterPatch: { operacion: value },
      count,
    }))
  return { dimension: 'operacion', question: '¿Es para alquiler o venta?', options }
}

function tryBedrooms(filters: AISearchFilters, props: Property[]): Missing | null {
  if (filters.minBedrooms != null || filters.maxBedrooms != null) return null
  const counts = new Map<string, number>()
  let total = 0
  for (const p of props) {
    if (p.bedrooms == null) continue
    total++
    const key = p.bedrooms >= 4 ? '4+' : String(p.bedrooms)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (total < 4 || counts.size <= 1) return null
  const order = ['1', '2', '3', '4+']
  const labelMap: Record<string, string> = {
    '1': '1 amb',
    '2': '2 amb',
    '3': '3 amb',
    '4+': '4+ amb',
  }
  const options: MissingOption[] = []
  for (const k of order) {
    const c = counts.get(k) ?? 0
    if (c === 0) continue
    const patch: Partial<AISearchFilters> =
      k === '4+' ? { minBedrooms: 4 } : { minBedrooms: Number(k), maxBedrooms: Number(k) }
    options.push({ label: labelMap[k], filterPatch: patch, count: c })
  }
  if (options.length <= 1) return null
  return { dimension: 'bedrooms', question: '¿Cuántos ambientes?', options }
}

function tryPriceUSD(filters: AISearchFilters, props: Property[]): Missing | null {
  if (filters.minPriceUSD != null || filters.maxPriceUSD != null) return null
  const prices = props
    .map((p) => p.priceValue)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b)
  if (prices.length < 8) return null
  const b1 = roundPrice(quantile(prices, 0.25))
  const b2 = roundPrice(quantile(prices, 0.5))
  const b3 = roundPrice(quantile(prices, 0.75))
  if (!(b1 < b2 && b2 < b3)) return null
  const buckets: { min: number; max: number; label: string }[] = [
    { min: 0, max: b1, label: `Hasta ${formatPriceUSD(b1)}` },
    { min: b1, max: b2, label: `${formatPriceUSD(b1)} – ${formatPriceUSD(b2)}` },
    { min: b2, max: b3, label: `${formatPriceUSD(b2)} – ${formatPriceUSD(b3)}` },
    { min: b3, max: Infinity, label: `Más de ${formatPriceUSD(b3)}` },
  ]
  const options: MissingOption[] = []
  for (const b of buckets) {
    const count = prices.filter((p) => p >= b.min && (b.max === Infinity || p < b.max)).length
    if (count === 0) continue
    const patch: Partial<AISearchFilters> =
      b.max === Infinity
        ? { minPriceUSD: b.min }
        : b.min === 0
        ? { maxPriceUSD: b.max }
        : { minPriceUSD: b.min, maxPriceUSD: b.max }
    options.push({ label: b.label, filterPatch: patch, count })
  }
  if (options.length <= 1) return null
  return { dimension: 'priceUSD', question: '¿Tenés un rango de precio en mente?', options }
}

function trySurfaceM2(filters: AISearchFilters, props: Property[]): Missing | null {
  if (filters.minSurfaceM2 != null || filters.maxSurfaceM2 != null) return null
  const surfaces = props
    .map((p) => p.surfaceM2)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b)
  if (surfaces.length < 8) return null
  const p33 = Math.round(quantile(surfaces, 0.33))
  const p66 = Math.round(quantile(surfaces, 0.66))
  if (p33 >= p66) return null
  const buckets: { min: number; max: number; label: string }[] = [
    { min: 0, max: p33, label: `Hasta ${p33} m²` },
    { min: p33, max: p66, label: `${p33} – ${p66} m²` },
    { min: p66, max: Infinity, label: `Más de ${p66} m²` },
  ]
  const options: MissingOption[] = []
  for (const b of buckets) {
    const count = surfaces.filter((s) => s >= b.min && (b.max === Infinity || s < b.max)).length
    if (count === 0) continue
    const patch: Partial<AISearchFilters> =
      b.max === Infinity
        ? { minSurfaceM2: b.min }
        : b.min === 0
        ? { maxSurfaceM2: b.max }
        : { minSurfaceM2: b.min, maxSurfaceM2: b.max }
    options.push({ label: b.label, filterPatch: patch, count })
  }
  if (options.length <= 1) return null
  return { dimension: 'surfaceM2', question: '¿Qué tamaño buscás?', options }
}

function tryAntiguedad(filters: AISearchFilters, props: Property[]): Missing | null {
  if (filters.aEstrenar || filters.maxAntiguedad != null) return null
  let aEstrenar = 0
  let hasta10 = 0
  let hasta30 = 0
  for (const p of props) {
    if (p.antiguedadYears == null) continue
    if (p.antiguedadYears === 0) aEstrenar++
    else if (p.antiguedadYears <= 10) hasta10++
    else if (p.antiguedadYears <= 30) hasta30++
  }
  const buckets: MissingOption[] = []
  if (aEstrenar > 0) buckets.push({ label: '✨ A estrenar', filterPatch: { aEstrenar: true }, count: aEstrenar })
  if (hasta10 > 0) buckets.push({ label: 'Hasta 10 años', filterPatch: { maxAntiguedad: 10 }, count: hasta10 })
  if (hasta30 > 0) buckets.push({ label: 'Hasta 30 años', filterPatch: { maxAntiguedad: 30 }, count: hasta30 })
  if (buckets.length <= 1) return null
  return { dimension: 'antiguedad', question: '¿Antigüedad?', options: buckets }
}

const PIPELINE = [tryOperacion, tryBedrooms, tryPriceUSD, trySurfaceM2, tryAntiguedad] as const

export function computeNextMissing(
  filters: AISearchFilters,
  props: Property[]
): Missing | undefined {
  for (const fn of PIPELINE) {
    const m = fn(filters, props)
    if (m) return m
  }
  return undefined
}
