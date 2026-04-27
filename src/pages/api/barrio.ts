import type { APIRoute } from 'astro'
import { aiEnabled, neighborhoodGuide } from '../../lib/ai-tools'
import { PROPERTIES } from '../../data/properties'

export const prerender = false

function jsonErr(error: string, status = 400, hint?: string) {
  return new Response(JSON.stringify({ error, ...(hint && { hint }) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (!aiEnabled()) return jsonErr('GEMINI_API_KEY no configurada', 503)

  let body: { zona?: string }
  try {
    body = await request.json()
  } catch {
    return jsonErr('JSON inválido')
  }

  const zona = (body.zona ?? '').toString().trim()
  if (!zona) return jsonErr('zona requerida')

  const zonaLower = zona.toLowerCase()
  const propsEnZona = PROPERTIES.filter((p) =>
    p.location.toLowerCase().includes(zonaLower)
  )

  try {
    const guide = await neighborhoodGuide(zona, propsEnZona)
    return new Response(
      JSON.stringify({ ...guide, propertiesCount: propsEnZona.length, sampleProperties: propsEnZona.slice(0, 6) }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return jsonErr('Error generando guía', 500, String((err as Error).message))
  }
}
