/**
 * Pre-índice de "features" estandarizadas por propiedad. Convierte el
 * texto libre del title+description en un `Set<Feature>` que se chequea
 * con lookup O(1) en lugar de `String.includes` en cada query.
 *
 * El diccionario se mantiene acá centralizado. Cada feature tiene una
 * lista de variantes (con/sin tilde, sinónimos) que se buscan como
 * substring tras normalizar (lower + strip tildes). NO se hardcodea
 * dominio en los prompts: la IA recibe la lista de feature keys y
 * devuelve cuáles son requeridas.
 *
 * Cuando agregar una feature nueva: sumar entry acá, sin tocar nada más.
 */

export type Feature =
  | 'pileta'
  | 'cochera'
  | 'parrilla'
  | 'balcon'
  | 'terraza'
  | 'patio'
  | 'quincho'
  | 'amenities'
  | 'gym'
  | 'sum'
  | 'lavadero'
  | 'vestidor'
  | 'baulera'
  | 'ascensor'
  | 'jardin'
  | 'apto_credito'
  | 'apto_profesional'
  | 'seguridad_24h'
  | 'vista_despejada'
  | 'luminoso'
  | 'a_estrenar'
  | 'en_pozo'
  | 'reciclado'
  | 'dependencia'

interface FeatureDef {
  key: Feature
  /** Etiqueta legible para mostrar en chips/hits. */
  label: string
  /** Variantes a buscar como substring contra title+desc normalizados. */
  patterns: string[]
}

const DICT: FeatureDef[] = [
  { key: 'pileta', label: 'Pileta', patterns: ['pileta', 'piscina'] },
  { key: 'cochera', label: 'Cochera', patterns: ['cochera', 'garage', 'garaje'] },
  { key: 'parrilla', label: 'Parrilla', patterns: ['parrilla', 'asador'] },
  { key: 'balcon', label: 'Balcón', patterns: ['balcon'] },
  { key: 'terraza', label: 'Terraza', patterns: ['terraza'] },
  { key: 'patio', label: 'Patio', patterns: ['patio'] },
  { key: 'quincho', label: 'Quincho', patterns: ['quincho'] },
  { key: 'amenities', label: 'Amenities', patterns: ['amenities', 'amenity'] },
  { key: 'gym', label: 'Gimnasio', patterns: ['gym', 'gimnasio'] },
  { key: 'sum', label: 'SUM', patterns: ['sum ', ' sum.', 'salon de usos'] },
  { key: 'lavadero', label: 'Lavadero', patterns: ['lavadero', 'laundry'] },
  { key: 'vestidor', label: 'Vestidor', patterns: ['vestidor', 'walk in'] },
  { key: 'baulera', label: 'Baulera', patterns: ['baulera'] },
  { key: 'ascensor', label: 'Ascensor', patterns: ['ascensor'] },
  { key: 'jardin', label: 'Jardín', patterns: ['jardin', 'parque privado', 'parque propio'] },
  { key: 'apto_credito', label: 'Apto crédito', patterns: ['apto credito', 'apto credit', 'apto cr ', 'apto cr.', 'apto-credito'] },
  { key: 'apto_profesional', label: 'Apto profesional', patterns: ['apto profesional', 'apto consultor', 'consultorio'] },
  { key: 'seguridad_24h', label: 'Seguridad 24h', patterns: ['seguridad 24', 'vigilancia 24', 'seguridad las 24'] },
  { key: 'vista_despejada', label: 'Vista despejada', patterns: ['vista despejada', 'vista panor', 'vista al rio', 'vista abierta'] },
  { key: 'luminoso', label: 'Luminoso', patterns: ['luminoso', 'luminosa', 'muy luminos', 'gran luminosidad'] },
  { key: 'a_estrenar', label: 'A estrenar', patterns: ['a estrenar', 'estrena', 'estrenar'] },
  { key: 'en_pozo', label: 'En pozo', patterns: ['en pozo', 'pre venta', 'preventa', 'en construccion'] },
  { key: 'reciclado', label: 'Reciclado', patterns: ['reciclad', 'a reciclar', 'reciclar'] },
  { key: 'dependencia', label: 'Dependencia de servicio', patterns: ['dependencia', 'cuarto de servicio'] },
]

const FEATURE_KEYS: Feature[] = DICT.map((d) => d.key)
const FEATURE_LABELS: Record<Feature, string> = Object.fromEntries(
  DICT.map((d) => [d.key, d.label]),
) as Record<Feature, string>

/** Lista de keys disponibles para el prompt de Gemini. */
export function listFeatureKeys(): readonly Feature[] {
  return FEATURE_KEYS
}

/** Label legible (para chips de UI o hits). */
export function featureLabel(key: Feature): string {
  return FEATURE_LABELS[key] ?? key
}

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Indexa una propiedad: detecta cuáles features están presentes en
 * `title + description` y devuelve el Set. Se llama una vez por propiedad
 * al cargar el catálogo.
 */
export function detectFeatures(text: string): Set<Feature> {
  const norm = normalize(text)
  const out = new Set<Feature>()
  for (const def of DICT) {
    for (const p of def.patterns) {
      if (norm.includes(p)) {
        out.add(def.key)
        break
      }
    }
  }
  return out
}
