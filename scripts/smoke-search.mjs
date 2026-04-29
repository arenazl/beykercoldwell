#!/usr/bin/env node
/**
 * Smoke test: corre 50 prompts en lenguaje natural contra el endpoint
 * /api/ai-search del dev server local y reporta qué filtros extrajo
 * Gemini y cuántos matches devolvió.
 *
 * Uso (en otra terminal correr `npm run dev` antes):
 *   node scripts/smoke-search.mjs
 *
 * O setear BASE distinta:
 *   BASE=https://beykercoldwell.netlify.app node scripts/smoke-search.mjs
 */

const BASE = process.env.BASE ?? 'http://localhost:4321'

const QUERIES = [
  // 1-10: Búsquedas típicas con tipo + zona + presupuesto
  'departamento 2 ambientes en Palermo hasta 200k',
  'casa con pileta en Pilar para vivir',
  'PH en Caballito hasta 150k apto crédito',
  'departamento a estrenar en Recoleta',
  'casa quinta en Pilar para fin de semana',
  'monoambiente en CABA hasta 100k',
  'departamento 3 dormitorios en Belgrano',
  'casa con jardín y parrilla en zona norte',
  'oficina en Microcentro para alquilar',
  'lote en Tigre hasta 80k',

  // 11-20: Negaciones y exclusiones
  'departamento en Palermo SIN reciclar',
  'casa que NO esté en pozo, en Pilar',
  'departamento a estrenar pero NO en construcción',
  'PH sin balcón francés en CABA',
  'casa sin pileta para inversión',
  'departamento que no necesite refacción',
  'casa fuera de countries en zona norte',
  'departamento sin amenities, simple, en Almagro',
  'PH no apto profesional',
  'casa que no sea reciclada en Caballito',

  // 21-30: Múltiples requisitos duros (AND)
  'departamento con pileta Y cochera Y parrilla en Belgrano',
  'casa con quincho y pileta y jardín en Pilar',
  'departamento luminoso con balcón y vista despejada',
  'PH apto crédito con patio en CABA',
  'departamento con cochera, baulera y amenities en Recoleta',
  'casa con dependencia de servicio en Vicente López',
  'departamento con seguridad 24h y gym',
  'PH 3 ambientes con terraza y parrilla',
  'casa con vestidor y dependencia en San Isidro',
  'departamento con balcón aterrazado y vista al río',

  // 31-40: Rangos numéricos
  'departamento 2 a 3 dormitorios entre 150k y 250k',
  'casa más de 200 m² en zona oeste',
  'departamento hasta 80 m² en CABA',
  'PH menos de 30 años de antigüedad en Palermo',
  'casa de no más de 10 años en Tigre',
  'departamento a estrenar 1 ambiente en Recoleta',
  'departamento de menos de 5 años en Belgrano',
  'casa entre 300 y 500k en Pilar',
  'monoambiente menos de 50 m² en Microcentro',
  'departamento 2 baños en CABA',

  // 41-50: Edge cases / lenguaje natural raro
  'algo barato en Caballito',
  'mi primer depto, apto crédito, hasta 150',
  'casa para mudarse con familia, 3 dorm, en zona norte',
  'inversión segura, alquiler asegurado, CABA',
  'departamento luminoso, moderno, premium, en Palermo',
  'cualquier cosa en La Reja',
  'depto en Boca Ratón',
  'casa quinta cerca de la ciudad para escapadas',
  'oficina pro consultorio médico apto profesional',
  'PH soleado con doble vista, balcón y patio, hasta 180k',
]

async function runOne(query) {
  const t0 = Date.now()
  try {
    const r = await fetch(`${BASE}/api/ai-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const data = await r.json()
    return { query, ms: Date.now() - t0, status: r.status, ...data }
  } catch (err) {
    return { query, error: err.message, ms: Date.now() - t0 }
  }
}

function fmt(o) {
  if (!o) return ''
  return Object.entries(o)
    .filter(([k, v]) =>
      ['type', 'operacion', 'location_includes', 'minPriceUSD', 'maxPriceUSD',
        'minBedrooms', 'maxBedrooms', 'featuresRequired', 'keywordsRequired',
        'keywordsExcluded', 'keywords', 'aEstrenar', 'maxAntiguedad',
        'out_of_scope'].includes(k) &&
      v != null &&
      (Array.isArray(v) ? v.length > 0 : v !== ''),
    )
    .map(([k, v]) => `${k}=${Array.isArray(v) ? '[' + v.join(',') + ']' : v}`)
    .join(' · ')
}

async function main() {
  console.log(`BASE=${BASE}`)
  console.log(`Probando ${QUERIES.length} queries...\n`)

  const out = []
  for (let i = 0; i < QUERIES.length; i++) {
    process.stdout.write(`${(i + 1).toString().padStart(2)}/${QUERIES.length} ... `)
    const r = await runOne(QUERIES[i])
    out.push(r)
    if (r.error) {
      console.log(`ERROR: ${r.error}`)
    } else if (r.status >= 400) {
      console.log(`HTTP ${r.status} · ${r.error || ''}`)
    } else {
      console.log(`${r.total} matches · ${r.ms}ms`)
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  console.log('\n=== DETALLE ===\n')
  for (const r of out) {
    console.log(`▸ "${r.query}"`)
    if (r.error || r.status >= 400) {
      console.log(`  ✗ ${r.error || `HTTP ${r.status}`}`)
      continue
    }
    console.log(`  ${r.total} matches · ${r.ms}ms · rendered=${r.rendered ?? '?'}`)
    console.log(`  filtros: ${fmt(r.filters)}`)
    if (r.results?.length) {
      r.results.slice(0, 2).forEach((it) => {
        const t = (it.property?.title || '').slice(0, 70)
        console.log(`    · ${t}`)
      })
    }
    console.log('')
  }

  const errors = out.filter((r) => r.error || r.status >= 400).length
  const ok = out.filter((r) => !r.error && r.status < 400)
  const zeros = ok.filter((r) => r.total === 0 && !r.filters?.out_of_scope).length
  const oos = ok.filter((r) => r.filters?.out_of_scope).length
  const usedFeatures = ok.filter((r) => r.filters?.featuresRequired?.length).length
  const usedExcluded = ok.filter((r) => r.filters?.keywordsExcluded?.length).length
  const usedRequired = ok.filter((r) => r.filters?.keywordsRequired?.length).length
  const avgMs = Math.round(ok.reduce((a, b) => a + b.ms, 0) / Math.max(ok.length, 1))

  console.log('=== AGREGADO ===')
  console.log(`Total: ${out.length}`)
  console.log(`OK: ${ok.length}`)
  console.log(`Errores: ${errors}`)
  console.log(`0 matches reales: ${zeros}`)
  console.log(`Out-of-scope detectados: ${oos}`)
  console.log(`Usaron featuresRequired: ${usedFeatures}`)
  console.log(`Usaron keywordsRequired: ${usedRequired}`)
  console.log(`Usaron keywordsExcluded: ${usedExcluded}`)
  console.log(`Latencia promedio: ${avgMs}ms`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
