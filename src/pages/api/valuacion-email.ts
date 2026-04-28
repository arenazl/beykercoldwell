import type { APIRoute } from 'astro'

export const prerender = false

/**
 * Endpoint de "envío" de cotización por mail. Por ahora persiste en
 * console.log + responde 200; el día que se cablee SMTP / SendGrid /
 * Resend, lo único que cambia es el block de `// TODO: enviar mail real`.
 *
 * Recibe:
 *   { email, code, payload, valuation }
 * El asesor también recibirá el caso (vía mismo código `code`) cuando
 * cableemos la integración con CRM.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: {
    email?: string
    code?: string
    payload?: Record<string, unknown>
    valuation?: Record<string, unknown>
  }

  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const email = (body.email ?? '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: 'Mail inválido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const code = body.code?.trim() || 'BEY-?'

  // TODO: enviar mail real. Por ahora dejamos rastro estructurado en logs.
  // Formato pensado para que cuando cableemos SendGrid/Resend se levante
  // tal cual desde el log o desde una persistencia intermedia.
  console.log(
    JSON.stringify({
      kind: 'valuacion_email_request',
      ts: new Date().toISOString(),
      code,
      email,
      payload: body.payload ?? null,
      valuation: body.valuation ?? null,
    }),
  )

  return new Response(
    JSON.stringify({ ok: true, code }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
