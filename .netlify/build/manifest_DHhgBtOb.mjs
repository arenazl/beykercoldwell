import '@astrojs/internal-helpers/path';
import 'cookie';
import 'kleur/colors';
import 'es-module-lexer';
import { n as NOOP_MIDDLEWARE_HEADER, o as decodeKey } from './chunks/astro/server_BGwuQ1Km.mjs';
import 'clsx';
import 'html-escaper';

const NOOP_MIDDLEWARE_FN = async (_ctx, next) => {
  const response = await next();
  response.headers.set(NOOP_MIDDLEWARE_HEADER, "true");
  return response;
};

const codeToStatusMap = {
  // Implemented from tRPC error code table
  // https://trpc.io/docs/server/error-handling#error-codes
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 405,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500
};
Object.entries(codeToStatusMap).reduce(
  // reverse the key-value pairs
  (acc, [key, value]) => ({ ...acc, [value]: key }),
  {}
);

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///D:/Code/beykercoldwell/","adapterName":"@astrojs/netlify","routes":[{"file":"buscar/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/buscar","isIndex":false,"type":"page","pattern":"^\\/buscar\\/?$","segments":[[{"content":"buscar","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/buscar.astro","pathname":"/buscar","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"contacto/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/contacto","isIndex":false,"type":"page","pattern":"^\\/contacto\\/?$","segments":[[{"content":"contacto","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/contacto.astro","pathname":"/contacto","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"emprendimientos/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/emprendimientos","isIndex":false,"type":"page","pattern":"^\\/emprendimientos\\/?$","segments":[[{"content":"emprendimientos","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/emprendimientos.astro","pathname":"/emprendimientos","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"franquicias/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/franquicias","isIndex":false,"type":"page","pattern":"^\\/franquicias\\/?$","segments":[[{"content":"franquicias","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/franquicias.astro","pathname":"/franquicias","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"inversores/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/inversores","isIndex":false,"type":"page","pattern":"^\\/inversores\\/?$","segments":[[{"content":"inversores","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/inversores.astro","pathname":"/inversores","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"la-empresa/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/la-empresa","isIndex":false,"type":"page","pattern":"^\\/la-empresa\\/?$","segments":[[{"content":"la-empresa","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/la-empresa.astro","pathname":"/la-empresa","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"propiedades/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/propiedades","isIndex":false,"type":"page","pattern":"^\\/propiedades\\/?$","segments":[[{"content":"propiedades","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/propiedades.astro","pathname":"/propiedades","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"tasaciones/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/tasaciones","isIndex":false,"type":"page","pattern":"^\\/tasaciones\\/?$","segments":[[{"content":"tasaciones","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/tasaciones.astro","pathname":"/tasaciones","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"tasaciones-ia/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/tasaciones-ia","isIndex":false,"type":"page","pattern":"^\\/tasaciones-ia\\/?$","segments":[[{"content":"tasaciones-ia","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/tasaciones-ia.astro","pathname":"/tasaciones-ia","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"tecnologia/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/tecnologia","isIndex":false,"type":"page","pattern":"^\\/tecnologia\\/?$","segments":[[{"content":"tecnologia","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/tecnologia.astro","pathname":"/tecnologia","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"unite/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/unite","isIndex":false,"type":"page","pattern":"^\\/unite\\/?$","segments":[[{"content":"unite","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/unite.astro","pathname":"/unite","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/ai-search","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/ai-search\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"ai-search","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/ai-search.ts","pathname":"/api/ai-search","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/valuar","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/valuar\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"valuar","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/valuar.ts","pathname":"/api/valuar","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"site":"https://beykerbienesraices.com.ar","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["D:/Code/beykercoldwell/src/pages/buscar.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/contacto.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/emprendimientos.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/franquicias.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/index.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/inversores.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/la-empresa.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/propiedades.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/tasaciones-ia.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/tasaciones.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/tecnologia.astro",{"propagation":"none","containsHead":true}],["D:/Code/beykercoldwell/src/pages/unite.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(o,t)=>{let i=async()=>{await(await o())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/api/ai-search@_@ts":"pages/api/ai-search.astro.mjs","\u0000@astro-page:src/pages/api/valuar@_@ts":"pages/api/valuar.astro.mjs","\u0000@astro-page:src/pages/buscar@_@astro":"pages/buscar.astro.mjs","\u0000@astro-page:src/pages/contacto@_@astro":"pages/contacto.astro.mjs","\u0000@astro-page:src/pages/emprendimientos@_@astro":"pages/emprendimientos.astro.mjs","\u0000@astro-page:src/pages/franquicias@_@astro":"pages/franquicias.astro.mjs","\u0000@astro-page:src/pages/inversores@_@astro":"pages/inversores.astro.mjs","\u0000@astro-page:src/pages/la-empresa@_@astro":"pages/la-empresa.astro.mjs","\u0000@astro-page:src/pages/propiedades@_@astro":"pages/propiedades.astro.mjs","\u0000@astro-page:src/pages/tasaciones@_@astro":"pages/tasaciones.astro.mjs","\u0000@astro-page:src/pages/tasaciones-ia@_@astro":"pages/tasaciones-ia.astro.mjs","\u0000@astro-page:src/pages/tecnologia@_@astro":"pages/tecnologia.astro.mjs","\u0000@astro-page:src/pages/unite@_@astro":"pages/unite.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_DHhgBtOb.mjs","/astro/hoisted.js?q=0":"_astro/hoisted.BpPDZg62.js","/astro/hoisted.js?q=1":"_astro/hoisted.B4mw64rI.js","/astro/hoisted.js?q=2":"_astro/hoisted.BmRRdM89.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/buscar.BjlxQskl.css","/_astro/hoisted.B4mw64rI.js","/_astro/hoisted.BmRRdM89.js","/_astro/hoisted.BpPDZg62.js","/buscar/index.html","/contacto/index.html","/emprendimientos/index.html","/franquicias/index.html","/inversores/index.html","/la-empresa/index.html","/propiedades/index.html","/tasaciones/index.html","/tasaciones-ia/index.html","/tecnologia/index.html","/unite/index.html","/index.html"],"buildFormat":"directory","checkOrigin":false,"serverIslandNameMap":[],"key":"W506tg0MSo0ovClgPl3U0TDgVLFxTXE0dqamgl889Z0=","experimentalEnvGetSecretEnabled":false});

export { manifest };
