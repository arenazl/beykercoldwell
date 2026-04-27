import { readFileSync, writeFileSync } from 'node:fs'
const FILE = 'src/data/cb-argentina-details.json'
const j = JSON.parse(readFileSync(FILE, 'utf8'))
let kept = 0, removed = 0
for (const [id, d] of Object.entries(j.details)) {
  if (!d.city && !d.province) {
    delete j.details[id]
    removed++
  } else {
    kept++
  }
}
writeFileSync(FILE, JSON.stringify(j))
console.log(`kept: ${kept} | removed: ${removed} | total now: ${Object.keys(j.details).length}`)
