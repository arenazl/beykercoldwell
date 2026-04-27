import type { APIRoute } from 'astro'
import { aiEnabled, propertyInsight } from '../../lib/ai-tools'
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

  let body: { propertyId?: string; slug?: string }
  try {
    body = await request.json()
  } catch {
    return jsonErr('JSON inválido')
  }

  const p = PROPERTIES.find(
    (x) => x.id === body.propertyId || x.slug === body.slug
  )
  if (!p) return jsonErr('Propiedad no encontrada', 404)

  try {
    const insight = await propertyInsight(p)
    return new Response(JSON.stringify(insight), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return jsonErr('Error generando insights', 500, String((err as Error).message))
  }
}
