/**
 * Scraper de fichas de detalle. Para cada propiedad en cb-argentina.json,
 * fetcha su detailUrl y extrae los campos estructurados del bloque
 * <ul class="property-info"> que tiene items <li class="col-md-4 col-sm-6 X">.
 *
 * Persiste incremental en cb-argentina-details.json. Resumible.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SOURCE = resolve(ROOT, 'src/data/cb-argentina.json')
const OUT = resolve(ROOT, 'src/data/cb-argentina-details.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const args = process.argv.slice(2)
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const CONCURRENCY = Number(getArg('concurrency', '6'))
const LIMIT = Number(getArg('limit', '99999'))

function decode(s) {
  if (!s) return ''
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
    .replace(/�/g, 'ü')
    .replace(/\s+/g, ' ').trim()
}
function stripTags(s) {
  return decode(String(s || '').replace(/<[^>]+>/g, ' '))
}

const FIELDS = [
  'area',
  'code',
  'type',
  'floors',
  'bedrooms',
  'antiquity',
  'bathrooms',
  'situation',
  'orientation',
  'amenities',
  'expenses',
]

function parseDetail(html) {
  const out = {}
  for (const field of FIELDS) {
    const rx = new RegExp(
      `<li[^>]*class="[^"]*\\b${field}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/li>`,
      'i'
    )
    const m = html.match(rx)
    if (m) {
      // Quitar el <b>Label:</b> y quedarnos solo con el valor.
      const inner = m[1].replace(/<b[^>]*>[^<]+<\/b>/i, '')
      const val = stripTags(inner)
      if (val) out[field] = val
    }
  }
  // Coordenadas si están en script (lat/lng): bonus
  const geo = html.match(/data-lat="(-?\d+\.\d+)"[^>]*data-lng="(-?\d+\.\d+)"/)
  if (geo) {
    out.lat = Number(geo[1])
    out.lng = Number(geo[2])
  }
  // Antigüedad numérica derivada del valor textual
  if (out.antiquity) {
    const t = out.antiquity.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (/estrenar|en pozo|en construccion/.test(t)) out.antiguedadYears = 0
    else {
      const m = t.match(/(\d{1,3})/)
      if (m) {
        const y = Number(m[1])
        if (y >= 0 && y <= 200) out.antiguedadYears = y
      }
    }
  }
  return out
}

async function fetchDetail(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer': 'https://coldwellbanker.com.ar/',
      },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      return fetchDetail(url, attempt + 1)
    }
    throw err
  }
}

async function pool(items, concurrency, worker) {
  let cursor = 0
  let done = 0
  const results = new Array(items.length)
  const runners = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await worker(items[i])
      } catch (err) {
        results[i] = { error: String(err) }
      }
      done++
      if (done % 50 === 0) {
        const pct = ((done / items.length) * 100).toFixed(1)
        console.log(`[detail] ${done}/${items.length} (${pct}%)`)
      }
    }
  })
  await Promise.all(runners)
  return results
}

async function main() {
  await mkdir(dirname(OUT), { recursive: true })
  const t0 = Date.now()

  const raw = JSON.parse(await readFile(SOURCE, 'utf8'))
  const props = raw.properties.slice(0, LIMIT)

  const existing = existsSync(OUT)
    ? JSON.parse(await readFile(OUT, 'utf8'))
    : { details: {} }
  const seen = new Set(Object.keys(existing.details || {}))
  const todo = props.filter((p) => p.detailUrl && !seen.has(p.id))
  console.log(`[detail] total=${props.length} | already_done=${seen.size} | todo=${todo.length}`)

  let saved = 0
  let lastSavedAt = Date.now()

  await pool(todo, CONCURRENCY, async (p) => {
    try {
      const html = await fetchDetail(p.detailUrl)
      const parsed = parseDetail(html)
      existing.details[p.id] = parsed
      saved++

      if (Date.now() - lastSavedAt > 8000) {
        await writeFile(OUT, JSON.stringify({ scrapedAt: new Date().toISOString(), details: existing.details }))
        lastSavedAt = Date.now()
      }
      return parsed
    } catch (err) {
      existing.details[p.id] = { error: String(err) }
    }
  })

  await writeFile(OUT, JSON.stringify({ scrapedAt: new Date().toISOString(), details: existing.details }))
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  const withAge = Object.values(existing.details).filter((d) => d.antiguedadYears != null).length
  console.log(`[detail] DONE — ${Object.keys(existing.details).length} fichas | con antigüedad: ${withAge} | ${elapsed}s`)
}

main().catch((err) => {
  console.error('[detail] FATAL:', err)
  process.exit(1)
})
