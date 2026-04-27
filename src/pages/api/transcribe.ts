import type { APIRoute } from 'astro'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const prerender = false

const apiKey = process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY
const modelName =
  process.env.GEMINI_MODEL ?? import.meta.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

export const POST: APIRoute = async ({ request }) => {
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'GEMINI_API_KEY no configurada en el servidor',
        hint: 'Agregala en .env y reiniciá el dev server',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: { audio?: string; mimeType?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const audio = body.audio?.trim()
  const mimeType = body.mimeType?.trim() || 'audio/webm'
  if (!audio) {
    return new Response(JSON.stringify({ error: 'audio (base64) requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0 },
    })

    const result = await model.generateContent([
      {
        text:
          'Transcribí literalmente lo que dice el audio. Es una consulta inmobiliaria en español rioplatense (Argentina) — barrio, presupuesto, ambientes, características. Devolvé SOLO la transcripción, sin comillas, sin "El usuario dijo:", sin nada agregado.',
      },
      {
        inlineData: { data: audio, mimeType },
      },
    ])

    const text = result.response.text().trim()
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No se pudo transcribir el audio' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ text }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Error transcribiendo el audio',
        detail: String((err as Error).message),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
