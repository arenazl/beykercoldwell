import type { APIRoute } from 'astro'
import { aiEnabled, compareProperties } from '../../lib/ai-tools'
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

  let body: { ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return jsonErr('JSON inválido')
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string') : []
  if (ids.length < 2 || ids.length > 3) {
    return jsonErr('Mandá entre 2 y 3 ids para comparar')
  }

  const props = ids.map((id) => PROPERTIES.find((p) => p.id === id)).filter(Boolean) as typeof PROPERTIES
  if (props.length !== ids.length) return jsonErr('Alguna propiedad no se encontró', 404)

  try {
    const r = await compareProperties(props)
    return new Response(
      JSON.stringify({ ...r, properties: props }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return jsonErr('Error generando comparación', 500, String((err as Error).message))
  }
}
