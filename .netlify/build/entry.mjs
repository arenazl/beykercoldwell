import { renderers } from './renderers.mjs';
import { s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_CvSoi7hX.mjs';
import { manifest } from './manifest_DHhgBtOb.mjs';
import { createExports } from '@astrojs/netlify/ssr-function.js';

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/ai-search.astro.mjs');
const _page2 = () => import('./pages/api/valuar.astro.mjs');
const _page3 = () => import('./pages/buscar.astro.mjs');
const _page4 = () => import('./pages/contacto.astro.mjs');
const _page5 = () => import('./pages/emprendimientos.astro.mjs');
const _page6 = () => import('./pages/franquicias.astro.mjs');
const _page7 = () => import('./pages/inversores.astro.mjs');
const _page8 = () => import('./pages/la-empresa.astro.mjs');
const _page9 = () => import('./pages/propiedades.astro.mjs');
const _page10 = () => import('./pages/tasaciones.astro.mjs');
const _page11 = () => import('./pages/tasaciones-ia.astro.mjs');
const _page12 = () => import('./pages/tecnologia.astro.mjs');
const _page13 = () => import('./pages/unite.astro.mjs');
const _page14 = () => import('./pages/index.astro.mjs');

const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/api/ai-search.ts", _page1],
    ["src/pages/api/valuar.ts", _page2],
    ["src/pages/buscar.astro", _page3],
    ["src/pages/contacto.astro", _page4],
    ["src/pages/emprendimientos.astro", _page5],
    ["src/pages/franquicias.astro", _page6],
    ["src/pages/inversores.astro", _page7],
    ["src/pages/la-empresa.astro", _page8],
    ["src/pages/propiedades.astro", _page9],
    ["src/pages/tasaciones.astro", _page10],
    ["src/pages/tasaciones-ia.astro", _page11],
    ["src/pages/tecnologia.astro", _page12],
    ["src/pages/unite.astro", _page13],
    ["src/pages/index.astro", _page14]
]);
const serverIslandMap = new Map();
const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "70683c10-42e9-4493-8819-c61bfaa4eda0"
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (_start in serverEntrypointModule) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
