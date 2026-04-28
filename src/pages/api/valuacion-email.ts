import type { APIRoute } from 'astro'
import nodemailer from 'nodemailer'

export const prerender = false

/**
 * Recibe la cotización + mail del cliente y la envía vía SMTP.
 * Usa el mismo provider que el resto de los proyectos del user
 * (Brevo SMTP — ver D:\Code\APP_GUIDE\STACK_GLOBAL.md sección 4).
 *
 * Env vars (canónicas, mismas que consorcios / sugerenciasMun):
 *   SMTP_HOST       → smtp-relay.brevo.com
 *   SMTP_PORT       → 587
 *   SMTP_USER       → a14e87001@smtp-brevo.com
 *   SMTP_PASSWORD   → API key del SMTP (xkeysib-...)
 *   SMTP_FROM       → arenazl@gmail.com (mientras no haya dominio verificado)
 *   SMTP_FROM_NAME  → Coldwell Banker Beyker
 *   NOTIFY_EMAIL    → opcional: BCC al asesor
 *
 * Si falta alguna env var de SMTP, loguea estructurado y devuelve
 * {sent:false} para no romper el flujo en dev.
 */

interface Band {
  low: number
  typical: number
  high: number
}
interface ValuationLite {
  totalPriceUSD?: Band
  pricePerM2USD?: Band
  confidence?: 'alta' | 'media' | 'baja'
  marketSummary?: string
  factorsUp?: string[]
  factorsDown?: string[]
  commercialStrategy?: string
  comparables?: Array<{
    description?: string
    surfaceM2?: number
    pricePerM2USD?: number
    totalPriceUSD?: number
  }>
}

interface PayloadLite {
  type?: string
  state?: string
  address?: string
  surfaceTotalM2?: number
  surfaceCoveredM2?: number
  rooms?: number
  bedrooms?: number
  bathrooms?: number
  ageYears?: number
  expensesArs?: number
  features?: string[]
  notes?: string
}

function fmtUSD(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return 'USD ' + Math.round(n).toLocaleString('es-AR')
}
function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  )
}

function buildEmailHtml(opts: {
  code: string
  payload: PayloadLite
  valuation: ValuationLite
}): string {
  const { code, payload, valuation } = opts
  const band = valuation.totalPriceUSD ?? { low: 0, typical: 0, high: 0 }
  const perM2 = valuation.pricePerM2USD

  const factorsUp = (valuation.factorsUp ?? [])
    .map((f) => `<li style="margin-bottom:6px;">✓ ${escape(f)}</li>`)
    .join('')
  const factorsDown = (valuation.factorsDown ?? [])
    .map((f) => `<li style="margin-bottom:6px;">! ${escape(f)}</li>`)
    .join('')

  const comparables = (valuation.comparables ?? [])
    .slice(0, 5)
    .map(
      (c) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escape(c.description ?? '—')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;white-space:nowrap;">${c.surfaceM2 ?? '—'} m²</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;white-space:nowrap;color:#C9A45A;font-weight:bold;">${fmtUSD(c.totalPriceUSD)}</td>
        </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Tu cotización Beyker — ${code}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:#002554;padding:24px 28px;color:#ffffff;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#C9A45A;font-weight:700;margin-bottom:6px;">Coldwell Banker Beyker</div>
          <div style="font-size:22px;font-weight:700;line-height:1.2;">Tu cotización está lista</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:6px;">Código de seguimiento: <span style="font-family:monospace;color:#C9A45A;">${code}</span></div>
        </td></tr>

        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
            Esta es la valuación orientativa que generamos a partir de los datos que nos diste.
            La banda surge de un Análisis Comparativo de Mercado sobre operaciones reales de la zona.
          </p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#002554;border-radius:12px;margin-bottom:20px;">
            <tr><td style="padding:24px;color:#ffffff;text-align:center;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#C9A45A;font-weight:700;margin-bottom:6px;">Precio típico de mercado</div>
              <div style="font-size:36px;font-weight:800;line-height:1;letter-spacing:-1px;">${fmtUSD(band.typical)}</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                <tr>
                  <td style="text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Mínimo</td>
                  <td style="text-align:center;font-size:11px;text-transform:uppercase;color:#C9A45A;letter-spacing:1px;font-weight:700;">Típico</td>
                  <td style="text-align:right;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Máximo</td>
                </tr>
                <tr>
                  <td style="text-align:left;font-size:16px;font-weight:700;color:#ffffff;padding-top:6px;">${fmtUSD(band.low)}</td>
                  <td style="text-align:center;font-size:16px;font-weight:700;color:#C9A45A;padding-top:6px;">${fmtUSD(band.typical)}</td>
                  <td style="text-align:right;font-size:16px;font-weight:700;color:#ffffff;padding-top:6px;">${fmtUSD(band.high)}</td>
                </tr>
              </table>
              ${
                perM2
                  ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.15);font-size:12px;color:#94a3b8;">
                       USD/m² · típico ${fmtUSD(perM2.typical)}
                     </div>`
                  : ''
              }
            </td></tr>
          </table>

          ${
            valuation.marketSummary
              ? `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px;">
                   <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:700;margin-bottom:6px;">Lectura de mercado</div>
                   <div style="font-size:13px;line-height:1.6;color:#334155;">${escape(valuation.marketSummary)}</div>
                 </div>`
              : ''
          }

          ${
            factorsUp || factorsDown
              ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                   <tr>
                     ${
                       factorsUp
                         ? `<td valign="top" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;width:48%;">
                              <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#16a34a;font-weight:700;margin-bottom:8px;">Suman al precio</div>
                              <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;color:#0f172a;">${factorsUp}</ul>
                            </td>`
                         : ''
                     }
                     ${factorsUp && factorsDown ? '<td style="width:4%;"></td>' : ''}
                     ${
                       factorsDown
                         ? `<td valign="top" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;width:48%;">
                              <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#d97706;font-weight:700;margin-bottom:8px;">Restan al precio</div>
                              <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;color:#0f172a;">${factorsDown}</ul>
                            </td>`
                         : ''
                     }
                   </tr>
                 </table>`
              : ''
          }

          ${
            comparables
              ? `<div style="margin-bottom:20px;">
                   <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:700;margin-bottom:8px;">Comparables del mercado</div>
                   <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                     <thead>
                       <tr style="background:#f8fafc;">
                         <th style="padding:8px 12px;font-size:11px;text-align:left;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Propiedad</th>
                         <th style="padding:8px 12px;font-size:11px;text-align:right;color:#64748b;text-transform:uppercase;letter-spacing:1px;">m²</th>
                         <th style="padding:8px 12px;font-size:11px;text-align:right;color:#64748b;text-transform:uppercase;letter-spacing:1px;">USD total</th>
                       </tr>
                     </thead>
                     <tbody>${comparables}</tbody>
                   </table>
                 </div>`
              : ''
          }

          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:14px;margin-bottom:20px;">
            <div style="font-size:13px;line-height:1.5;color:#78350f;">
              <strong>Importante:</strong> esta valuación es orientativa.
              Para una tasación profesional con visita presencial,
              <a href="https://beykerbienesraices.com.ar/tasaciones" style="color:#92400e;font-weight:700;text-decoration:underline;">solicitala acá</a>.
            </div>
          </div>

          <div style="text-align:center;margin-bottom:8px;">
            <a href="https://wa.me/5491130779018?text=Hola,%20te%20escribo%20por%20mi%20cotizaci%C3%B3n%20${encodeURIComponent(code)}" style="display:inline-block;background:#002554;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Hablar con un asesor</a>
          </div>

          <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.5;">
            Datos cargados · ${escape(payload.type ?? '—')}${payload.surfaceTotalM2 ? ` · ${payload.surfaceTotalM2} m²` : ''}${payload.address ? ` · ${escape(payload.address)}` : ''}
          </p>
        </td></tr>

        <tr><td style="background:#0f172a;padding:18px 28px;text-align:center;">
          <div style="font-size:11px;color:#94a3b8;line-height:1.5;">
            Coldwell Banker Beyker · Florida 826, CABA<br/>
            <a href="https://beykerbienesraices.com.ar" style="color:#C9A45A;text-decoration:none;">beykerbienesraices.com.ar</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildEmailText(code: string, payload: PayloadLite, v: ValuationLite): string {
  const band = v.totalPriceUSD ?? { low: 0, typical: 0, high: 0 }
  return [
    `Tu cotización Beyker — ${code}`,
    '',
    `Tipo: ${payload.type ?? 's/d'} (${payload.state ?? 's/d'})`,
    payload.address ? `Dirección: ${payload.address}` : null,
    payload.surfaceTotalM2 ? `Superficie total: ${payload.surfaceTotalM2} m²` : null,
    '',
    `Precio típico de mercado: ${fmtUSD(band.typical)}`,
    `Banda: ${fmtUSD(band.low)} – ${fmtUSD(band.high)}`,
    v.marketSummary ? '' : null,
    v.marketSummary ?? null,
    '',
    'Para conversar con un asesor:',
    `https://wa.me/5491130779018?text=Cotización%20${encodeURIComponent(code)}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

function readEnv(name: string): string | undefined {
  return (process.env[name] ?? import.meta.env[name]) as string | undefined
}

export const POST: APIRoute = async ({ request }) => {
  let body: {
    email?: string
    code?: string
    payload?: PayloadLite
    valuation?: ValuationLite
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

  const code = (body.code ?? '').trim() || 'BEY-?'
  const payload = body.payload ?? {}
  const valuation = body.valuation ?? {}

  const SMTP_HOST = readEnv('SMTP_HOST')
  const SMTP_PORT = Number(readEnv('SMTP_PORT') ?? '587')
  const SMTP_USER = readEnv('SMTP_USER')
  const SMTP_PASSWORD = readEnv('SMTP_PASSWORD')
  const SMTP_FROM = readEnv('SMTP_FROM') ?? SMTP_USER
  const SMTP_FROM_NAME = readEnv('SMTP_FROM_NAME') ?? 'Coldwell Banker Beyker'
  const NOTIFY_EMAIL = readEnv('NOTIFY_EMAIL')

  const html = buildEmailHtml({ code, payload, valuation })
  const text = buildEmailText(code, payload, valuation)
  const subject = `Tu cotización Beyker — ${code}`

  // Modo dev / sin SMTP → log estructurado y respuesta ok igual.
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    console.log(
      JSON.stringify({
        kind: 'valuacion_email_skipped_no_smtp',
        ts: new Date().toISOString(),
        code,
        email,
        notifyEmail: NOTIFY_EMAIL ?? null,
      }),
    )
    return new Response(
      JSON.stringify({
        ok: true,
        code,
        sent: false,
        hint: 'SMTP_HOST / SMTP_USER / SMTP_PASSWORD no configurados — el mail no se envió.',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 = SSL implícito; 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    })

    const info = await transporter.sendMail({
      from: `${SMTP_FROM_NAME} <${SMTP_FROM}>`,
      to: email,
      ...(NOTIFY_EMAIL ? { bcc: NOTIFY_EMAIL } : {}),
      subject,
      html,
      text,
    })

    console.log(
      JSON.stringify({
        kind: 'valuacion_email_sent',
        ts: new Date().toISOString(),
        code,
        email,
        messageId: info.messageId,
      }),
    )

    return new Response(
      JSON.stringify({ ok: true, code, sent: true }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[valuacion-email] smtp error', err)
    return new Response(
      JSON.stringify({
        error: 'No pudimos enviar el mail.',
        detail: String((err as Error).message),
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
