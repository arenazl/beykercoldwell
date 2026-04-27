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

export function applyFilters(filters: AISearchFilters, limit = 24): SearchResult[] {
  const results: SearchResult[] = []

  for (const p of PROPERTIES) {
    const hits: string[] = []
    let pass = true

    if (filters.operacion && p.operacion && p.operacion !== filters.operacion) pass = false
    if (filters.type && p.type !== filters.type) pass = false

    if (filters.location_includes) {
      // El campo `location` viene vacío en algunas propiedades (~30% del catálogo).
      // En esos casos el barrio suele estar en el título o en la descripción.
      // Buscamos en los tres para no perder matches.
      const haystack = normalize(`${p.location} ${p.title} ${p.description}`)
      const target = normalize(filters.location_includes)
      if (!target || !haystack.includes(target)) pass = false
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
