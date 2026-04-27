/**
 * Scraper del catálogo público de Coldwell Banker Argentina.
 * Recorre https://coldwellbanker.com.ar/propiedades?page=N hasta vaciarse y
 * extrae los campos factuales de cada card: id, tipo, título, ubicación, precio,
 * ambientes, baños, m², código de referencia, slug y thumbnail.
 *
 * Output: src/data/cb-argentina.json
 *
 * Uso:
 *   node scripts/scrape-cb-argentina.mjs              # full
 *   node scripts/scrape-cb-argentina.mjs --max 50     # solo primeras 50 páginas
 *   node scripts/scrape-cb-argentina.mjs --start 200  # arrancar desde N
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_FILE = resolve(ROOT, 'src/data/cb-argentina.json')
const PROGRESS_FILE = resolve(ROOT, 'src/data/cb-argentina.progress.json')

const BASE = 'https://coldwellbanker.com.ar'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const args = process.argv.slice(2)
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const MAX_PAGE = Number(getArg('max', '1000'))
const START_PAGE = Number(getArg('start', '1'))
const CONCURRENCY = Number(getArg('concurrency', '4'))

/** Decode HTML entities (server returns latin-1ish but headers say utf-8). */
function decode(s) {
  if (!s) return ''
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(s) {
  return decode(String(s || '').replace(/<[^>]+>/g, ' '))
}

/** Extrae un bloque por marcador de inicio/fin. Versión robusta. */
function sliceBetween(html, start, end) {
  const i = html.indexOf(start)
  if (i < 0) return ''
  const j = html.indexOf(end, i + start.length)
  return j < 0 ? html.slice(i) : html.slice(i, j)
}

/**
 * Parsea una página de listado y devuelve array de propiedades con campos factuales.
 * El template de Brokian incluye un `<script type="application/ld+json">` por card con
 * el grueso de la data (name, description, image, offers). Usamos eso como fuente
 * primaria y el HTML solo para campos que no están en el JSON-LD.
 */
function parseListPage(html, pageUrl) {
  const out = []
  const cardRx = /data-id="(\d+)"\s+data-type="([^"]+)"/g
  const positions = []
  for (const m of html.matchAll(cardRx)) positions.push({ id: m[1], type: m[2], idx: m.index ?? 0 })

  for (let i = 0; i < positions.length; i++) {
    const { id, type, idx } = positions[i]
    const next = positions[i + 1]?.idx ?? html.length
    const card = html.slice(idx, next)

    // === JSON-LD por card (fuente primaria) ===
    let ld = null
    const ldMatch = card.match(/<script[^>]*application\/ld\+json[^>]*>\s*([\s\S]*?)\s*<\/script>/)
    if (ldMatch) {
      try { ld = JSON.parse(ldMatch[1]) } catch { /* ignorar */ }
    }

    const title = ld?.name ? stripTags(ld.name) : ''
    const description = ld?.description ? stripTags(ld.description) : ''
    const detailUrl = ld?.url || ''
    const image = ld?.image || (card.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? '')
    const priceValue = ld?.offers?.price ? Number(ld.offers.price) : null
    const priceCurrency = ld?.offers?.priceCurrency || ''
    const priceValidUntil = ld?.offers?.priceValidUntil || ''

    // === Operación: Brokian la pone en el "small" del precio ===
    const operacionMatch = card.match(/Precio de (venta|alquiler|reserva|alquiler temporario)/i)
    const operacion = operacionMatch ? operacionMatch[1].toLowerCase() : ''

    // === Ubicación: <p class="description">Argentina, Provincia, Localidad</p> ===
    const locMatch = card.match(/<p[^>]*class="description"[^>]*>\s*Argentina[,\s]*([^<]+?)\s*<\/p>/i)
    const location = locMatch ? stripTags(locMatch[1]) : ''

    // === Features: cada <li> tiene un dato. Permitimos nested tags (<sup>2</sup>). ===
    const liItems = [...card.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1]))
    let bedrooms = null, bathrooms = null, surfaceM2 = null, reference = ''
    for (const text of liItems) {
      const dorm = text.match(/(\d+)\s*Dormitori/i)
      if (dorm) { bedrooms = Number(dorm[1]); continue }
      const bath = text.match(/(\d+)\s*Ba(?:ñ|n)o/i)
      if (bath) { bathrooms = Number(bath[1]); continue }
      const m2 = text.match(/(\d+(?:[.,]\d+)?)\s*m\s*2/i) ||
                 text.match(/(\d+(?:[.,]\d+)?)\s*m²/i) ||
                 text.match(/^\s*(\d+(?:[.,]\d+)?)\s*m\s*$/i)
      if (m2) { surfaceM2 = Number(m2[1].replace(',', '.')); continue }
      const ref = text.match(/^[A-Z]{2,4}\d{4,}$/)
      if (ref) { reference = text; continue }
    }

    out.push({
      id,
      type,
      title,
      description,
      location,
      operacion,
      priceCurrency,
      priceValue,
      priceValidUntil,
      bedrooms,
      bathrooms,
      surfaceM2,
      reference,
      image,
      detailUrl,
      sourcePage: pageUrl,
    })
  }
  return out
}

async function fetchPage(page, attempt = 1) {
  const url = `${BASE}/propiedades?page=${page}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer': BASE + '/',
      },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const props = parseListPage(html, url)
    return { page, props, ok: true }
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      return fetchPage(page, attempt + 1)
    }
    return { page, props: [], ok: false, error: String(err) }
  }
}

async function pool(items, concurrency, worker) {
  const results = []
  let cursor = 0
  const runners = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return results
}

async function loadProgress() {
  if (!existsSync(OUT_FILE)) return { props: [], seenIds: new Set() }
  try {
    const raw = await readFile(OUT_FILE, 'utf8')
    const data = JSON.parse(raw)
    const props = Array.isArray(data?.properties) ? data.properties : []
    return { props, seenIds: new Set(props.map((p) => p.id)) }
  } catch {
    return { props: [], seenIds: new Set() }
  }
}

async function main() {
  await mkdir(dirname(OUT_FILE), { recursive: true })
  const t0 = Date.now()

  const { props: existing, seenIds } = await loadProgress()
  const allProps = [...existing]
  console.log(`[scrape] resuming with ${existing.length} known properties`)

  let firstEmptyAt = null
  let consecutiveEmpty = 0
  let lastSavedAt = Date.now()

  for (let batchStart = START_PAGE; batchStart <= MAX_PAGE; batchStart += CONCURRENCY) {
    const batch = []
    for (let p = batchStart; p < batchStart + CONCURRENCY && p <= MAX_PAGE; p++) batch.push(p)

    const results = await pool(batch, CONCURRENCY, fetchPage)
    let batchAdded = 0

    for (const r of results) {
      if (!r.ok) {
        console.warn(`[scrape] page=${r.page} FAILED: ${r.error}`)
        continue
      }
      if (r.props.length === 0) {
        consecutiveEmpty++
        if (firstEmptyAt === null) firstEmptyAt = r.page
      } else {
        consecutiveEmpty = 0
        firstEmptyAt = null
      }
      for (const p of r.props) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id)
          allProps.push(p)
          batchAdded++
        }
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(
      `[scrape] pages ${batchStart}..${batchStart + batch.length - 1} | +${batchAdded} new | total=${allProps.length} | ${elapsed}s`
    )

    // Persist every ~10s
    if (Date.now() - lastSavedAt > 10000 || batchAdded > 0) {
      await writeFile(
        OUT_FILE,
        JSON.stringify(
          { scrapedAt: new Date().toISOString(), source: BASE, total: allProps.length, properties: allProps },
          null,
          2
        )
      )
      lastSavedAt = Date.now()
    }

    // Stop if we got 3 consecutive empty pages
    if (consecutiveEmpty >= 3) {
      console.log(`[scrape] 3 consecutive empty pages — stopping at page ${batchStart + batch.length - 1}`)
      break
    }
  }

  await writeFile(
    OUT_FILE,
    JSON.stringify(
      { scrapedAt: new Date().toISOString(), source: BASE, total: allProps.length, properties: allProps },
      null,
      2
    )
  )

  const totalTime = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[scrape] DONE — ${allProps.length} properties in ${totalTime}s -> ${OUT_FILE}`)
}

main().catch((err) => {
  console.error('[scrape] FATAL:', err)
  process.exit(1)
})
