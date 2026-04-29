import type { APIRoute } from 'astro'
import { isEnabled, valuateProperty, type ValuatorInput, type PropertyType, type PropertyState } from '../../lib/valuator'

export const prerender = false

const VALID_TYPES: PropertyType[] = [
  'Departamento', 'Casa', 'PH', 'Casa Quinta', 'Lote', 'Local', 'Oficina', 'Cochera',
]
const VALID_STATES: PropertyState[] = [
  'a estrenar', 'excelente', 'bueno', 'regular', 'a refaccionar',
]

function badRequest(error: string, hint?: string) {
  return new Response(JSON.stringify({ error, ...(hint && { hint }) }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (!isEnabled()) {
    return new Response(
      JSON.stringify({
        error: 'GEMINI_API_KEY no configurada en el servidor',
        hint: 'Agregala en .env y reiniciá el dev server',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: Partial<ValuatorInput>
  try {
    body = await request.json()
  } catch {
    return badRequest('JSON inválido')
  }

  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return badRequest('type inválido', `Valores válidos: ${VALID_TYPES.join(', ')}`)
  }
  if (!body.state || !VALID_STATES.includes(body.state)) {
    return badRequest('state inválido', `Valores válidos: ${VALID_STATES.join(', ')}`)
  }
  if (!body.location || typeof body.location !== 'string' || !body.location.trim()) {
    return badRequest('location requerido')
  }
  // street + streetNumber son nice-to-have. Con location + lat/lng el
  // valuator tiene contexto de sobra. No bloqueamos el flujo si Nominatim
  // no los devolvió (algunas calles sin altura, lotes, zonas rurales).
  if (!body.surfaceTotalM2 || typeof body.surfaceTotalM2 !== 'number' || body.surfaceTotalM2 <= 0) {
    return badRequest('surfaceTotalM2 debe ser un número positivo')
  }

  const input: ValuatorInput = {
    type: body.type,
    location: body.location.trim(),
    street: (body.street ?? '').trim(),
    streetNumber: (body.streetNumber ?? '').trim(),
    floor: body.floor?.trim() || undefined,
    unit: body.unit?.trim() || undefined,
    surfaceTotalM2: body.surfaceTotalM2,
    surfaceCoveredM2: body.surfaceCoveredM2,
    rooms: body.rooms,
    bedrooms: body.bedrooms,
    bathrooms: body.bathrooms,
    ageYears: body.ageYears,
    state: body.state,
    features: Array.isArray(body.features) ? body.features.filter((f) => typeof f === 'string') : [],
    expensesArs: body.expensesArs,
    orientation: body.orientation?.trim() || undefined,
    notes: body.notes,
  }

  // Hard timeout antes del 30s del proxy (Heroku/Netlify) — si el modelo no
  // respondió en 24s, cortamos limpio con JSON propio. Sin esto el proxy mata
  // el request y devuelve HTML, rompiendo el JSON.parse del cliente.
  const TIMEOUT_MS = 24_000
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('valuator-timeout')), TIMEOUT_MS)
  )

  try {
    const result = await Promise.race([valuateProperty(input), timeout])
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = String((err as Error).message)
    if (message === 'valuator-timeout') {
      return new Response(
        JSON.stringify({
          error: 'La valuación tardó demasiado',
          hint: 'El modelo está saturado. Probá de nuevo en unos segundos.',
        }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return new Response(
      JSON.stringify({
        error: 'Error procesando la valuación',
        detail: message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
