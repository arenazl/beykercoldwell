import { readFileSync } from 'node:fs'

const raw = JSON.parse(readFileSync('./src/data/cb-argentina.json', 'utf8'))
const det = JSON.parse(readFileSync('./src/data/cb-argentina-details.json', 'utf8')).details || {}

const props = (raw.properties || []).map((p) => {
  const d = det[p.id] || {}
  let loc = p.location
  if (!loc?.trim() && d.province && d.city) loc = `${d.province}, ${d.city}`
  else if (!loc?.trim() && d.city) loc = d.city
  else if (!loc?.trim() && d.province) loc = d.province
  return { ...p, location: loc || '(sin ubicación)' }
})

const byBarrio = {}
for (const p of props) {
  const parts = (p.location || '').split(',').map((s) => s.trim()).filter(Boolean)
  const barrio = parts[parts.length - 1] || '(sin ubicación)'
  byBarrio[barrio] = (byBarrio[barrio] || 0) + 1
}

const sorted = Object.entries(byBarrio).sort((a, b) => b[1] - a[1])
console.log(`Total propiedades: ${props.length}`)
console.log(`Total barrios:     ${sorted.length}`)
console.log('')
console.log(JSON.stringify(Object.fromEntries(sorted), null, 2))
