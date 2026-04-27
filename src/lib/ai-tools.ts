import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Property } from '../data/properties'
import { CATALOG_INDEX_FULL, CATALOG_STATS } from './catalog-index'
import { APP_SECTIONS } from '../data/app-knowledge'

const apiKey = process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY
const modelName =
  process.env.GEMINI_MODEL ?? import.meta.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

let client: GoogleGenerativeAI | null = null
function getClient(): GoogleGenerativeAI {
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')
  if (!client) client = new GoogleGenerativeAI(apiKey)
  return client
}

export function aiEnabled(): boolean {
  return Boolean(apiKey)
}

function genJsonModel(temperature = 0.2) {
  return getClient().getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json', temperature },
  })
}

function compactProperty(p: Property) {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    location: p.location,
    operacion: p.operacion,
    priceUSD: p.priceCurrency === 'USD' ? p.priceValue : null,
    priceCurrency: p.priceCurrency,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    surfaceM2: p.surfaceM2,
    antiguedadYears: p.antiguedadYears,
    antiguedadLabel: p.antiguedadLabel,
    excerpt: (p.description || '').slice(0, 300),
  }
}

export interface AssistantMsg {
  role: 'user' | 'assistant'
  text: string
}

export interface AssistantReply {
  reply: string
  intent: 'comprar' | 'alquilar' | 'tasar' | 'invertir' | 'consulta' | 'derivar'
  suggestedPropertyIds: string[]
  followUp: string | null
  cta: { label: string; href: string } | null
}

/**
 * Asistente conversacional generalista. Le mandamos:
 *  1. CATALOG_INDEX_FULL: las 9.240 propiedades en formato pipe-separated
 *     (≈110k tokens, entra en Gemini 2.5 Flash 1M).
 *  2. CATALOG_STATS: agregaciones (counts por ciudad, tipo, operación, cruz).
 *  3. APP_SECTIONS: todas las páginas del sitio con su propósito + intents.
 *  4. Historial de conversación.
 *
 * La IA decide qué propiedades sugerir y a qué sección redirigir, sin
 * pre-filtrado por algoritmo. La regla #9 del proyecto prohíbe parchear
 * features data-driven con hardcode — el fix va en cómo se le serializa
 * el contexto al modelo.
 */
export async function assistantChat(
  history: AssistantMsg[]
): Promise<AssistantReply> {
  const model = genJsonModel(0.4)

  const transcript = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'CLIENTE' : 'BEYKER'}: ${m.text}`)
    .join('\n')

  const sections = APP_SECTIONS
    .map((s) => `  ${s.href}  →  ${s.label}: ${s.purpose}  [intents: ${s.intents.join(', ')}]`)
    .join('\n')

  const prompt = `Sos "Beyker IA", asistente virtual de Coldwell Banker Beyker (inmobiliaria, Argentina). Hablás en español rioplatense (vos), tono profesional y cercano. Tu rol: entender qué busca el cliente y, según corresponda:
  (a) sugerir 1-3 propiedades concretas del catálogo (devolviendo sus IDs reales),
  (b) redirigirlo a la sección correcta del sitio,
  (c) o derivarlo a un asesor humano.

═══════════════════════════════════════════════
SECCIONES DEL SITIO (cada una con su href, propósito y los pedidos que la disparan):

${sections}

═══════════════════════════════════════════════
ESTADÍSTICAS DEL CATÁLOGO (para responder "¿tienen X en Y?" sin recorrer todo):
- Total propiedades: ${PROPERTIES_TOTAL}
- Por tipo: ${JSON.stringify(CATALOG_STATS.byType)}
- Por operación: ${JSON.stringify(CATALOG_STATS.byOp)}
- Por ciudad (top 30 por volumen): ${JSON.stringify(topN(CATALOG_STATS.byCity, 30))}

═══════════════════════════════════════════════
CATÁLOGO COMPLETO — todas las propiedades en formato pipe-separated.
Una línea por propiedad. Header en la primera línea. Usá esto como tu fuente de verdad para sugerir IDs.

\`\`\`
${CATALOG_INDEX_FULL}
\`\`\`

═══════════════════════════════════════════════
CONVERSACIÓN:
${transcript}

═══════════════════════════════════════════════
Respondé en JSON exacto:
{
  "reply": "Respuesta al cliente. Máx 3 oraciones. Si sugerís propiedades, mencionalas brevemente (no listes los IDs en el reply, eso va en suggestedPropertyIds).",
  "intent": "comprar" | "alquilar" | "tasar" | "invertir" | "consulta" | "derivar",
  "suggestedPropertyIds": ["máx 3 IDs reales del catálogo de arriba, solo si son MUY relevantes a lo último que pidió. [] si no aplica."],
  "followUp": "Pregunta corta para seguir guiando, o null si ya cerraste con CTA",
  "cta": { "label": "Texto corto del botón", "href": "ruta de la lista de SECCIONES de arriba" } | null
}

Reglas duras:
- Los IDs sugeridos deben EXISTIR en el catálogo de arriba. Si no encontrás match, devolvé [] y explicalo en reply.
- El href del CTA debe ser uno de los listados en SECCIONES. No inventes rutas.
- NO inventes precios, ubicaciones, ni features. Solo lo que está en el catálogo.
- Si el cliente pide algo y NO existe (ej: "casa en Tristán Suárez" cuando no hay), decilo honestamente y proponé alternativa cercana o /buscar para explorar.
- Sin emojis (máximo 1 si suma de verdad).`

  const r = await model.generateContent(prompt)
  return JSON.parse(r.response.text()) as AssistantReply
}

const PROPERTIES_TOTAL = (() => {
  // Conteo desde stats para no importar PROPERTIES en este top-level.
  return Object.values(CATALOG_STATS.byType).reduce((a, b) => a + b, 0)
})()

function topN(obj: Record<string, number>, n: number): Record<string, number> {
  const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
  return Object.fromEntries(sorted)
}

export interface MatchPreferences {
  operacion: 'comprar' | 'alquilar'
  zona: string
  presupuestoUSD: number | null
  ambientes: number | null
  estiloVida: string[]
  notas?: string
}

export interface MatchPick {
  propertyId: string
  score: number
  reason: string
}

export interface MatchResponse {
  picks: MatchPick[]
  summary: string
  perfilSugerido: string
}

export async function matchProperties(
  prefs: MatchPreferences,
  catalog: Property[]
): Promise<MatchResponse> {
  const model = genJsonModel(0.3)
  const compact = catalog.slice(0, 120).map(compactProperty)

  const prompt = `Sos asesor inmobiliario senior de Coldwell Banker Beyker. El cliente respondió un quiz; recomendá las MEJORES 3 propiedades del catálogo dado.

Preferencias del cliente:
${JSON.stringify(prefs)}

Catálogo:
${JSON.stringify(compact)}

Devolvé JSON:
{
  "picks": [
    { "propertyId": "id del catálogo", "score": 0-100, "reason": "Por qué le va a esta persona específica. 1-2 oraciones, vos." }
  ],
  "summary": "Resumen del perfil de búsqueda en 1 oración.",
  "perfilSugerido": "Etiqueta corta del perfil del comprador (ej: 'Familia primera vivienda', 'Inversor de renta', 'Profesional joven CABA')."
}

Reglas:
- 3 picks. Solo IDs del catálogo provisto.
- score: qué tan bien matchea (0-100).
- Si no hay matches buenos, devolvé las 3 más cercanas y explicá la limitación en summary.
- Tono argentino, vos. Sin emojis.`

  const r = await model.generateContent(prompt)
  return JSON.parse(r.response.text()) as MatchResponse
}

export interface PropertyInsight {
  pros: string[]
  contras: string[]
  perfilIdeal: string
  barrioResumen: string
  consejoNegociacion: string
  preguntasParaAgente: string[]
}

export async function propertyInsight(p: Property): Promise<PropertyInsight> {
  const model = genJsonModel(0.4)

  const prompt = `Sos un asesor inmobiliario senior. Analizá esta propiedad para un comprador interesado y devolvé insights honestos.

Propiedad:
${JSON.stringify(compactProperty(p))}

Devolvé JSON:
{
  "pros": ["3-5 pros reales basados en los datos. Sé específico, no genérico."],
  "contras": ["2-3 contras o cosas a chequear. Honesto, no comercial."],
  "perfilIdeal": "1 oración: para quién es ideal esta propiedad (ej: 'pareja joven que prioriza ubicación sobre m²').",
  "barrioResumen": "2 oraciones describiendo el barrio/zona y qué encuentra cerca.",
  "consejoNegociacion": "1 consejo concreto sobre margen de negociación o timing.",
  "preguntasParaAgente": ["3 preguntas clave que deberías hacerle al asesor antes de ofertar."]
}

Reglas:
- Tono argentino (vos), conciso.
- NO inventes datos no presentes (ej: no digas "tiene cochera" si no figura).
- Si faltan datos, en contras decí "Falta info de X — pedirla al agente".
- Sin emojis.`

  const r = await model.generateContent(prompt)
  return JSON.parse(r.response.text()) as PropertyInsight
}

export interface MortgageInput {
  ingresoMensualARS: number
  ahorroUSD: number
  cuotaMaxPctIngreso: number
  plazoAnios: number
}

export interface MortgageOutput {
  precioMaxUSD: number
  cuotaEstimadaUSD: number
  cuotaEstimadaARS: number
  anticipoNecesarioUSD: number
  resumen: string
  supuestos: string[]
  recomendaciones: string[]
}

export async function mortgageEstimate(input: MortgageInput): Promise<MortgageOutput> {
  const model = genJsonModel(0.1)

  const prompt = `Sos asesor financiero especializado en créditos hipotecarios UVA en Argentina (mercado actual 2026). Estimá cuánto puede comprar este cliente.

Datos:
- Ingreso mensual ARS: ${input.ingresoMensualARS}
- Ahorro disponible USD: ${input.ahorroUSD}
- Cuota máxima sobre ingresos: ${input.cuotaMaxPctIngreso}%
- Plazo: ${input.plazoAnios} años

Asumí:
- Tasa UVA promedio actual del mercado argentino (~7-9% TNA + UVA).
- Banco financia ~75% del valor (LTV).
- Tipo de cambio dolar oficial-BNA de hoy (estimación coherente con 2026).

Devolvé JSON:
{
  "precioMaxUSD": number,
  "cuotaEstimadaUSD": number,
  "cuotaEstimadaARS": number,
  "anticipoNecesarioUSD": number,
  "resumen": "1 oración explicando el resultado al cliente.",
  "supuestos": ["Lista clara de los supuestos asumidos: tasa, LTV, TC, etc."],
  "recomendaciones": ["2-3 acciones concretas para mejorar la accesibilidad."]
}

Reglas:
- Conservador: si ahorro es bajo, el precio máximo lo limita el anticipo.
- precioMaxUSD = min(ahorroUSD / 0.25, valor_que_soporta_cuota_con_75%_credito).
- Sin emojis. Tono argentino.`

  const r = await model.generateContent(prompt)
  return JSON.parse(r.response.text()) as MortgageOutput
}

export interface ComparatorOutput {
  tabla: Record<string, string>[]
  ganadora: { propertyId: string; razon: string }
  paraQuienCadaUna: Record<string, string>
  riesgos: string[]
}

export async function compareProperties(props: Property[]): Promise<ComparatorOutput> {
  const model = genJsonModel(0.3)
  const compact = props.map(compactProperty)

  const prompt = `Sos asesor inmobiliario. Compará estas ${props.length} propiedades y armá una recomendación.

Propiedades:
${JSON.stringify(compact)}

Devolvé JSON:
{
  "tabla": [
    { "criterio": "Precio", "<id1>": "valor", "<id2>": "valor", "<id3>": "valor" },
    { "criterio": "Ubicación", ... },
    { "criterio": "M²", ... },
    { "criterio": "Ambientes", ... },
    { "criterio": "USD/m²", ... },
    { "criterio": "Antigüedad", ... }
  ],
  "ganadora": { "propertyId": "id", "razon": "Por qué es la mejor en términos generales. 1 oración." },
  "paraQuienCadaUna": { "<id1>": "Para quién es esta. 1 oración.", "<id2>": "...", "<id3>": "..." },
  "riesgos": ["Cosas a chequear antes de decidir, comunes a las 3."]
}

Reglas:
- Usá los IDs reales como keys.
- Tono argentino (vos), sin emojis.
- Si faltan datos, decí "s/d".`

  const r = await model.generateContent(prompt)
  return JSON.parse(r.response.text()) as ComparatorOutput
}

export interface NeighborhoodGuide {
  resumen: string
  perfilHabitante: string
  fortalezas: string[]
  contras: string[]
  precioRangoUSD: { min: number; max: number; nota: string }
  cercanias: string[]
  tendencia: string
}

export async function neighborhoodGuide(
  zona: string,
  propsEnZona: Property[]
): Promise<NeighborhoodGuide> {
  const model = genJsonModel(0.4)
  const compact = propsEnZona.slice(0, 30).map(compactProperty)

  const prompt = `Sos analista de mercado inmobiliario argentino. Generá una guía honesta de la zona "${zona}".

Propiedades del catálogo en esta zona (referencia para contexto, no las menciones por ID):
${JSON.stringify(compact)}

Devolvé JSON:
{
  "resumen": "2 oraciones describiendo la zona, su carácter y dónde se ubica.",
  "perfilHabitante": "1 oración: qué tipo de gente vive ahí.",
  "fortalezas": ["3-4 ventajas reales de vivir en esta zona."],
  "contras": ["2-3 desventajas honestas."],
  "precioRangoUSD": { "min": number, "max": number, "nota": "1 oración explicando el rango y por qué propiedad-tipo." },
  "cercanias": ["Lista de 4-6 puntos cercanos relevantes (escuelas, parques, transporte, comercios)."],
  "tendencia": "1 oración sobre la tendencia del mercado en esta zona (sube/estable/baja, en qué tipologías)."
}

Reglas:
- Solo zonas argentinas reales. Si no conocés la zona, devolvé contras = ["Zona poco frecuente en nuestro catálogo — recomendamos consulta directa"].
- Sin emojis. Tono argentino (vos).
- Honesto: si la zona tiene problemas (inseguridad, ruido, etc.), mencionalos en contras.`

  const r = await model.generateContent(prompt)
  return JSON.parse(r.response.text()) as NeighborhoodGuide
}

export interface ListingGenInput {
  type: string
  location: string
  surfaceM2: number
  bedrooms?: number
  bathrooms?: number
  ageYears?: number
  features: string[]
  notas?: string
}

export interface ListingGenOutput {
  titulo: string
  descripcion: string
  highlights: string[]
  hashtags: string[]
  ctaSugerido: string
}

export async function generateListing(input: ListingGenInput): Promise<ListingGenOutput> {
  const model = genJsonModel(0.7)

  const prompt = `Sos copywriter inmobiliario senior de Coldwell Banker. Generá una publicación para un aviso (estilo CB: profesional, premium, no chabacano).

Datos crudos:
${JSON.stringify(input)}

Devolvé JSON:
{
  "titulo": "Título del aviso, 60-80 caracteres, sin gritar (no ALL CAPS, no múltiples ❗).",
  "descripcion": "Descripción larga, 4-6 párrafos cortos. Estructura: 1) hook + ubicación, 2) características, 3) ambientes/distribución, 4) entorno, 5) cierre con CTA. Tono argentino (vos), profesional.",
  "highlights": ["6-8 bullets cortos de features clave para listar arriba del aviso."],
  "hashtags": ["6-10 hashtags relevantes para Instagram, sin #."],
  "ctaSugerido": "Frase de cierre/CTA del aviso. 1 oración."
}

Reglas:
- NO inventes features que no figuren en los datos.
- Sin emojis salvo 1-2 sutiles si suma.
- Estilo Coldwell: elegante, datos concretos, evitar adjetivos vacíos ("hermoso", "espectacular") salvo justificados.`

  const r = await model.generateContent(prompt)
  return JSON.parse(r.response.text()) as ListingGenOutput
}
