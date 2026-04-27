/**
 * Serializa el catálogo en formato compacto pipe-separated para mandárselo
 * a la IA. Una línea por propiedad, sin descripciones largas. Esto permite
 * que la IA "vea" las 9.240 propiedades en su contexto sin volar el budget
 * de tokens (≈110k tokens en total — entra cómodo en Gemini 2.5 Flash).
 *
 * Formato:
 *   ID|TIPO|CIUDAD|ZONA|OPERACION|MONEDA|PRECIO|DORM|BAÑOS|M2|EDAD
 *
 * Ejemplo:
 *   4619637|Departamento|Palermo|Capital Federal|venta|USD|155000|1|1|48|0
 */
import { PROPERTIES, type Property } from '../data/properties'

function safe(s: string | number | null | undefined): string {
  if (s == null) return ''
  return String(s).replace(/\|/g, '/').replace(/\n/g, ' ').trim()
}

function row(p: Property): string {
  // location viene como "Provincia, Ciudad" → separamos.
  const parts = (p.location || '').split(',').map((x) => x.trim())
  const province = parts[0] || ''
  const city = parts[1] || parts[0] || ''
  return [
    p.id,
    p.type,
    city,
    province,
    p.operacion,
    p.priceCurrency || 'USD',
    p.priceValue ?? '',
    p.bedrooms ?? '',
    p.bathrooms ?? '',
    p.surfaceM2 ?? '',
    p.antiguedadYears ?? '',
  ].map(safe).join('|')
}

const CATALOG_INDEX = PROPERTIES.map(row).join('\n')
const HEADER = 'ID|TIPO|CIUDAD|ZONA|OPERACION|MONEDA|PRECIO_USD|DORM|BAÑOS|M2|EDAD_AÑOS'
export const CATALOG_INDEX_FULL = `${HEADER}\n${CATALOG_INDEX}`

/**
 * Resuelve un set de IDs sugeridos por la IA al objeto Property completo.
 */
export function propertiesByIds(ids: string[]): Property[] {
  const set = new Set(ids)
  return PROPERTIES.filter((p) => set.has(p.id))
}

/**
 * Estadísticas del catálogo para que la IA entienda la cobertura sin
 * recorrer todas las filas. Útil para responder "¿tienen propiedades en X?"
 * sin que la IA tenga que hacer fold sobre 9k líneas.
 */
function buildStats() {
  const byCity: Record<string, number> = {}
  const byType: Record<string, number> = {}
  const byOp: Record<string, number> = {}
  const byCityType: Record<string, number> = {}
  for (const p of PROPERTIES) {
    const city = (p.location.split(',')[1] || p.location.split(',')[0] || '').trim() || '(sin)'
    byCity[city] = (byCity[city] || 0) + 1
    byType[p.type] = (byType[p.type] || 0) + 1
    byOp[p.operacion] = (byOp[p.operacion] || 0) + 1
    const k = `${p.type}@${city}`
    byCityType[k] = (byCityType[k] || 0) + 1
  }
  return { byCity, byType, byOp, byCityType }
}

export const CATALOG_STATS = buildStats()
