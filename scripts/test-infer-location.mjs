import { readFileSync } from 'node:fs'

const raw = JSON.parse(readFileSync('src/data/cb-argentina.json', 'utf8'))

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const AMBIGUOUS = new Set(['capital', 'centro', 'norte', 'sur', 'oeste', 'este', 'boca', 'tigre'])

function looksLikeStreet(text, target) {
  const idx = text.indexOf(target)
  if (idx <= 0) return false
  const before = text.slice(Math.max(0, idx - 30), idx).toLowerCase()
  return /(perito|cardenal|av\.?|avda\.?|avenida|calle|pje\.?|pasaje|ruta|presidente|gobernador|coronel|general|gral\.?|dr\.?|santiago|alfonso|mariano|pedro)\s*$/.test(
    before
  )
}

const dict = new Map()
for (const p of raw.properties) {
  if (!p.location?.trim()) continue
  const parts = p.location.split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length) continue
  const city = parts[parts.length - 1]
  const cityNorm = norm(city)
  if (!cityNorm || cityNorm.length < 4) continue
  if (AMBIGUOUS.has(cityNorm)) continue
  if (!dict.has(cityNorm)) dict.set(cityNorm, p.location)
}

const list = [...dict.entries()]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([n, full]) => ({
    n,
    full,
    rx: new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
  }))

let inferred = 0
const breakdown = new Map()
for (const p of raw.properties) {
  if (p.location?.trim()) continue
  const t = norm(p.title || '')
  for (const { n, full, rx } of list) {
    if (!rx.test(t)) continue
    if (looksLikeStreet(t, n)) continue
    inferred++
    breakdown.set(full, (breakdown.get(full) || 0) + 1)
    break
  }
}

const total = raw.properties.length
const conLoc = raw.properties.filter((p) => p.location?.trim()).length
const sinLoc = total - conLoc

console.log('=== AUDIT location inference ===')
console.log('Total:', total)
console.log('Con location (original):', conLoc, `(${(conLoc / total * 100).toFixed(1)}%)`)
console.log('SIN location (original):', sinLoc, `(${(sinLoc / total * 100).toFixed(1)}%)`)
console.log('Inferidas desde title:', inferred, `(${(inferred / total * 100).toFixed(1)}%)`)
console.log('Restantes sin location post-fix:', sinLoc - inferred)
console.log('Cobertura final:', conLoc + inferred, `(${((conLoc + inferred) / total * 100).toFixed(1)}%)`)
console.log()
console.log('Top 15 zonas inferidas:')
;[...breakdown.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) =>
  console.log(`  ${v}\t${k}`)
)

// Test Moreno casas
const casasMoreno = raw.properties.filter((p) => p.type === 'Casa').filter((p) => {
  let loc = p.location
  if (!loc?.trim()) {
    const t = norm(p.title || '')
    for (const { n, full, rx } of list) {
      if (rx.test(t) && !looksLikeStreet(t, n)) {
        loc = full
        break
      }
    }
  }
  return loc && norm(loc).includes('moreno')
})
console.log()
console.log('=== Casas en "Moreno" después del fix ===')
console.log('Total:', casasMoreno.length)
casasMoreno.forEach((c) => console.log('  · ' + (c.location || '(inferida)') + ' — ' + c.title.slice(0, 70)))
