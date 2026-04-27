import type { APIRoute } from 'astro'
import { aiEnabled, generateListing, type ListingGenInput } from '../../lib/ai-tools'

export const prerender = false

function jsonErr(error: string, status = 400, hint?: string) {
  return new Response(JSON.stringify({ error, ...(hint && { hint }) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (!aiEnabled()) return jsonErr('GEMINI_API_KEY no configurada', 503)

  let body: Partial<ListingGenInput>
  try {
    body = await request.json()
  } catch {
    return jsonErr('JSON inválido')
  }

  if (!body.type || typeof body.type !== 'string') return jsonErr('type requerido')
  if (!body.location || typeof body.location !== 'string') return jsonErr('location requerido')
  if (!body.surfaceM2 || typeof body.surfaceM2 !== 'number' || body.surfaceM2 <= 0) {
    return jsonErr('surfaceM2 debe ser un número positivo')
  }

  const input: ListingGenInput = {
    type: body.type,
    location: body.location,
    surfaceM2: body.surfaceM2,
    bedrooms: typeof body.bedrooms === 'number' ? body.bedrooms : undefined,
    bathrooms: typeof body.bathrooms === 'number' ? body.bathrooms : undefined,
    ageYears: typeof body.ageYears === 'number' ? body.ageYears : undefined,
    features: Array.isArray(body.features) ? body.features.filter((x) => typeof x === 'string') : [],
    notas: typeof body.notas === 'string' ? body.notas : undefined,
  }

  try {
    const r = await generateListing(input)
    return new Response(JSON.stringify(r), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return jsonErr('Error generando aviso', 500, String((err as Error).message))
  }
}
