# Coldwell Banker Beyker — Web

Réplica del sitio `beykerbienesraices.com.ar` construida con el stack interno:
**Astro + Tailwind CSS + sistema multi-tema con CSS variables**.

Mismo patrón que `grupobeyker-web`: estático, SEO completo (JSON-LD: `RealEstateAgent`,
`WebSite`, `BreadcrumbList`, `WebPage`), Open Graph, sitemap automático.

## Stack

- **Astro 4** (output `static`) con integración Tailwind y Sitemap.
- **Tailwind 3** + componentes custom (`btn-primary`, `card`, `container-app`, etc.).
- **CSS variables** por tema, sin valores arbitrarios. Persistencia en `localStorage`.
- **TypeScript** (strict) para tipar `Property`, `SITE`, etc.

## Estructura

```
src/
  layouts/Layout.astro       # SEO + JSON-LD + theme bootstrap
  components/                # Header, Footer, Hero, SearchBar, PropertyCard,
                             # PropertiesGrid, ServiciosSection, ValoresSection,
                             # CtaUnite, ContactBlock, ThemeSwitcher
  data/
    site.ts                  # Marca, contacto, social, nav, servicios, valores
    properties.ts            # Catálogo (datos reales sacados del sitio público)
  pages/
    index.astro
    propiedades.astro
    tasaciones.astro
    la-empresa.astro
    contacto.astro
    unite.astro
    emprendimientos.astro
  styles/global.css          # Temas + componentes Tailwind
```

## Comandos

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # build estático en /dist
npm run preview
```

## Temas disponibles

Switch en el header (icono sol). Persistido en `localStorage` (`cb-theme`).

- `coldwell-classic` (default, navy + dorado, fondo claro)
- `coldwell-dark`
- `minimal-light`
- `premium-dark`
- `warm-earth`

Más temas se agregan en `src/styles/global.css` y se listan en
`src/components/ThemeSwitcher.astro`.

## Datos de propiedades

Por ahora, `src/data/properties.ts` tiene **7 propiedades reales** sacadas del listado
público de `beykerbienesraices.com.ar/propiedades`. Para conectar con el catálogo
completo hay dos caminos (ver `APP_GUIDE/CONTEXTO.md`).
