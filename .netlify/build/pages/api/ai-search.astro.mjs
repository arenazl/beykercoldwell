import { GoogleGenerativeAI } from '@google/generative-ai';
import { P as PROPERTIES, C as CATALOG_META, F as FILTERS } from '../../chunks/properties_D1YChRRr.mjs';
export { renderers } from '../../renderers.mjs';

const apiKey = process.env.GEMINI_API_KEY ?? "***REDACTED-REVOKED-KEY***";
const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash" ?? "gemini-2.5-flash";
let client = null;
function getClient() {
  if (!apiKey) return null;
  if (!client) client = new GoogleGenerativeAI(apiKey);
  return client;
}
function isEnabled() {
  return Boolean(apiKey);
}
async function extractFilters(query, schema) {
  const genAI = getClient();
  if (!genAI) throw new Error("GEMINI_API_KEY no configurada");
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
  });
  const prompt = `Sos un asistente inmobiliario de Coldwell Banker Argentina. Tu trabajo es traducir lo que pide el cliente a un filtro estructurado sobre nuestro catálogo.

Catálogo disponible (${schema.total} propiedades):
- Tipos de propiedad reales: ${schema.tipos.slice(0, 30).join(", ")}
- Operaciones: ${schema.operaciones.join(", ")}
- Ubicaciones más frecuentes (provincia/ciudad): ${schema.ubicaciones.slice(0, 60).join(", ")}

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

Consulta del cliente: "${query.replace(/"/g, '\\"')}"`;
  const result = await model.generateContent(prompt);
  const txt = result.response.text();
  const parsed = JSON.parse(txt);
  for (const k of Object.keys(parsed)) {
    if (parsed[k] === null) {
      delete parsed[k];
    }
  }
  return parsed;
}

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function applyFilters(filters, limit = 24) {
  const results = [];
  for (const p of PROPERTIES) {
    const hits = [];
    let pass = true;
    if (filters.operacion && p.operacion && p.operacion !== filters.operacion) pass = false;
    if (filters.type && p.type !== filters.type) pass = false;
    if (filters.location_includes) {
      const loc = normalize(p.location);
      const target = normalize(filters.location_includes);
      if (!loc.includes(target)) pass = false;
      else hits.push(`📍 ${filters.location_includes}`);
    }
    if (filters.minPriceUSD != null && (p.priceValue ?? 0) < filters.minPriceUSD) pass = false;
    if (filters.maxPriceUSD != null && (p.priceValue ?? Infinity) > filters.maxPriceUSD) pass = false;
    if (filters.minBedrooms != null && (p.bedrooms ?? 0) < filters.minBedrooms) pass = false;
    if (filters.maxBedrooms != null && (p.bedrooms ?? Infinity) > filters.maxBedrooms) pass = false;
    if (filters.minBathrooms != null && (p.bathrooms ?? 0) < filters.minBathrooms) pass = false;
    if (filters.minSurfaceM2 != null && (p.surfaceM2 ?? 0) < filters.minSurfaceM2) pass = false;
    if (filters.maxSurfaceM2 != null && (p.surfaceM2 ?? Infinity) > filters.maxSurfaceM2) pass = false;
    if (!pass) continue;
    let score = 1;
    if (filters.keywords?.length) {
      const haystack = normalize(`${p.title} ${p.description}`);
      for (const kw of filters.keywords) {
        const needle = normalize(kw);
        if (needle && haystack.includes(needle)) {
          score += 2;
          hits.push(`✓ ${kw}`);
        }
      }
    }
    if (filters.maxPriceUSD != null && p.priceValue != null) {
      const ratio = p.priceValue / filters.maxPriceUSD;
      if (ratio < 0.95) score += 0.5;
    }
    results.push({ property: p, score, hits });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

const prerender = false;
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
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const query = (body.query ?? "").trim();
  if (!query) {
    return new Response(JSON.stringify({ error: "query requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const filters = await extractFilters(query, {
      tipos: FILTERS.tipos,
      operaciones: FILTERS.operaciones,
      ubicaciones: FILTERS.ubicaciones,
      total: CATALOG_META.total
    });
    const results = applyFilters(filters, 24);
    return new Response(
      JSON.stringify({
        filters,
        total: results.length,
        results: results.map((r) => ({
          score: r.score,
          hits: r.hits,
          property: r.property
        }))
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Error procesando la consulta",
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
