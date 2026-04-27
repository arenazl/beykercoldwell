import type { APIRoute } from 'astro'
import { aiEnabled, matchProperties, type MatchPreferences } from '../../lib/ai-tools'
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

  let body: Partial<MatchPreferences>
  try {
    body = await request.json()
  } catch {
    return jsonErr('JSON inválido')
  }

  if (body.operacion !== 'comprar' && body.operacion !== 'alquilar') {
    return jsonErr('operacion inválida')
  }

  const prefs: MatchPreferences = {
    operacion: body.operacion,
    zona: (body.zona ?? '').toString().trim(),
    presupuestoUSD: typeof body.presupuestoUSD === 'number' ? body.presupuestoUSD : null,
    ambientes: typeof body.ambientes === 'number' ? body.ambientes : null,
    estiloVida: Array.isArray(body.estiloVida) ? body.estiloVida.filter((x) => typeof x === 'string') : [],
    notas: typeof body.notas === 'string' ? body.notas : undefined,
  }

  // Pre-filtrado por operación + zona (substring) para reducir token use.
  const targetOp = prefs.operacion === 'comprar' ? 'venta' : 'alquiler'
  const zonaLower = prefs.zona.toLowerCase()
  const candidates = PROPERTIES.filter((p) => {
    if (p.operacion && p.operacion !== targetOp) return false
    if (zonaLower && !p.location.toLowerCase().includes(zonaLower)) return false
    return true
  }).slice(0, 120)
  const pool = candidates.length >= 6 ? candidates : PROPERTIES.filter((p) => p.operacion === targetOp).slice(0, 120)

  try {
    const r = await matchProperties(prefs, pool)
    const byId = new Map(PROPERTIES.map((p) => [p.id, p]))
    const enriched = r.picks
      .map((pk) => ({ ...pk, property: byId.get(pk.propertyId) }))
      .filter((x) => x.property)
    return new Response(
      JSON.stringify({ ...r, picks: enriched }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return jsonErr('Error procesando match', 500, String((err as Error).message))
  }
}
