/**
 * Anclaje de tasaciones al catálogo real de Coldwell Banker Argentina.
 *
 * El LLM (Gemini) tiende a tasar alto porque su training data está sesgada a
 * precios de publicación (no de cierre) y desactualizada. En vez de aplicar un
 * factor mágico tipo `* 0.7` (machetazo prohibido por reglas globales), le
 * pasamos al prompt un ancla derivada del propio catálogo: el modelo ya no
 * inventa precios — los ajusta sobre datos reales del mismo mercado.
 *
 * Estrategia de fallback: tipo+zona → tipo+provincia → tipo nacional → null.
 * Si <3 comparables en cada nivel, baja al siguiente.
 */
import { PROPERTIES, type Property } from '../data/properties'
import type { PropertyType } from './valuator'

export interface MarketAnchor {
  scope: 'zona' | 'provincia' | 'nacional'
  type: PropertyType
  location: string
  count: number
  pricePerM2USD: {
    min: number
    p25: number
    median: number
    p75: number
    max: number
  }
  comparables: Array<{
    title: string
    location: string
    surfaceM2: number
    totalPriceUSD: number
    pricePerM2USD: number
  }>
}

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  if (next !== undefined) return sorted[base] + rest * (next - sorted[base])
  return sorted[base]
}

function isVentaUSD(p: Property): p is Property & { priceValue: number; surfaceM2: number } {
  return (
    p.operacion === 'venta' &&
    p.priceCurrency === 'USD' &&
    typeof p.priceValue === 'number' &&
    p.priceValue > 0 &&
    typeof p.surfaceM2 === 'number' &&
    p.surfaceM2 > 0
  )
}

function matchesType(p: Property, type: PropertyType): boolean {
  return norm(p.type) === norm(type)
}

function matchesLocation(p: Property, target: string): boolean {
  if (!p.location || !target) return false
  const a = norm(p.location)
  const b = norm(target)
  if (a.includes(b) || b.includes(a)) return true
  return b
    .split(',')
    .map((s) => norm(s.trim()))
    .filter((s) => s.length >= 4)
    .some((part) => a.includes(part))
}

function getProvincia(loc: string): string {
  return (loc || '').split(',')[0]?.trim() ?? ''
}

function buildAnchor(
  matched: Array<Property & { priceValue: number; surfaceM2: number }>,
  scope: MarketAnchor['scope'],
  type: PropertyType,
  location: string
): MarketAnchor | null {
  if (matched.length < 3) return null
  const ratios = matched.map((p) => p.priceValue / p.surfaceM2).sort((a, b) => a - b)
  const median = quantile(ratios, 0.5)
  const round = (n: number) => Math.round(n)

  const sortedByDistance = [...matched].sort(
    (a, b) =>
      Math.abs(a.priceValue / a.surfaceM2 - median) -
      Math.abs(b.priceValue / b.surfaceM2 - median)
  )
  const top = sortedByDistance.slice(0, 5).map((p) => ({
    title: p.title,
    location: p.location,
    surfaceM2: p.surfaceM2,
    totalPriceUSD: p.priceValue,
    pricePerM2USD: round(p.priceValue / p.surfaceM2),
  }))

  return {
    scope,
    type,
    location,
    count: matched.length,
    pricePerM2USD: {
      min: round(ratios[0]),
      p25: round(quantile(ratios, 0.25)),
      median: round(median),
      p75: round(quantile(ratios, 0.75)),
      max: round(ratios[ratios.length - 1]),
    },
    comparables: top,
  }
}

export function getMarketAnchor({
  type,
  location,
}: {
  type: PropertyType
  location: string
}): MarketAnchor | null {
  const universe = PROPERTIES.filter(isVentaUSD)

  const byZone = universe.filter(
    (p) => matchesType(p, type) && matchesLocation(p, location)
  )
  const zoneAnchor = buildAnchor(byZone, 'zona', type, location)
  if (zoneAnchor) return zoneAnchor

  const provincia = getProvincia(location)
  if (provincia) {
    const byProv = universe.filter(
      (p) => matchesType(p, type) && norm(getProvincia(p.location)) === norm(provincia)
    )
    const provAnchor = buildAnchor(byProv, 'provincia', type, provincia)
    if (provAnchor) return provAnchor
  }

  const byType = universe.filter((p) => matchesType(p, type))
  const natAnchor = buildAnchor(byType, 'nacional', type, 'Argentina')
  if (natAnchor) return natAnchor

  return null
}

export function formatAnchorForPrompt(anchor: MarketAnchor): string {
  const scopeLabel =
    anchor.scope === 'zona'
      ? `zona "${anchor.location}"`
      : anchor.scope === 'provincia'
      ? `provincia "${anchor.location}"`
      : `${anchor.type} en Argentina (sin match en zona/provincia, fallback nacional)`
  const fmt = (n: number) => n.toLocaleString('en-US')
  const lines = [
    '## ANCLA REAL DEL CATÁLOGO PROPIO (Coldwell Banker Argentina / Beyker)',
    'Estos NO son comparables hipotéticos: son propiedades publicadas HOY en nuestro catálogo.',
    `Alcance del ancla: ${anchor.type} en ${scopeLabel} — ${anchor.count} propiedades.`,
    '',
    'Distribución de USD/m² (precio de PUBLICACIÓN, no de cierre):',
    `- Min: USD ${fmt(anchor.pricePerM2USD.min)}/m²`,
    `- P25: USD ${fmt(anchor.pricePerM2USD.p25)}/m²`,
    `- Mediana: USD ${fmt(anchor.pricePerM2USD.median)}/m²`,
    `- P75: USD ${fmt(anchor.pricePerM2USD.p75)}/m²`,
    `- Max: USD ${fmt(anchor.pricePerM2USD.max)}/m²`,
    '',
    'Comparables reales del catálogo (precio de publicación):',
    ...anchor.comparables.map(
      (c, i) =>
        `${i + 1}. ${c.title} — ${c.location} — ${c.surfaceM2} m² — USD ${fmt(
          c.totalPriceUSD
        )} (${fmt(c.pricePerM2USD)} USD/m²)`
    ),
  ]
  return lines.join('\n')
}
