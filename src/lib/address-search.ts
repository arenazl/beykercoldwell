/**
 * Búsqueda de direcciones contra Nominatim de OpenStreetMap.
 * Mismo enfoque que usamos en AGENT_GUIDE/consorcios — gratis, sin API key,
 * sólo Argentina, con debounce y caché en memoria.
 *
 * Política de uso de Nominatim:
 *   https://operations.osmfoundation.org/policies/nominatim/
 * - Identificarse vía User-Agent o Referer (browser ya manda Referer).
 * - Máx 1 req/seg desde el cliente (nuestro debounce de 400ms cumple).
 * - Cachear resultados para no martillar el servicio.
 */

export interface AddressResult {
  /** Identificador único del registro en Nominatim. */
  placeId: number
  /** Texto completo que vamos a mostrar al usuario y guardar como "address". */
  displayName: string
  lat: number
  lng: number
  /** Calle si Nominatim la separó (suele venir en `road`). */
  street: string | null
  /** Altura / número de calle (`house_number`). */
  houseNumber: string | null
  /** Ciudad / localidad / barrio — el primer dato que matchee. */
  city: string | null
  /** Provincia / state. */
  province: string | null
  /** Código postal. */
  postcode: string | null
}

interface NominatimRaw {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    road?: string
    pedestrian?: string
    house_number?: string
    suburb?: string
    neighbourhood?: string
    city?: string
    town?: string
    village?: string
    state?: string
    state_district?: string
    province?: string
    postcode?: string
  }
}

const cache = new Map<string, AddressResult[]>()
const CACHE_MAX = 80

function pickCity(addr: NominatimRaw['address']): string | null {
  if (!addr) return null
  return (
    addr.suburb ||
    addr.neighbourhood ||
    addr.city ||
    addr.town ||
    addr.village ||
    addr.state_district ||
    null
  )
}

function pickProvince(addr: NominatimRaw['address']): string | null {
  if (!addr) return null
  return addr.state || addr.province || null
}

function pickStreet(addr: NominatimRaw['address']): string | null {
  if (!addr) return null
  return addr.road || addr.pedestrian || null
}

function normalize(raw: NominatimRaw): AddressResult {
  return {
    placeId: raw.place_id,
    displayName: raw.display_name,
    lat: Number(raw.lat),
    lng: Number(raw.lon),
    street: pickStreet(raw.address),
    houseNumber: raw.address?.house_number ?? null,
    city: pickCity(raw.address),
    province: pickProvince(raw.address),
    postcode: raw.address?.postcode ?? null,
  }
}

export interface SearchOptions {
  /** Si está seteada, prepende al query para sesgar a Nominatim y filtra
   * los resultados que no matcheen contra `address.state`. */
  province?: string
}

/** key|value para `state` flexible: Nominatim a veces devuelve "Provincia
 * de Buenos Aires" en `address.state`, a veces "Buenos Aires". Comparamos
 * por includes en ambos sentidos para que ambas formas matcheen. */
function provinceMatches(result: AddressResult, target: string): boolean {
  if (!result.province) return false
  const a = result.province.toLowerCase()
  const b = target.toLowerCase()
  return a.includes(b) || b.includes(a)
}

/** Dedupe por (calle, altura, ciudad). Nominatim a veces devuelve 5
 * resultados de la misma cuadra como entries separadas — colapsamos. */
function dedupe(items: AddressResult[]): AddressResult[] {
  const seen = new Set<string>()
  const out: AddressResult[] = []
  for (const r of items) {
    const key = [
      (r.street ?? '').toLowerCase(),
      r.houseNumber ?? '',
      (r.city ?? '').toLowerCase(),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

/**
 * Busca direcciones contra Nominatim. Devuelve [] si query < 3 chars o
 * si hay error de red. Resultados cacheados durante la sesión.
 */
export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
  options?: SearchOptions,
): Promise<AddressResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const cacheKey = `${q.toLowerCase()}|${options?.province ?? ''}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  // Sesgo: si tenemos provincia, la pegamos al query para que Nominatim
  // priorice resultados ahí. Sigue siendo un hint, no un filtro duro.
  url.searchParams.set('q', options?.province ? `${q}, ${options.province}` : q)
  url.searchParams.set('countrycodes', 'ar')
  url.searchParams.set('addressdetails', '1')
  // Subimos a 10 porque después filtramos por provincia y dedupeamos.
  url.searchParams.set('limit', options?.province ? '10' : '6')

  const res = await fetch(url.toString(), {
    signal,
    headers: { 'Accept-Language': 'es' },
  })
  if (!res.ok) return []

  const raw = (await res.json()) as NominatimRaw[]
  let out = raw.map(normalize)

  if (options?.province) {
    out = out.filter((r) => provinceMatches(r, options.province!))
  }
  out = dedupe(out)

  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(cacheKey, out)
  return out
}
