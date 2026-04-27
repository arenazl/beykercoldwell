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

  // Tokens de la query con stemming simple para singular/plural ("casas" → "casa").
  const tokens = q.split(/\W+/)
    .filter((t) => t.length > 3)
    .map((t) => t.endsWith('s') && t.length > 4 ? t.slice(0, -1) : t)

  // Detectar tipo mencionado para rankear propiedades de ese tipo arriba.
  const TYPE_HINTS: Record<string, string> = {
    casa: 'Casa',
    quinta: 'Casa Quinta',
    departamento: 'Departamento',
    depto: 'Departamento',
    monoambiente: 'Departamento',
    'ph': 'PH',
    lote: 'Lote',
    terreno: 'Lote',
    local: 'Local Comercial',
    oficina: 'Oficina',
    cochera: 'Cochera',
  }
  let typeHint: string | undefined
  for (const t of tokens) {
    if (TYPE_HINTS[t]) { typeHint = TYPE_HINTS[t]; break }
  }

  // Subset relevante: scoreamos cada propiedad por matches de token + bonus
  // de tipo. Después tomamos top 80. Esto evita perder la única Casa en 432
  // props de Palermo cuando el usuario pide "casas en palermo".
  const scored = PROPERTIES.map((p) => {
    const hay = `${p.title} ${p.location} ${p.type}`.toLowerCase()
    let score = 0
    for (const tok of tokens) if (hay.includes(tok)) score++
    if (typeHint && p.type === typeHint) score += 10
    return { p, score }
  })
  const matched = scored.filter((x) => x.score > 0)
  matched.sort((a, b) => b.score - a.score)
  const candidates = matched.slice(0, 80).map((x) => x.p)
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
