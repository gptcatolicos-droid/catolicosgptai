'use strict';
// ════════════════════════════════════════════════════════════════════════════
// SALUD SEO DEL CATÁLOGO
// ════════════════════════════════════════════════════════════════════════════
// El catálogo vive en el disco del servidor, así que desde fuera no hay forma de
// saber en qué estado están sus 1367 artículos: si sus descripciones dicen algo
// o son relleno, si Google les corta el título, si son finos, si se enlazan
// entre sí. Sin eso, cualquier arreglo es a ciegas.
//
// Esto lo mide. Deja un resumen en el arranque -una línea, para verlo desde los
// registros- y una página en el admin con el detalle, ordenada por lo que más
// pesa, para poder trabajar la lista de arriba abajo.
//
// Los umbrales no son opinión: Google corta el título sobre los 60 caracteres y
// la descripción sobre los 160, y en móvil -que aquí es el 83% de las
// impresiones- todavía menos.

const LIMITE_TITULO = 60;
const DESCRIPCION_MAX = 160;
const DESCRIPCION_MIN = 70;
// Menos de 300 palabras es contenido fino: no es una regla de Google, es que no
// da para responder bien una pregunta y se nota en lo que la gente hace al
// llegar.
const PALABRAS_MINIMAS = 300;
// Cuántas veces ha de repetirse una descripción -quitado el título- para
// considerarla de plantilla y no coincidencia.
const REPETICIONES_PARA_GENERICA = 5;

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function palabras(markdown) {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#*_`>|-]/g, ' ')
    .split(/\s+/).filter(Boolean).length;
}

// Enlaces a otras páginas del propio sitio. Un artículo que no enlaza a ninguno
// es una hoja suelta: ni reparte autoridad ni retiene a quien llega de Google.
function enlacesInternos(markdown) {
  const cuerpo = String(markdown || '');
  const markdownLinks = (cuerpo.match(/\]\(\/(?!\/)[^)]*\)/g) || []).length;
  const htmlLinks = (cuerpo.match(/href=["']\/(?!\/)[^"']*["']/g) || []).length;
  // Los shortcodes renderizan tarjetas con enlace: cuentan como enlace interno.
  const shortcodes = (cuerpo.match(/\[(?:infografia|video|podcast):[\w-]+\]/g) || []).length;
  return markdownLinks + htmlLinks + shortcodes;
}

// Quita el título de dentro de la descripción. Va por palabras completas y no
// por longitud: un umbral de caracteres dejaba escapar los títulos cortos -y en
// este sitio hay muchos, "María", "La Misa", "El Rosario"-, mientras que cortar
// por el medio de una palabra destrozaría descripciones escritas a mano.
function quitarTitulo(descripcionNormalizada, tituloNormalizado) {
  if (!tituloNormalizado) return descripcionNormalizada;
  const escapado = tituloNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return descripcionNormalizada
    .replace(new RegExp(`\\b${escapado}\\b`, 'g'), ' ')
    .replace(/\s+/g, ' ').trim();
}

// Una descripción es genérica cuando, quitado el título, lo que queda se repite
// en muchos artículos. Es el mismo razonamiento que con el cuerpo: el molde se
// reconoce por lo que NO cambia. Quitar el título no puede provocar un falso
// positivo por sí solo -lo que agrupa es que el resto coincida en CINCO
// artículos distintos, y dos textos escritos a mano no hacen eso.
function contarDescripciones(posts) {
  const cuenta = new Map();
  for (const post of posts) {
    const desc = normalizar(post.descripcion || post.extracto);
    if (!desc) continue;
    const molde = quitarTitulo(desc, normalizar(post.titulo));
    if (molde.length < 30) continue;
    cuenta.set(molde, (cuenta.get(molde) || 0) + 1);
  }
  return cuenta;
}

function analizar(posts) {
  const lista = (Array.isArray(posts) ? posts : []).filter(p => p && p.publicado !== false);
  const moldes = contarDescripciones(lista);

  const fichas = lista.map(post => {
    const titulo = String(post.seoTitle || post.titulo || '');
    const desc = String(post.descripcion || post.extracto || '').trim();
    const molde = quitarTitulo(normalizar(desc), normalizar(post.titulo));

    const problemas = [];
    if (titulo.length > LIMITE_TITULO) problemas.push('titulo-largo');
    if (!desc) problemas.push('sin-descripcion');
    else {
      if (desc.length > DESCRIPCION_MAX) problemas.push('descripcion-larga');
      else if (desc.length < DESCRIPCION_MIN) problemas.push('descripcion-corta');
      if (molde.length >= 30 && (moldes.get(molde) || 0) >= REPETICIONES_PARA_GENERICA) problemas.push('descripcion-generica');
    }
    const cuantasPalabras = palabras(post.contenidoMd);
    if (cuantasPalabras < PALABRAS_MINIMAS) problemas.push('contenido-fino');
    if (enlacesInternos(post.contenidoMd) === 0) problemas.push('sin-enlaces-internos');
    if (!Array.isArray(post.faqs) || post.faqs.length === 0) problemas.push('sin-preguntas');

    return {
      slug: post.slug,
      titulo: post.titulo,
      categoria: post.categoria || '',
      largoTitulo: titulo.length,
      largoDescripcion: desc.length,
      palabras: cuantasPalabras,
      enlaces: enlacesInternos(post.contenidoMd),
      problemas
    };
  });

  const resumen = {};
  for (const ficha of fichas) for (const p of ficha.problemas) resumen[p] = (resumen[p] || 0) + 1;

  return { total: fichas.length, resumen, fichas };
}

function resumenCorto(analisis) {
  const r = analisis.resumen;
  const partes = Object.keys(r).sort((a, b) => r[b] - r[a]).map(k => `${k}=${r[k]}`);
  return `${analisis.total} artículos | ${partes.join(' ') || 'sin problemas'}`;
}

function register(app, { getAuthedUser, isStrictAdminUser, blog, renderPage } = {}) {
  const soloAdmin = (req, res, next) => {
    const usuario = typeof getAuthedUser === 'function' ? getAuthedUser(req) : null;
    if (typeof isStrictAdminUser === 'function' && isStrictAdminUser(usuario)) return next();
    return res.status(404).end();
  };

  app.get('/admin/seo.json', soloAdmin, (req, res) => {
    const analisis = analizar((blog.loadBlog().posts) || []);
    res.set('Cache-Control', 'no-store').json({ total: analisis.total, resumen: analisis.resumen, fichas: analisis.fichas });
  });

  app.get('/admin/seo', soloAdmin, (req, res) => {
    const analisis = analizar((blog.loadBlog().posts) || []);
    const r = analisis.resumen;
    const etiquetas = {
      'titulo-largo': `Título que Google corta (más de ${LIMITE_TITULO} caracteres)`,
      'sin-descripcion': 'Sin descripción: Google se inventa el resumen',
      'descripcion-larga': `Descripción cortada (más de ${DESCRIPCION_MAX})`,
      'descripcion-corta': `Descripción demasiado corta (menos de ${DESCRIPCION_MIN})`,
      'descripcion-generica': 'Descripción de molde, repetida en muchos artículos',
      'contenido-fino': `Menos de ${PALABRAS_MINIMAS} palabras`,
      'sin-enlaces-internos': 'No enlaza a ninguna otra página del sitio',
      'sin-preguntas': 'Sin preguntas frecuentes (se pierde el bloque de Google)'
    };
    const orden = Object.keys(r).sort((a, b) => r[b] - r[a]);
    // Se ordena por número de problemas: lo de arriba es donde más rinde el rato.
    const peores = analisis.fichas.slice().sort((a, b) => b.problemas.length - a.problemas.length).slice(0, 60);

    const html = `
      <div class="max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div class="border-b pb-4">
          <h1 class="font-display font-bold text-3xl text-maroon">Salud SEO del blog</h1>
          <p class="text-ink-2 text-sm">${analisis.total} artículos publicados. Lo de arriba es lo que más rinde arreglar.</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          ${orden.map(k => `
            <div class="border border-[#E6DFD4] rounded-xl p-4 bg-white">
              <div class="text-2xl font-bold text-maroon">${r[k]}</div>
              <div class="text-xs text-ink-2 mt-1">${etiquetas[k] || k}</div>
            </div>`).join('') || '<p>Sin problemas detectados.</p>'}
        </div>
        <h2 class="font-display font-bold text-xl text-maroon mt-4">Los 60 que más lo necesitan</h2>
        <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead><tr class="text-left border-b">
            <th class="py-2 pr-3">Artículo</th><th class="py-2 pr-3">Palabras</th>
            <th class="py-2 pr-3">Enlaces</th><th class="py-2">Qué le falta</th>
          </tr></thead>
          <tbody>
          ${peores.map(f => `<tr class="border-b align-top">
            <td class="py-2 pr-3"><a href="/blog/${f.slug}" class="text-maroon font-semibold">${f.titulo || f.slug}</a></td>
            <td class="py-2 pr-3">${f.palabras}</td>
            <td class="py-2 pr-3">${f.enlaces}</td>
            <td class="py-2 text-ink-2 text-xs">${f.problemas.map(p => etiquetas[p] || p).join(' · ')}</td>
          </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>`;
    res.send(renderPage('Salud SEO', html, req, { description: 'Diagnóstico SEO del blog.' }));
  });

  // Una línea en el arranque. Es la única forma de ver el estado del catálogo
  // sin entrar al admin, y de que quede registrado cómo evoluciona.
  setTimeout(() => {
    try { console.log(`[SEO] Salud del blog: ${resumenCorto(analizar((blog.loadBlog().posts) || []))}`); }
    catch (err) { console.warn('[SEO] No se pudo medir la salud del blog:', err.message); }
  }, 90 * 1000).unref?.();
}

module.exports = { analizar, resumenCorto, register, palabras, enlacesInternos, quitarTitulo, LIMITE_TITULO, DESCRIPCION_MAX, DESCRIPCION_MIN, PALABRAS_MINIMAS };
