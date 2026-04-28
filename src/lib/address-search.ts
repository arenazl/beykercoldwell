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

/**
 * Busca direcciones contra Nominatim. Devuelve [] si query < 3 chars o
 * si hay error de red. Resultados cacheados durante la sesión.
 */
export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const cached = cache.get(q.toLowerCase())
  if (cached) return cached

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('q', q)
  url.searchParams.set('countrycodes', 'ar')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '6')

  const res = await fetch(url.toString(), {
    signal,
    headers: { 'Accept-Language': 'es' },
  })
  if (!res.ok) return []

  const raw = (await res.json()) as NominatimRaw[]
  const out = raw.map(normalize)

  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(q.toLowerCase(), out)
  return out
}
