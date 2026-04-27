/**
 * Mapa de secciones / productos del sitio. Lo lee la IA del asistente para
 * decidir a qué URL redirigir según lo que pida el usuario.
 *
 * Mantener en sincronía con `src/pages/`. Si agregás una página nueva, agregala
 * acá con su `intent` y `keywords`.
 */
export interface AppSection {
  /** Path del Astro route. */
  href: string
  /** Nombre corto para mostrar como CTA en el chat. */
  label: string
  /** Resumen 1 línea de qué hace la página — la IA lo lee. */
  purpose: string
  /** Tipos de pedido del usuario que matchean esta sección. */
  intents: string[]
}

export const APP_SECTIONS: AppSection[] = [
  {
    href: '/',
    label: 'Inicio',
    purpose: 'Home con hero, propiedades destacadas, servicios y respaldo CB.',
    intents: ['inicio', 'volver al home', 'qué ofrecen'],
  },
  {
    href: '/buscar',
    label: 'Buscar con IA',
    purpose: 'Búsqueda en lenguaje natural sobre las 9.240 propiedades del catálogo. El usuario escribe lo que quiere y la IA filtra.',
    intents: ['quiero comprar', 'busco propiedad', 'ver propiedades por criterio', 'filtrar', 'departamento en X', 'casa con Y'],
  },
  {
    href: '/propiedades',
    label: 'Catálogo de propiedades',
    purpose: 'Listado completo de propiedades con filtros laterales (ubicación, tipo, precio, ambientes, antigüedad).',
    intents: ['ver todas las propiedades', 'browse', 'listado', 'navegar catálogo'],
  },
  {
    href: '/tasaciones',
    label: 'Tasación profesional',
    purpose: 'Tasación con asesor humano basada en Análisis Comparativo de Mercado (ACM). Formulario para coordinar visita.',
    intents: ['tasar mi propiedad', 'cuánto vale mi casa', 'vender', 'tasación profesional'],
  },
  {
    href: '/tasaciones-ia',
    label: 'Valuación con IA',
    purpose: 'Estimación instantánea de valor de una propiedad mediante IA. Resultado en segundos vs días de la tasación humana.',
    intents: ['estimación rápida', 'cuánto vale ahora', 'valuación IA', 'tasación instantánea'],
  },
  {
    href: '/credito',
    label: 'Calculadora de crédito hipotecario',
    purpose: 'Estima cuánto puede comprar el cliente según ingresos, ahorro, plazo. Crédito UVA argentino.',
    intents: ['crédito hipotecario', 'cuánto me prestan', 'préstamo UVA', 'calcular cuota', 'precalificación'],
  },
  {
    href: '/comparar',
    label: 'Comparador de propiedades',
    purpose: 'Compara 2-3 propiedades lado a lado: precio, m², ubicación, antigüedad. La IA recomienda la mejor según perfil.',
    intents: ['comparar propiedades', 'cuál conviene', 'pros y contras', 'lado a lado'],
  },
  {
    href: '/match-ia',
    label: 'Match-IA',
    purpose: 'Quiz corto que detecta perfil del comprador (familia, inversor, primera vivienda) y sugiere las 3 mejores propiedades.',
    intents: ['no sé qué busco', 'recomendame', 'guíame', 'soy nuevo', 'me orienten'],
  },
  {
    href: '/generar-aviso',
    label: 'Generador de aviso (IA)',
    purpose: 'Crea título, descripción, hashtags y CTA para una publicación inmobiliaria a partir de datos crudos.',
    intents: ['publicar mi propiedad', 'redactar aviso', 'copywriting', 'crear publicación'],
  },
  {
    href: '/barrios',
    label: 'Guías de barrios',
    purpose: 'Guía editorial de zonas (CABA, GBA): perfil habitante, fortalezas, contras, rangos de precio. Generadas con IA.',
    intents: ['cómo es el barrio X', 'guía de zona', 'info de Palermo', 'qué tal vivir en X'],
  },
  {
    href: '/emprendimientos',
    label: 'Emprendimientos',
    purpose: 'Propiedades en pozo / construcción / preventa. Inversión inmobiliaria de mediano plazo.',
    intents: ['en pozo', 'preventa', 'invertir', 'a estrenar', 'emprendimientos'],
  },
  {
    href: '/la-empresa',
    label: 'La empresa',
    purpose: 'Información institucional de Coldwell Banker Beyker, equipo, valores, ubicación oficina.',
    intents: ['quiénes son', 'sobre la empresa', 'quiero conocerlos'],
  },
  {
    href: '/contacto',
    label: 'Contacto',
    purpose: 'Formulario y datos de contacto: WhatsApp, mail, oficina Florida 826.',
    intents: ['hablar con humano', 'contactar', 'WhatsApp', 'oficina', 'asesor'],
  },
  {
    href: '/unite',
    label: 'Carrera comercial',
    purpose: 'Landing para asesores que quieran sumarse a Beyker. Perfil buscado y stack IA disponible.',
    intents: ['quiero trabajar acá', 'asesor inmobiliario', 'sumarme', 'unirme al equipo'],
  },
  {
    href: '/franquicias',
    label: 'Franquicias',
    purpose: 'Modelo de franquicia: fees, fases, ROI proyectado. Para brokers que quieran abrir oficina.',
    intents: ['abrir franquicia', 'modelo de negocio', 'invertir en oficina', 'broker'],
  },
  {
    href: '/tecnologia',
    label: 'Stack tecnológico',
    purpose: 'Detalle del stack IA propio: CRM, captación, valuador, WhatsApp IA, etc.',
    intents: ['qué tecnología usan', 'stack', 'herramientas IA'],
  },
  {
    href: '/inversores',
    label: 'Pitch a inversores',
    purpose: 'Tesis de inversión, roadmap, valuation a 5 años. Para potenciales inversores de la red.',
    intents: ['pitch', 'invertir en la empresa', 'tesis', 'roadmap'],
  },
]
