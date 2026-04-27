import { PROPERTIES, type Property } from '../data/properties'
import type { AISearchFilters } from './gemini'

/**
 * Aplica filtros estructurados al catálogo y devuelve los matches ordenados por
 * relevancia (matches de keywords + cercanía al rango de precio).
 */
export interface SearchResult {
  property: Property
  score: number
  hits: string[]
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Detecta si el match en title/description es probablemente parte del nombre
 * de una calle (Perito Moreno, Av X, Cardenal Y) y NO la localidad/barrio.
 * Devuelve true si el match parece spurious (parte de un nombre de calle).
 */
function looksLikeStreetMatch(text: string, target: string): boolean {
  const idx = text.indexOf(target)
  if (idx <= 0) return false
  // Tomamos las ~25 chars previas y vemos si terminan en un prefijo de calle.
  const before = text.slice(Math.max(0, idx - 30), idx).toLowerCase()
  return /(perito|cardenal|av\.?|avda\.?|avenida|calle|pje\.?|pasaje|ruta|presidente|gobernador|coronel|general|gral\.?|dr\.?|santiago|alfonso|mariano|pedro)\s*$/.test(
    before
  )
}

/**
 * Estrategia de matching de ubicación, propiedad a propiedad:
 * - Si la propiedad tiene `location` poblado → matcheamos contra ese campo
 *   (alta precisión: es la localidad estructurada del scrape).
 * - Si `location` viene vacío (≈68% del catálogo por bug del scrape) → fallback
 *   a buscar el término en `title`, filtrando matches que parezcan parte de un
 *   nombre de calle (Perito Moreno, Cardenal X, etc).
 *
 * La decisión es por propiedad, no global: así no perdemos propiedades con
 * location bien rotulada cuando otras del mismo término vienen con location
 * vacío (caso típico: "Moreno" tenía 1 con location y 10 sin location).
 */
function matchesLocation(p: Property, target: string): boolean {
  const locNorm = normalize(p.location)
  if (locNorm) return locNorm.includes(target)
  const title = normalize(p.title)
  if (!title.includes(target)) return false
  if (looksLikeStreetMatch(title, target)) return false
  return true
}

export function applyFilters(filters: AISearchFilters, limit = 24): SearchResult[] {
  const results: SearchResult[] = []

  const target = filters.location_includes ? normalize(filters.location_includes) : ''

  for (const p of PROPERTIES) {
    const hits: string[] = []
    let pass = true

    if (filters.operacion && p.operacion && p.operacion !== filters.operacion) pass = false
    if (filters.type && p.type !== filters.type) pass = false

    if (target) {
      if (!matchesLocation(p, target)) pass = false
      else hits.push(`📍 ${filters.location_includes}`)
    }

    if (filters.minPriceUSD != null && (p.priceValue ?? 0) < filters.minPriceUSD) pass = false
    if (filters.maxPriceUSD != null && (p.priceValue ?? Infinity) > filters.maxPriceUSD) pass = false

    if (filters.minBedrooms != null && (p.bedrooms ?? 0) < filters.minBedrooms) pass = false
    if (filters.maxBedrooms != null && (p.bedrooms ?? Infinity) > filters.maxBedrooms) pass = false
    if (filters.minBathrooms != null && (p.bathrooms ?? 0) < filters.minBathrooms) pass = false
    if (filters.minSurfaceM2 != null && (p.surfaceM2 ?? 0) < filters.minSurfaceM2) pass = false
    if (filters.maxSurfaceM2 != null && (p.surfaceM2 ?? Infinity) > filters.maxSurfaceM2) pass = false

    if (filters.aEstrenar) {
      if (p.antiguedadYears !== 0) pass = false
      else hits.push('✨ A estrenar')
    } else if (filters.maxAntiguedad != null) {
      // Solo descartamos si conocemos la antigüedad y supera el máximo.
      // Si no la sabemos, no descartamos (no hay dato suficiente).
      if (p.antiguedadYears != null && p.antiguedadYears > filters.maxAntiguedad) pass = false
      else if (p.antiguedadLabel) hits.push(`🏛 ${p.antiguedadLabel}`)
    }

    if (!pass) continue

    let score = 1
    if (filters.keywords?.length) {
      const haystack = normalize(`${p.title} ${p.description}`)
      for (const kw of filters.keywords) {
        const needle = normalize(kw)
        if (needle && haystack.includes(needle)) {
          score += 2
          hits.push(`✓ ${kw}`)
        }
      }
    }

    // Boost: si hay precio definido, propiedades dentro del rango ranquean mejor
    if (filters.maxPriceUSD != null && p.priceValue != null) {
      const ratio = p.priceValue / filters.maxPriceUSD
      if (ratio < 0.95) score += 0.5
    }

    results.push({ property: p, score, hits })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}
