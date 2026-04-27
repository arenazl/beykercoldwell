import { GoogleGenerativeAI } from '@google/generative-ai'

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
  keywords?: string[]
  summary: string
  follow_up?: string
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

Catálogo disponible (${schema.total} propiedades):
- Tipos de propiedad reales: ${schema.tipos.slice(0, 30).join(', ')}
- Operaciones: ${schema.operaciones.join(', ')}
- Ubicaciones más frecuentes (provincia/ciudad): ${schema.ubicaciones.slice(0, 60).join(', ')}

Devolvé JSON con esta forma exacta:
{
  "operacion": "venta" | "alquiler" | null,
  "type": "Departamento" | "Casa" | "PH" | "Casa Quinta" | "Lote" | "Local" | "Oficina" | null,
  "location_includes": "string a buscar dentro del campo location (ej: 'Recoleta', 'Palermo', 'Pilar') o null",
  "minPriceUSD": number | null,
  "maxPriceUSD": number | null,
  "minBedrooms": number | null,
  "maxBedrooms": number | null,
  "minBathrooms": number | null,
  "minSurfaceM2": number | null,
  "maxSurfaceM2": number | null,
  "keywords": ["palabras clave a buscar en title+description, ej: 'apto credito', 'pileta', 'cochera', 'amenities'"],
  "summary": "Resumen amigable de lo que entendiste, en 1 oración. Tutealo (vos), tono argentino.",
  "follow_up": "Pregunta corta si la consulta es ambigua o falta info clave (ej: '¿Para vivir o invertir?', '¿Tenés un presupuesto en mente?'). null si no hace falta."
}

Reglas:
- Si el usuario dice "departamento", "depto", "depa" → type "Departamento".
- Si dice "casa quinta" o "quinta" → type "Casa Quinta".
- "apto crédito", "credito hipotecario" → keyword "apto credito".
- "Capital", "CABA", "Capital Federal" → location_includes "Capital Federal".
- Precios: "hasta 200k", "200 mil" → maxPriceUSD: 200000. "entre 100 y 200" → min/max.
- Si pide "barato" sin número → no inventes precio, dejá null y agregá follow_up preguntando rango.
- NO inventes valores. Si algo no está claro, dejalo null.

Consulta del cliente: "${query.replace(/"/g, '\\"')}"`

  const result = await model.generateContent(prompt)
  const txt = result.response.text()
  const parsed = JSON.parse(txt) as AISearchFilters

  // Sanitización: convertir nulls a undefined para que el filtro server-side
  // los ignore con un simple `if (filter.x != null)`.
  for (const k of Object.keys(parsed) as (keyof AISearchFilters)[]) {
    if ((parsed as Record<string, unknown>)[k] === null) {
      delete (parsed as Record<string, unknown>)[k]
    }
  }
  return parsed
}
