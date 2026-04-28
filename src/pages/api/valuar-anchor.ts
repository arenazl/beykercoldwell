/**
 * Endpoint de diagnóstico: devuelve el ancla calculada para un (type, location)
 * sin pasar por el LLM. Sirve para validar que el matcheo de zonas del catálogo
 * funciona bien antes de quemar llamadas a Gemini.
 *
 * Uso:
 *   GET /api/valuar-anchor?type=Departamento&location=Tigre
 *   GET /api/valuar-anchor?type=Casa&location=Buenos%20Aires%2C%20Pilar
 */
import type { APIRoute } from 'astro'
import { getMarketAnchor } from '../../lib/market-anchors'
import type { PropertyType } from '../../lib/valuator'

export const prerender = false

const VALID_TYPES: PropertyType[] = [
  'Departamento', 'Casa', 'PH', 'Casa Quinta', 'Lote', 'Local', 'Oficina', 'Cochera',
]

export const GET: APIRoute = ({ url }) => {
  const type = url.searchParams.get('type')?.trim()
  const location = url.searchParams.get('location')?.trim()

  if (!type || !VALID_TYPES.includes(type as PropertyType)) {
    return new Response(
      JSON.stringify({
        error: 'type inválido o faltante',
        hint: `Valores válidos: ${VALID_TYPES.join(', ')}`,
        validTypes: VALID_TYPES,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
  if (!location) {
    return new Response(
      JSON.stringify({
        error: 'location requerido',
        hint: 'Pasá el barrio/zona como query param: ?location=Tigre',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const anchor = getMarketAnchor({ type: type as PropertyType, location })

  if (!anchor) {
    return new Response(
      JSON.stringify({
        anchor: null,
        message: `Sin ancla: el catálogo no tiene ≥3 propiedades de tipo "${type}" que matcheen "${location}" (ni en zona, provincia ni nacional con tipo).`,
        suggestion: 'Probá con una zona más amplia (ej: provincia) o verificá la grafía. Si la zona es real, falta data en el catálogo.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ anchor }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
}
