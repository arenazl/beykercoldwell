# Coldwell Banker Beyker · Contexto del proyecto

## Objetivo

Réplica del sitio público de **Coldwell Banker Beyker** (`beykerbienesraices.com.ar`)
hecha con el stack y patrones internos del usuario, evitando depender del template del
proveedor original (Brokian).

**Capa nueva (2026-04-26):** sobre el sitio CB Beyker se monta una propuesta de **red
inmobiliaria AI-native** (proptech franchise network). Materializada como páginas
adicionales (`/franquicias`, `/tecnologia`, `/inversores`) y reorientación de `/unite`.
El concepto completo vive en `APP_GUIDE/STRATEGY.md`. **Decisión clave:** capa nueva
conviviendo (no pivot), bajo branding visual CB Beyker existente, pero con copy genérico
(sin hardcodear "Beyker" en las propuestas — la red se vende como modelo, no como la
inmobiliaria local).

## Decisiones tomadas

- **Stack**: Astro 4 + Tailwind 3 + TypeScript estricto. Igual que `grupobeyker-web`
  (precedente más cercano y reciente del usuario).
- **Theming**: sistema multi-tema con CSS variables (`--bg`, `--text`, `--accent`, etc.)
  reusado de `grupobeyker-web`. Tema default `coldwell-classic` (navy `#002554` + dorado
  `#C9A45A`, fondo claro). Switch persistido en `localStorage` con clave `cb-theme`.
- **Layout**: marketing site con scroll natural — `min-h-screen flex flex-col`. Header
  sticky, footer fijo abajo del flujo. **No** se aplicó el patrón "Single Page
  Experience / overflow-hidden" de `CLAUDE.md` global porque ese patrón es para
  dashboards, no para sitios de marketing públicos.
- **SEO**: JSON-LD (`RealEstateAgent`, `WebSite` con `SearchAction`, `WebPage`,
  `BreadcrumbList`), Open Graph, Twitter Card, sitemap automático vía `@astrojs/sitemap`.
- **Reglas Tailwind respetadas**: cero valores arbitrarios (`h-[400px]`, etc.), todo en
  escala Tailwind. Variables CSS para colores. `flex-1`/`min-w-0`/`flex-shrink-0` donde
  hace falta.
- **Datos de propiedades**: file `src/data/properties.ts`. 7 propiedades reales
  sacadas del listado público; tipo `Property` fuertemente tipado.
- **Logos / favicon**: por ahora apuntan al CDN público del sitio original
  (`d1v2p1s05qqabi.cloudfront.net`). Reemplazar por copias locales cuando estén.

## Estado actual (2026-04-26)

✅ Configuración base (`package.json`, `astro.config.mjs`, `tailwind.config.cjs`, `tsconfig.json`).
✅ Layout + Header + Footer + ThemeSwitcher.
✅ Componentes: Hero, SearchBar, PropertyCard, PropertiesGrid, ServiciosSection,
   ValoresSection, CtaUnite, ContactBlock.
✅ Páginas: `/`, `/propiedades`, `/tasaciones`, `/la-empresa`, `/contacto`, `/unite`,
   `/emprendimientos`.
✅ Páginas capa AI-native: `/franquicias`, `/tecnologia`, `/inversores` y `/unite`
   reorientada a perfil de elite + stack IA (2026-04-26). Ver `APP_GUIDE/STRATEGY.md`.
✅ Datos de marca y 7 propiedades reales en `src/data/`.
⏳ `npm install` (lo corre el usuario manualmente).
⏳ Detalle de propiedad (`/propiedades/[slug].astro`) — pendiente.
⏳ Sync con catálogo completo — pendiente decisión del usuario:
   - **A)** Vía API de Tokko con API key (recomendado).
   - **B)** Scrape paginado del catálogo público.
⏳ Logos y favicon locales (hoy se usan los del CDN del sitio original).

## Datos del cliente

- **Razón social comercial**: Coldwell Banker Beyker
- **Web actual**: https://beykerbienesraices.com.ar (template Brokian)
- **Domicilio**: Florida 826, Primer piso · Centro, CABA
- **Tel/WhatsApp**: +54 9 11 3077-9018
- **Email**: info.beyker@coldwellbanker.com.ar
- **Social**: Facebook (id 61576706188981), Instagram `beyker.bienesraices`,
  LinkedIn `coldwell-banker-beyker`
- **Tagline**: "Aliados en tu camino, expertos en cada decisión."
- **CRM**: tokkobroker.com (corredor: Patricio Benítez Bagur).

## Notas / decisiones a confirmar

- **Credenciales del CRM**: el usuario ofreció pasar usuario/pass de Tokko. Se rechazó:
  Tokko expone API REST con API key y eso es la vía correcta — además de no enviar
  credenciales por chat. Esperando que el usuario consiga la API key, o que confirme
  preferencia por scrape público.
- **Imágenes**: las que están en `properties.ts` son URLs del CDN del sitio original
  (Cloudfront). Funcionan, pero conviene reemplazar por imágenes propias o por las que
  devuelva la API de Tokko cuando se conecte.
- **Branding CB**: revisar si CB Argentina tiene un manual de marca específico (logos,
  tipografías oficiales). Hoy se usa Inter + Playfair Display como display.

## Próximos pasos

1. Definir cómo cargar el catálogo completo (A o B arriba).
2. Crear página de detalle de propiedad (`[slug].astro`) con galería de fotos, mapa,
   ficha técnica, formulario de consulta y schema `Product` + `RealEstateListing`.
3. Pasar logos y favicon a `/public/logos/` y eliminar las URLs del CDN original.
4. Agregar `og-default.jpg` propio y `robots.txt` cuando se defina dominio.
5. Conectar formularios (Web3Forms / Formspree / endpoint propio) — hoy son `<form>`
   sin handler real.
