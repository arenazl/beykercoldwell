import type { APIRoute } from 'astro'
import { aiEnabled, assistantChat, type AssistantMsg } from '../../lib/ai-tools'
import { propertiesByIds } from '../../lib/catalog-index'

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

  try {
    const reply = await assistantChat(history)
    const matched = propertiesByIds(reply.suggestedPropertyIds || [])
    return new Response(
      JSON.stringify({ ...reply, properties: matched }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return jsonErr('Error procesando el mensaje', 500, String((err as Error).message))
  }
}
