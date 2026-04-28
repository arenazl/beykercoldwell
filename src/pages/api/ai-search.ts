import type { APIRoute } from 'astro'
import { extractFilters, isEnabled, type AISearchFilters } from '../../lib/gemini'
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

  let body: { query?: string; filters?: AISearchFilters }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let filters: AISearchFilters

    // Dos modos de entrada:
    //  1) `query` (NL): pasamos por Gemini para extraer filtros.
    //  2) `filters` (estructurado): salteamos Gemini. Lo usa el chip de
    //     "¿quisiste decir Departamento?" para repivotear sin re-cobrar el LLM.
    if (body.filters && typeof body.filters === 'object') {
      filters = body.filters
    } else {
      const query = (body.query ?? '').trim()
      if (!query) {
        return new Response(JSON.stringify({ error: 'query requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      filters = await extractFilters(query, {
        tipos: FILTERS.tipos,
        operaciones: FILTERS.operaciones,
        ubicaciones: FILTERS.locationsFull,
        total: CATALOG_META.total,
      })
    }

    if (filters.out_of_scope) {
      return new Response(
        JSON.stringify({ filters, total: 0, results: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { total, results } = applyFilters(filters)

    // Sugerencia data-driven: si la búsqueda con `type` dio 0 pero al sacar
    // `type` (manteniendo zona/precio/etc) hay resultados, devolvemos el
    // desglose por tipo. Las "alternativas" son lo que efectivamente existe
    // en la intersección de los demás filtros — no hay listas de "familias"
    // hardcodeadas en el código ni en el prompt.
    let suggest:
      | {
          reason: 'no_results_for_type'
          original_type: string
          alternatives: { type: string; count: number }[]
        }
      | undefined

    if (total === 0 && filters.type) {
      const { type: _drop, ...rest } = filters
      const { results: altResults } = applyFilters(rest as AISearchFilters, 5000)
      if (altResults.length > 0) {
        const counts = new Map<string, number>()
        for (const r of altResults) {
          const t = r.property.type || '—'
          counts.set(t, (counts.get(t) ?? 0) + 1)
        }
        const alternatives = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count }))
        suggest = {
          reason: 'no_results_for_type',
          original_type: filters.type,
          alternatives,
        }
      }
    }

    return new Response(
      JSON.stringify({
        filters,
        total,
        rendered: results.length,
        results: results.map((r) => ({
          score: r.score,
          hits: r.hits,
          property: r.property,
        })),
        ...(suggest && { suggest }),
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
