/**
 * Las 24 jurisdicciones de Argentina (23 provincias + CABA).
 * `nominatim` es el string exacto que devuelve OSM/Nominatim en el campo
 * `address.state`, lo usamos para filtrar resultados del autocomplete.
 * `label` es lo que mostramos en la UI.
 */
export interface Provincia {
  nominatim: string
  label: string
}

export const PROVINCIAS: readonly Provincia[] = [
  { nominatim: 'Ciudad Autónoma de Buenos Aires', label: 'CABA' },
  { nominatim: 'Buenos Aires', label: 'Buenos Aires (Provincia)' },
  { nominatim: 'Catamarca', label: 'Catamarca' },
  { nominatim: 'Chaco', label: 'Chaco' },
  { nominatim: 'Chubut', label: 'Chubut' },
  { nominatim: 'Córdoba', label: 'Córdoba' },
  { nominatim: 'Corrientes', label: 'Corrientes' },
  { nominatim: 'Entre Ríos', label: 'Entre Ríos' },
  { nominatim: 'Formosa', label: 'Formosa' },
  { nominatim: 'Jujuy', label: 'Jujuy' },
  { nominatim: 'La Pampa', label: 'La Pampa' },
  { nominatim: 'La Rioja', label: 'La Rioja' },
  { nominatim: 'Mendoza', label: 'Mendoza' },
  { nominatim: 'Misiones', label: 'Misiones' },
  { nominatim: 'Neuquén', label: 'Neuquén' },
  { nominatim: 'Río Negro', label: 'Río Negro' },
  { nominatim: 'Salta', label: 'Salta' },
  { nominatim: 'San Juan', label: 'San Juan' },
  { nominatim: 'San Luis', label: 'San Luis' },
  { nominatim: 'Santa Cruz', label: 'Santa Cruz' },
  { nominatim: 'Santa Fe', label: 'Santa Fe' },
  { nominatim: 'Santiago del Estero', label: 'Santiago del Estero' },
  { nominatim: 'Tierra del Fuego', label: 'Tierra del Fuego' },
  { nominatim: 'Tucumán', label: 'Tucumán' },
] as const

/** Para fuzzy match: normaliza tildes/mayúsculas. */
export function normalizeProvinceName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
