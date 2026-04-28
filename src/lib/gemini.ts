import { GoogleGenerativeAI } from '@google/generative-ai'
import { listFeatureKeys } from './feature-index'

const apiKey = process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY
const modelName =
  process.env.GEMINI_MODEL ?? import.meta.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

let client: GoogleGenerativeAI | null = null
function getClient(): GoogleGenerativeAI | null {
  if (!apiKey) return null
  if (!client) client = new GoogleGenerativeAI(apiKey)
  return client
}

export function isEnabled(): boolean {
  return Boolean(apiKey)
}

/**
 * Extrae filtros estructurados a partir de una consulta en lenguaje natural.
 *
 * El schema de filtros se deriva del catálogo de propiedades — no hardcodeamos
 * zonas ni tipos. La IA recibe en el prompt los valores reales presentes en
 * los datos para que su output sea consistente con lo que tenemos.
 */
export interface AISearchFilters {
  operacion?: string
  type?: string
  location_includes?: string
  minPriceUSD?: number
  maxPriceUSD?: number
  minBedrooms?: number
  maxBedrooms?: number
  minBathrooms?: number
  minSurfaceM2?: number
  maxSurfaceM2?: number
  /** Edad máxima de la propiedad. 0 = solo a estrenar / en pozo. */
  maxAntiguedad?: number
  /** true = solo "a estrenar" o "en pozo" */
  aEstrenar?: boolean
  /** Keywords con scoring "soft" — suman puntos al ranking pero no descartan. */
  keywords?: string[]
  /** Keywords obligatorias — TODAS deben aparecer en title+description.
   * Usar SOLO si la palabra NO está en `featuresRequired`. */
  keywordsRequired?: string[]
  /** Keywords prohibidas — NINGUNA puede aparecer. Usar para negaciones:
   * "sin reciclar", "que no esté en pozo", "no balcón francés". */
  keywordsExcluded?: string[]
  /** Features estandarizadas obligatorias (preferir sobre keywordsRequired
   *  cuando exista equivalente en el diccionario — ver feature-index.ts).
   *  Lookup O(1) contra Property.features pre-computado. */
  featuresRequired?: string[]
  summary: string
  follow_up?: string
  /** true cuando el cliente pide algo fuera del alcance del catálogo (ej: ubicación en otro país). */
  out_of_scope?: boolean
  /** Mensaje al usuario explicando por qué la consulta cae fuera del catálogo. */
  out_of_scope_message?: string
}

export interface SchemaContext {
  tipos: string[]
  operaciones: string[]
  ubicaciones: string[]
  total: number
}

export async function extractFilters(
  query: string,
  schema: SchemaContext
): Promise<AISearchFilters> {
  const genAI = getClient()
  if (!genAI) throw new Error('GEMINI_API_KEY no configurada')

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  })

  const prompt = `Sos un asistente inmobiliario de Coldwell Banker Argentina. Tu trabajo es traducir lo que pide el cliente a un filtro estructurado sobre nuestro catálogo.

CATÁLOGO (estado actual, fuente de verdad):
- País / alcance: Argentina exclusivamente (CABA, GBA, capitales del interior). NO operamos fuera del país.
- Total propiedades: ${schema.total}
- Tipos disponibles: ${schema.tipos.join(', ')}
- Operaciones disponibles: ${schema.operaciones.join(', ')}
- Ubicaciones DISPONIBLES (lista exacta, formato "provincia/zona, barrio/ciudad"):
${schema.ubicaciones.map((u) => `  · ${u}`).join('\n')}

Devolvé JSON con esta forma exacta:
{
  "operacion": "venta" | "alquiler" | null,
  "type": "Departamento" | "Casa" | "PH" | "Casa Quinta" | "Lote" | "Local" | "Oficina" | null,
  "location_includes": "substring que matchee al menos una entrada de la lista de ubicaciones de arriba (ej: 'Recoleta', 'Boca', 'Pilar') o null",
  "minPriceUSD": number | null,
  "maxPriceUSD": number | null,
  "minBedrooms": number | null,
  "maxBedrooms": number | null,
  "minBathrooms": number | null,
  "minSurfaceM2": number | null,
  "maxSurfaceM2": number | null,
  "maxAntiguedad": number | null,
  "aEstrenar": true | false | null,
  "featuresRequired": ["features estandarizadas REQUERIDAS — usar PREFERENTEMENTE para requisitos duros. Lista cerrada: ${JSON.stringify(listFeatureKeys())}. Ej: 'pileta' si dijo 'con pileta', 'apto_credito' si dijo 'apto crédito'."],
  "keywords": ["palabras 'soft' que ranquean mejor si aparecen, pero no descartan. Ej: adjetivos sueltos no presentes en featuresRequired."],
  "keywordsRequired": ["palabras OBLIGATORIAS libres — usar SOLO cuando el requisito no exista en featuresRequired. Si la palabra está en la lista de features, usá featuresRequired."],
  "keywordsExcluded": ["palabras PROHIBIDAS — ninguna puede aparecer. Usar para negaciones explícitas. Ej: 'pozo' si dijo 'que NO esté en pozo', 'reciclar' si dijo 'sin reciclar'."],
  "summary": "Resumen amigable de lo que entendiste, en 1 oración. Tutealo (vos), tono argentino.",
  "follow_up": "Pregunta corta si la consulta es ambigua o falta info clave (ej: '¿Para vivir o invertir?'). null si no hace falta.",
  "out_of_scope": true | false,
  "out_of_scope_message": "Mensaje al usuario explicando que esa búsqueda cae fuera del catálogo (ej: 'No operamos en Boca Ratón, FL — nuestro catálogo es exclusivamente Argentina.'). null si la consulta es válida."
}

REGLAS DE UBICACIÓN (críticas, no opcionales):
- "location_includes" debería preferentemente ser un substring que matchee AL MENOS UNA entrada de la lista. Pero el matching server-side también busca en título + descripción de cada propiedad — así que si el usuario menciona claramente un barrio/localidad de Argentina (ej: "La Reja", "Tristán Suárez", "Villa Devoto"), seteá igual "location_includes" con ese nombre aunque no aparezca exacto en la lista de arriba. NO lo inventes solo si el usuario no mencionó ningún lugar.
- Resolución case-insensitive y parcial: si el usuario escribe "boca" y la lista contiene "Capital Federal, Boca" → location_includes: "Boca". Si escribe "palermo" → "Palermo".
- Typos / variantes / "boca raton" interpretado como "boca": si parece un typo o extensión de un barrio AR conocido (ej: "boca raton" → puede ser "Boca"), elegí la opción AR y agregá un follow_up confirmando ("¿Te referías a La Boca, en CABA?").
- Si la ubicación pedida claramente NO es Argentina (ej: "Miami", "Madrid", "Boca Ratón Florida", "Cancún", "Punta del Este"): out_of_scope: true, location_includes: null, redactá out_of_scope_message explicando que el catálogo es exclusivamente AR.
- Si no se menciona ubicación, location_includes: null y out_of_scope: false.

Otras reglas:
- "departamento", "depto", "depa" → type "Departamento".
- "casa quinta" o "quinta" → type "Casa Quinta".
- "apto crédito", "credito hipotecario" → keyword "apto credito".
- "Capital", "CABA", "Capital Federal" → location_includes "Capital Federal".
- Precios: "hasta 200k", "200 mil" → maxPriceUSD: 200000. "entre 100 y 200" → min/max.
- "a estrenar", "estrenar", "en pozo", "preventa", "nueva construcción" → aEstrenar: true.
- "no más de 10 años", "hasta 5 años antigüedad" → maxAntiguedad: número.
- "moderno", "reciente" → maxAntiguedad: 15 (opcional, si no es claro dejá null).
- "antigua", "estilo francés", "estilo italiano" → NO setear maxAntiguedad (es estilo, no edad).
- Si pide "barato" sin número → no inventes precio, dejá null y agregá follow_up preguntando rango.
- NO inventes valores. Si algo no está claro, dejalo null.

Consulta del cliente: "${query.replace(/"/g, '\\"')}"`

  const result = await model.generateContent(prompt)
  const txt = result.response.text()
  const parsed = JSON.parse(txt) as AISearchFilters

  // Sanitización: convertir nulls a undefined para que el filtro server-side
  // los ignore con un simple `if (filter.x != null)`.
  for (const k of Object.keys(parsed) as (keyof AISearchFilters)[]) {
    if ((parsed as unknown as Record<string, unknown>)[k] === null) {
      delete (parsed as unknown as Record<string, unknown>)[k]
    }
  }
  return parsed
}
