import { GoogleGenerativeAI } from '@google/generative-ai';
export { renderers } from '../../renderers.mjs';

const apiKey = process.env.GEMINI_API_KEY ?? "***REDACTED-REVOKED-KEY***";
const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash" ?? "gemini-1.5-flash";
let client = null;
function getClient() {
  if (!apiKey) return null;
  if (!client) client = new GoogleGenerativeAI(apiKey);
  return client;
}
function isEnabled() {
  return Boolean(apiKey);
}
async function valuateProperty(input) {
  const genAI = getClient();
  if (!genAI) throw new Error("GEMINI_API_KEY no configurada");
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  });
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
- Ubicación: ${input.location}
- Superficie total: ${input.surfaceTotalM2} m²
${input.surfaceCoveredM2 ? `- Superficie cubierta: ${input.surfaceCoveredM2} m²` : ""}
${input.rooms ? `- Ambientes: ${input.rooms}` : ""}
${input.bedrooms ? `- Dormitorios: ${input.bedrooms}` : ""}
${input.bathrooms ? `- Baños: ${input.bathrooms}` : ""}
${input.ageYears != null ? `- Antigüedad: ${input.ageYears} años` : ""}
- Estado: ${input.state}
${input.features.length ? `- Características: ${input.features.join(", ")}` : ""}
${input.expensesArs ? `- Expensas mensuales (ARS): ${input.expensesArs.toLocaleString("es-AR")}` : ""}
${input.notes ? `- Notas adicionales: ${input.notes.replace(/"/g, '\\"')}` : ""}`;
  const result = await model.generateContent(prompt);
  const txt = result.response.text();
  const parsed = JSON.parse(txt);
  if (!parsed.pricePerM2USD || !parsed.totalPriceUSD) {
    throw new Error("Respuesta inválida del modelo: faltan bandas de precio");
  }
  return parsed;
}

const prerender = false;
const VALID_TYPES = [
  "Departamento",
  "Casa",
  "PH",
  "Casa Quinta",
  "Lote",
  "Local",
  "Oficina",
  "Cochera"
];
const VALID_STATES = [
  "a estrenar",
  "excelente",
  "bueno",
  "regular",
  "a refaccionar"
];
function badRequest(error, hint) {
  return new Response(JSON.stringify({ error, ...hint && { hint } }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
}
const POST = async ({ request }) => {
  if (!isEnabled()) {
    return new Response(
      JSON.stringify({
        error: "GEMINI_API_KEY no configurada en el servidor",
        hint: "Agregala en .env y reiniciá el dev server"
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }
  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return badRequest("type inválido", `Valores válidos: ${VALID_TYPES.join(", ")}`);
  }
  if (!body.state || !VALID_STATES.includes(body.state)) {
    return badRequest("state inválido", `Valores válidos: ${VALID_STATES.join(", ")}`);
  }
  if (!body.location || typeof body.location !== "string" || !body.location.trim()) {
    return badRequest("location requerido");
  }
  if (!body.surfaceTotalM2 || typeof body.surfaceTotalM2 !== "number" || body.surfaceTotalM2 <= 0) {
    return badRequest("surfaceTotalM2 debe ser un número positivo");
  }
  const input = {
    type: body.type,
    location: body.location.trim(),
    surfaceTotalM2: body.surfaceTotalM2,
    surfaceCoveredM2: body.surfaceCoveredM2,
    rooms: body.rooms,
    bedrooms: body.bedrooms,
    bathrooms: body.bathrooms,
    ageYears: body.ageYears,
    state: body.state,
    features: Array.isArray(body.features) ? body.features.filter((f) => typeof f === "string") : [],
    expensesArs: body.expensesArs,
    notes: body.notes
  };
  try {
    const result = await valuateProperty(input);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Error procesando la valuación",
        detail: String(err.message)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
