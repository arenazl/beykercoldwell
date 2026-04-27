import type { APIRoute } from 'astro'
import { aiEnabled, assistantChat, type AssistantMsg } from '../../lib/ai-tools'
import { PROPERTIES } from '../../data/properties'

export const prerender = false

function jsonErr(error: string, status = 400, hint?: string) {
  return new Response(JSON.stringify({ error, ...(hint && { hint }) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (!aiEnabled()) return jsonErr('GEMINI_API_KEY no configurada', 503, 'Agregala en .env')

  let body: { history?: AssistantMsg[] }
  try {
    body = await request.json()
  } catch {
    return jsonErr('JSON inválido')
  }

  const history = Array.isArray(body.history) ? body.history : []
  if (!history.length) return jsonErr('history requerido')

  const lastUser = [...history].reverse().find((m) => m.role === 'user')
  const q = (lastUser?.text ?? '').toLowerCase()

  // Subset relevante del catálogo: filtramos por keywords del último mensaje para
  // no mandar las ~250 props enteras a la IA.
  const candidates = PROPERTIES.filter((p) => {
    if (!q) return true
    const hay = `${p.title} ${p.location} ${p.type}`.toLowerCase()
    return q.split(/\W+/).some((tok) => tok.length > 3 && hay.includes(tok))
  }).slice(0, 80)
  const preview = candidates.length >= 10 ? candidates : PROPERTIES.slice(0, 60)

  try {
    const reply = await assistantChat(history, preview)
    const idSet = new Set(reply.suggestedPropertyIds || [])
    const matched = PROPERTIES.filter((p) => idSet.has(p.id))
    return new Response(
      JSON.stringify({ ...reply, properties: matched }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return jsonErr('Error procesando el mensaje', 500, String((err as Error).message))
  }
}
