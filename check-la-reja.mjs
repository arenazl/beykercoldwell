import { PROPERTIES } from './src/data/properties.ts'

const target = 'la reja'
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const titleHits = PROPERTIES.filter((p) => norm(p.title || '').includes(target))
console.log(`Propiedades con "${target}" en title:`, titleHits.length)
for (const p of titleHits) {
  console.log(`  ${p.id} | type=${p.type} | location="${p.location}" | inferred=${p.locationInferred}`)
  console.log(`     title: ${(p.title || '').slice(0, 90)}`)
}

console.log('\n--- Simulando matchesLocation ---')
function looksLikeStreet(text, t) {
  const idx = text.indexOf(t)
  if (idx <= 0) return false
  const before = text.slice(Math.max(0, idx - 30), idx).toLowerCase()
  return /(perito|cardenal|av\.?|avda\.?|avenida|calle|pje\.?|pasaje|ruta|presidente|gobernador|coronel|general|gral\.?|dr\.?|santiago|alfonso|mariano|pedro)\s*$/.test(before)
}
function matches(p, t) {
  const ln = norm(p.location)
  if (ln) return { match: ln.includes(t), via: 'location', value: p.location }
  const tn = norm(p.title)
  if (!tn.includes(t)) return { match: false, via: 'title-miss', value: '' }
  if (looksLikeStreet(tn, t)) return { match: false, via: 'street-rejected', value: '' }
  return { match: true, via: 'title', value: p.title.slice(0, 70) }
}
for (const p of titleHits) {
  const r = matches(p, target)
  console.log(`  ${p.id} → ${r.match ? '✓' : '✗'} via=${r.via} ${r.value}`)
}
