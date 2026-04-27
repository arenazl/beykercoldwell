import type { APIRoute } from 'astro'
import { aiEnabled, mortgageEstimate, type MortgageInput } from '../../lib/ai-tools'
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

  let body: Partial<MortgageInput>
  try {
    body = await request.json()
  } catch {
    return jsonErr('JSON inválido')
  }

  const ingreso = Number(body.ingresoMensualARS)
  const ahorro = Number(body.ahorroUSD)
  const pct = Number(body.cuotaMaxPctIngreso ?? 25)
  const plazo = Number(body.plazoAnios ?? 20)

  if (!ingreso || ingreso <= 0) return jsonErr('ingresoMensualARS inválido')
  if (ahorro == null || ahorro < 0) return jsonErr('ahorroUSD inválido')
  if (pct <= 0 || pct > 100) return jsonErr('cuotaMaxPctIngreso fuera de rango')
  if (plazo <= 0 || plazo > 40) return jsonErr('plazoAnios fuera de rango')

  const input: MortgageInput = {
    ingresoMensualARS: ingreso,
    ahorroUSD: ahorro,
    cuotaMaxPctIngreso: pct,
    plazoAnios: plazo,
  }

  try {
    const r = await mortgageEstimate(input)
    // Filtrá propiedades en venta dentro del rango y con keyword "apto credito".
    const max = r.precioMaxUSD || 0
    const matches = PROPERTIES.filter((p) => {
      if (p.operacion !== 'venta' || p.priceCurrency !== 'USD') return false
      if ((p.priceValue ?? Infinity) > max) return false
      const txt = `${p.title} ${p.description}`.toLowerCase()
      return txt.includes('apto cred') || txt.includes('apto credito') || txt.includes('credito hipot')
    }).slice(0, 12)

    return new Response(
      JSON.stringify({ ...r, matches }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return jsonErr('Error calculando crédito', 500, String((err as Error).message))
  }
}
