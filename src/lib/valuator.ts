import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY
const modelName =
  process.env.GEMINI_MODEL ?? import.meta.env.GEMINI_MODEL ?? 'gemini-1.5-flash'

let client: GoogleGenerativeAI | null = null
function getClient(): GoogleGenerativeAI | null {
  if (!apiKey) return null
  if (!client) client = new GoogleGenerativeAI(apiKey)
  return client
}

export function isEnabled(): boolean {
  return Boolean(apiKey)
}

export type PropertyType =
  | 'Departamento' | 'Casa' | 'PH' | 'Casa Quinta' | 'Lote' | 'Local' | 'Oficina' | 'Cochera'

export type PropertyState = 'a estrenar' | 'excelente' | 'bueno' | 'regular' | 'a refaccionar'

export interface ValuatorInput {
  type: PropertyType
  location: string
  street: string
  streetNumber: string
  floor?: string
  unit?: string
  surfaceTotalM2: number
  surfaceCoveredM2?: number
  rooms?: number
  bedrooms?: number
  bathrooms?: number
  ageYears?: number
  state: PropertyState
  features: string[]
  expensesArs?: number
  orientation?: string
  notes?: string
}

export interface ValuatorComparable {
  description: string
  surfaceM2: number
  pricePerM2USD: number
  totalPriceUSD: number
  reason: string
}

export interface ValuatorOutput {
  pricePerM2USD: { low: number; typical: number; high: number }
  totalPriceUSD: { low: number; typical: number; high: number }
  confidence: 'alta' | 'media' | 'baja'
  marketSummary: string
  comparables: ValuatorComparable[]
  factorsUp: string[]
  factorsDown: string[]
  commercialStrategy: string
  recommendations: string[]
  caveats: string
}

export async function valuateProperty(input: ValuatorInput): Promise<ValuatorOutput> {
  const genAI = getClient()
  if (!genAI) throw new Error('GEMINI_API_KEY no configurada')

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  })

  const prompt = `Sos un tasador inmobiliario senior con foco en Argentina (CABA, GBA, principales capitales). Trabajás con metodología ACM (Análisis Comparativo de Mercado) basada en operaciones reales del mercado al día de hoy.

Recibís los datos de una propiedad y devolvés un JSON con la valuación, comparables plausibles para la zona, factores de ajuste y recomendaciones comerciales.

Devolvé exclusivamente JSON con esta estructura exacta (todos los campos obligatorios):

{
  "pricePerM2USD": {
    "low": number,
    "typical": number,
    "high": number
  },
  "totalPriceUSD": {
    "low": number,
    "typical": number,
    "high": number
  },
  "confidence": "alta" | "media" | "baja",
  "marketSummary": "Párrafo de 2-3 oraciones describiendo el mercado actual de la zona y tipología.",
  "comparables": [
    {
      "description": "Texto corto identificando la propiedad comparable (ej: 'Depto 2 amb en Recoleta, edificio 2010, cochera').",
      "surfaceM2": number,
      "pricePerM2USD": number,
      "totalPriceUSD": number,
      "reason": "Por qué es comparable a la propiedad evaluada (similitud y diferencias)."
    }
  ],
  "factorsUp": ["Lista de factores que SUMAN al valor de esta propiedad específica."],
  "factorsDown": ["Lista de factores que RESTAN al valor de esta propiedad específica."],
  "commercialStrategy": "Recomendación de estrategia de publicación: precio inicial sugerido, expectativa de tiempo en mercado, margen de negociación esperado.",
  "recommendations": ["Acciones concretas que el propietario puede tomar antes de salir al mercado para mejorar el precio."],
  "caveats": "Advertencias sobre la valuación: limitaciones de no haber visitado, supuestos asumidos, recomendación de tasación presencial."
}

Reglas duras:
- NO inventes precios sin sustento. Usá tu conocimiento general del mercado argentino y la zona.
- Si los datos son insuficientes para una banda angosta, devolvé "confidence" = "baja" y banda más amplia.
- 3 a 5 comparables. Que sean plausibles para la zona y tipología (no copies datos del prompt; generá con criterio).
- pricePerM2USD * surfaceTotalM2 debe ser coherente con totalPriceUSD (típico ≈ pricePerM2USD.typical * surfaceTotalM2).
- Tono profesional, conciso, en español rioplatense (vos).
- En "caveats" dejá claro que es una valuación orientativa por IA y que la tasación final requiere visita presencial.

Datos de la propiedad a valuar:
- Tipo: ${input.type}
- Dirección exacta: ${input.street} ${input.streetNumber}${input.floor ? `, piso ${input.floor}` : ''}${input.unit ? `, depto ${input.unit}` : ''}
- Zona / Barrio / Ciudad: ${input.location}
- Superficie total: ${input.surfaceTotalM2} m²
${input.surfaceCoveredM2 ? `- Superficie cubierta: ${input.surfaceCoveredM2} m²` : ''}
${input.rooms ? `- Ambientes: ${input.rooms}` : ''}
${input.bedrooms ? `- Dormitorios: ${input.bedrooms}` : ''}
${input.bathrooms ? `- Baños: ${input.bathrooms}` : ''}
${input.ageYears != null ? `- Antigüedad: ${input.ageYears} años` : ''}
- Estado: ${input.state}
${input.features.length ? `- Características: ${input.features.join(', ')}` : ''}
${input.expensesArs ? `- Expensas mensuales (ARS): ${input.expensesArs.toLocaleString('es-AR')}` : ''}
${input.orientation ? `- Orientación: ${input.orientation}` : ''}
${input.notes ? `- Notas adicionales: ${input.notes.replace(/"/g, '\\"')}` : ''}

Tené en cuenta para el ajuste fino: la altura de la calle (cuadra específica), el piso (mejor cotización a mayor altura por luz/vistas en general, salvo último piso con problemas), la orientación (norte / contrafrente / lateral), y la posición exacta dentro del barrio (si es zona premium del barrio o periférica).`

  const result = await model.generateContent(prompt)
  const txt = result.response.text()
  const parsed = JSON.parse(txt) as ValuatorOutput

  if (!parsed.pricePerM2USD || !parsed.totalPriceUSD) {
    throw new Error('Respuesta inválida del modelo: faltan bandas de precio')
  }

  return parsed
}
