import { GoogleGenerativeAI } from '@google/generative-ai'
import { getMarketAnchor, formatAnchorForPrompt, type MarketAnchor } from './market-anchors'

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
  /** Ancla del catálogo propio usada para el cálculo. null si no hubo match suficiente. */
  anchor: MarketAnchor | null
}

export async function valuateProperty(input: ValuatorInput): Promise<ValuatorOutput> {
  const genAI = getClient()
  if (!genAI) throw new Error('GEMINI_API_KEY no configurada')

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      // 4k es suficiente cuando los strings y arrays están acotados (ver
      // límites de longitud en el prompt). Antes había que subir a 8k porque
      // Gemini se entusiasmaba — ahora con caps duros vuelve a entrar holgado.
      maxOutputTokens: 4096,
    },
  })

  const anchor = getMarketAnchor({ type: input.type, location: input.location })
  const anchorBlock = anchor ? `\n\n${formatAnchorForPrompt(anchor)}\n` : ''
  const anchorRules = anchor
    ? `\nAncla (ground truth): typical ∈ [P25, P75]; low ≥ Min, high ≤ Max (salvo justificación en caveats). Comparables del output: priorizá los del ancla, parafraseá descripción. Ancla = precio publicación; tu output = valor de cierre.`
    : ''

  // Schema implícito por responseMimeType: 'application/json'. Solo describimos
  // el shape, no cada campo. Las reglas duras y de mercado se mantienen porque
  // son load-bearing para no over-pricing.
  const prompt = `Tasador inmobiliario senior, mercado argentino (CABA/GBA/capitales), metodología ACM. Devolvé JSON exacto:

{
  "pricePerM2USD": { "low": n, "typical": n, "high": n },
  "totalPriceUSD": { "low": n, "typical": n, "high": n },
  "confidence": "alta" | "media" | "baja",
  "marketSummary": "máx 2 oraciones, ≤40 palabras",
  "comparables": [ { "description": "≤12 palabras", "surfaceM2": n, "pricePerM2USD": n, "totalPriceUSD": n, "reason": "≤15 palabras" } ],
  "factorsUp": ["≤8 palabras c/u"],
  "factorsDown": ["≤8 palabras c/u"],
  "commercialStrategy": "máx 2 oraciones, ≤35 palabras",
  "recommendations": ["≤10 palabras c/u"],
  "caveats": "máx 1 oración, ≤25 palabras"
}

Reglas duras de longitud (críticas para no inflar tokens):
- comparables: EXACTAMENTE 3, ni más ni menos. ${anchor ? 'Priorizá los del ancla, parafraseá description en ≤12 palabras.' : 'Plausibles, descripción corta.'}
- factorsUp: máx 3 items. factorsDown: máx 3 items. recommendations: máx 3 items.
- Strings sin adornos ni adjetivos redundantes. No repitas info entre campos.
- pricePerM2USD.typical × surfaceTotalM2 ≈ totalPriceUSD.typical.
- Datos insuficientes → confidence "baja" + banda más amplia.
- Tono rioplatense (vos), conciso.

Mercado argentino HOY (ilíquido, post-cepo en transición) — estimás VALOR DE CIERRE, no publicación:
- Cierre = publicación − 12–15% (alto en contexto actual; bajá a 8% solo si es CABA premium a estrenar).
- Premiums conservadores: "a estrenar" +10–15% (NO 30%), "excelente" +5–8%. Suma combinada de features (cochera+amenities+pileta) no supera +20% del promedio zona.
- "Regular"/"a refaccionar" descuenta 12–25% — no suavices.
- Cuadra estándar no premium ⇒ no asumas premium por barrio. Avenida ruidosa o cuadra fea NO va al techo.${anchorRules}

Propiedad:
- Tipo: ${input.type}
- Dirección: ${input.street} ${input.streetNumber}${input.floor ? `, piso ${input.floor}` : ''}${input.unit ? `, depto ${input.unit}` : ''}
- Zona: ${input.location}
- Superficie total: ${input.surfaceTotalM2} m²${input.surfaceCoveredM2 ? `, cubierta: ${input.surfaceCoveredM2} m²` : ''}
${input.rooms ? `- Ambientes: ${input.rooms}` : ''}${input.bedrooms ? ` · Dorm: ${input.bedrooms}` : ''}${input.bathrooms ? ` · Baños: ${input.bathrooms}` : ''}
${input.ageYears != null ? `- Antigüedad: ${input.ageYears} años` : ''}
- Estado: ${input.state}
${input.features.length ? `- Características: ${input.features.join(', ')}` : ''}${input.expensesArs ? `\n- Expensas ARS: ${input.expensesArs.toLocaleString('es-AR')}` : ''}${input.orientation ? `\n- Orientación: ${input.orientation}` : ''}${input.notes ? `\n- Notas: ${input.notes.replace(/"/g, '\\"')}` : ''}

Ajuste fino: altura de calle (cuadra), piso (mejor a mayor altura salvo último con problemas), orientación, posición premium/periférica del barrio.${anchorBlock}`

  const result = await model.generateContent(prompt)
  const txt = result.response.text()
  const parsed = JSON.parse(txt) as ValuatorOutput

  if (!parsed.pricePerM2USD || !parsed.totalPriceUSD) {
    throw new Error('Respuesta inválida del modelo: faltan bandas de precio')
  }

  parsed.anchor = anchor
  return parsed
}
