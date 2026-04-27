import type { APIRoute } from 'astro'
import { extractFilters, isEnabled } from '../../lib/gemini'
import { applyFilters } from '../../lib/search'
import { FILTERS, CATALOG_META } from '../../data/properties'

export const prerender = false

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

  let body: { query?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const query = (body.query ?? '').trim()
  if (!query) {
    return new Response(JSON.stringify({ error: 'query requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const filters = await extractFilters(query, {
      tipos: FILTERS.tipos,
      operaciones: FILTERS.operaciones,
      ubicaciones: FILTERS.ubicaciones,
      total: CATALOG_META.total,
    })

    const results = applyFilters(filters, 24)

    return new Response(
      JSON.stringify({
        filters,
        total: results.length,
        results: results.map((r) => ({
          score: r.score,
          hits: r.hits,
          property: r.property,
        })),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Error procesando la consulta',
        detail: String((err as Error).message),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
