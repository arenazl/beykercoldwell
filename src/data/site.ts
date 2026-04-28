/**
 * Configuración central del sitio Coldwell Banker Beyker.
 * Datos sacados de beykerbienesraices.com.ar (sitio original).
 */

export const SITE = {
  name: 'Coldwell Banker Beyker',
  legal: 'Coldwell Banker Beyker',
  url: 'https://beykerbienesraices.com.ar',
  description:
    'Inmobiliaria con respaldo internacional Coldwell Banker®. Asesoramiento estratégico en compra, venta y tasación de propiedades en CABA y Provincia de Buenos Aires.',
  tagline: 'Aliados en tu camino, expertos en cada decisión.',
  values: ['Excelencia', 'Confianza', 'Alcance internacional', 'Conocimiento local'],
}

export const CONTACT = {
  email: 'info.beyker@coldwellbanker.com.ar',
  phone_display: '+54 9 11 3077-9018',
  phone_e164: '+5491130779018',
  whatsapp_link: 'https://wa.me/5491130779018?text=Hola%2C%20te%20escribo%20desde%20la%20web%20de%20Coldwell%20Banker%20Beyker.',
  address: {
    line1: 'Florida 826, Primer piso',
    line2: 'Centro · CABA, Buenos Aires',
    cp: 'C1005AAR',
  },
  google_maps: 'https://maps.google.com/maps?q=Florida%20826%2C%20Buenos%20Aires',
}

export const SOCIAL = {
  facebook: 'https://www.facebook.com/profile.php?id=61576706188981',
  instagram: 'https://www.instagram.com/beyker.bienesraices/',
  linkedin: 'https://www.linkedin.com/company/coldwell-banker-beyker/',
}

export const NAV = [
  { label: 'Inicio', href: '/' },
  { label: 'Búsqueda inteligente', href: '/buscar' },
  { label: 'Match guiado', href: '/match-guiado' },
  { label: 'Propiedades', href: '/propiedades' },
  { label: 'Tasar', href: '/tasacion-online' },
  { label: 'Crédito', href: '/credito' },
  { label: 'La Empresa', href: '/la-empresa' },
  { label: 'Contacto', href: '/contacto' },
]

export const NAV_TOOLS = [
  { label: 'Búsqueda inteligente', href: '/buscar', desc: 'Lenguaje natural sobre el catálogo' },
  { label: 'Match guiado', href: '/match-guiado', desc: '4 preguntas, 3 propiedades ideales' },
  { label: 'Tasación inteligente', href: '/tasacion-online', desc: 'Banda de precio en 30 segundos' },
  { label: '¿Te da el crédito?', href: '/credito', desc: 'Capacidad de compra hipotecaria' },
  { label: 'Comparador inteligente', href: '/comparar', desc: 'Compará hasta 3 propiedades' },
  { label: 'Guías de barrios', href: '/barrios', desc: 'Perfil, fortalezas y precios' },
  { label: 'Generador de aviso', href: '/generar-aviso', desc: 'Datos crudos → publicación lista' },
] as const

export const NAV_CTA = { label: 'Unite al equipo', href: '/unite' }

export const LOGOS = {
  // Logos del sitio original (CDN público de Brokian/CB).
  // Reemplazar por copias locales en /public/logos cuando estén disponibles.
  primary: 'https://d1v2p1s05qqabi.cloudfront.net/sites/971/media/174256222638.svg',
  isotype: 'https://d1v2p1s05qqabi.cloudfront.net/sites/971/media/1742562230632.svg',
  favicon: 'https://d1v2p1s05qqabi.cloudfront.net/sites/971/media/1742562234488.svg',
}

export const SERVICIOS = [
  {
    icon: 'home',
    title: 'Compra y Venta',
    description:
      'Acompañamos cada paso del proceso: relevamiento, estrategia comercial y cierre con seguridad jurídica.',
  },
  {
    icon: 'chart',
    title: 'Tasación profesional',
    description:
      'Análisis Comparativo de Mercado (ACM) basado en datos reales de la zona y comportamiento de demanda.',
  },
  {
    icon: 'building',
    title: 'Emprendimientos',
    description:
      'Comercialización de proyectos en pozo y construcción, con alianzas con desarrolladores y fideicomisos.',
  },
  {
    icon: 'globe',
    title: 'Red internacional',
    description:
      'Acceso a la red Coldwell Banker® con presencia en más de 40 países y 100.000 asesores en el mundo.',
  },
] as const

export const VALORES = [
  {
    title: 'Respaldo global',
    description:
      'Una de las marcas inmobiliarias más reconocidas del mundo, con más de 100 años de trayectoria.',
  },
  {
    title: 'Conocimiento local',
    description:
      'Equipo experto en CABA y Zona Norte/Sur, con foco en cada microzona y su comportamiento de mercado.',
  },
  {
    title: 'Asesoramiento estratégico',
    description:
      'Datos, no opiniones: cada decisión se sostiene en análisis comparativo de mercado y reportes propios.',
  },
  {
    title: 'Alianzas estratégicas',
    description:
      'Trabajamos con bancos, escribanías, arquitectos e ingenieros para resolver cada operación de punta a punta.',
  },
] as const
