'use strict';
// ════════════════════════════════════════════════════════════════════════════
// SIGUE LEYENDO: ENLACES INTERNOS AL PIE DE CADA ARTÍCULO
// ════════════════════════════════════════════════════════════════════════════
// Medido sobre el catálogo real: de 1372 artículos publicados, 1364 no enlazan
// a ninguna otra página del sitio. Son hojas sueltas. Eso hace dos daños a la
// vez: quien llega desde Google lee y se va, porque no hay a dónde ir; y la
// autoridad que gana una página no llega a ninguna otra, porque no hay por
// dónde.
//
// Arreglarlo artículo por artículo serían 1364 ediciones. Se arregla en el
// renderizado: el bloque se calcula al servir la página, así que vale para los
// que ya están Y para los que el generador publique mañana, sin tocar ninguno.
//
// Los enlaces salen del índice que ya existe para el chat (agent-related-content),
// que pesa los términos por TF-IDF. No se inventa nada: si nada del catálogo se
// parece lo bastante, no se pinta el bloque. Enlazar a lo que no viene a cuento
// es peor que no enlazar -le dice a Google que el sitio no sabe de qué habla.
const fs = require('fs');
const path = require('path');
const library = require('./agent-related-content');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOGO = path.join(DATA_DIR, 'blog-catalog.json');

// El índice de parecidos descarta lo que no supera su umbral, y hace bien: un
// enlace a algo que no viene a cuento le dice a Google que el sitio no sabe de
// qué habla. Pero eso deja artículos con un enlace o con ninguno, y el problema
// que se está arreglando es justamente que no tengan ninguno.
//
// El respaldo es la propia categoría: si dos artículos están en "catequesis
// para niños", enlazarlos es correcto aunque su parecido textual sea bajo. No
// compite con el índice, lo completa: primero lo que de verdad se parece, y se
// rellena con vecinos de sección hasta llegar al mínimo.
//
// Se guarda en memoria y se rehace cuando cambia el fichero. Sin esto, cada
// visita a un artículo volvería a leer y parsear el catálogo entero -varios
// megas- solo para sacar cuatro enlaces.
let porCategoria = null;
let huella = '';

function indiceDeCategorias() {
  let actual = '';
  try { const s = fs.statSync(CATALOGO); actual = `${s.mtimeMs}:${s.size}`; } catch (_) { actual = 'sin-fichero'; }
  if (porCategoria && actual === huella) return porCategoria;

  const mapa = new Map();
  try {
    const posts = (JSON.parse(fs.readFileSync(CATALOGO, 'utf-8')).posts) || [];
    // Del más reciente al más antiguo: un artículo recién publicado merece más
    // enlaces entrantes que uno de hace un año que ya los tiene.
    const ordenados = posts
      .filter(p => p && p.slug && p.publicado !== false)
      .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
    for (const post of ordenados) {
      const cat = post.categoria || 'sin-categoria';
      if (!mapa.has(cat)) mapa.set(cat, []);
      // Treinta por categoría bastan para rellenar y evitan guardar el catálogo
      // entero en memoria por duplicado.
      if (mapa.get(cat).length < 30) {
        mapa.get(cat).push({ url: `/blog/${post.slug}`, title: post.titulo || post.slug, summary: String(post.descripcion || post.extracto || '').slice(0, 180), slug: post.slug });
      }
    }
  } catch (_) { /* sin catálogo no hay respaldo, y el bloque sale con lo que haya */ }

  porCategoria = mapa;
  huella = actual;
  return porCategoria;
}

function vecinosDeCategoria(post, yaPuestos, cuantos) {
  if (cuantos <= 0) return [];
  const lista = indiceDeCategorias().get(post.categoria || 'sin-categoria') || [];
  const puestos = new Set(yaPuestos.map(a => a.url));
  return lista
    .filter(v => v.slug !== post.slug && !puestos.has(v.url))
    .slice(0, cuantos);
}

// El artículo que se está leyendo no puede enlazarse a sí mismo, y su URL
// aparece en el índice igual que las demás.
function esElMismo(url, slug) {
  if (!url || !slug) return false;
  return url === `/blog/${slug}` || url.endsWith(`/${slug}`);
}

// La consulta con la que se busca parecido. El título solo se queda corto en
// artículos de título genérico; las palabras clave y la categoría dan el tema
// aunque el título no lo diga.
function consultaDe(post) {
  return [post.titulo, post.consultaObjetivo, post.keywords, post.categoria]
    .filter(Boolean).join(' ');
}

function enlaces(post, { articulos = 4, infografias = 2 } = {}) {
  if (!post || !post.slug) return { articulos: [], infografias: [] };
  let encontrado;
  // Si el índice falla, el artículo se sirve igual: un bloque de enlaces no
  // puede tumbar una página.
  try { encontrado = library.related(consultaDe(post), { articulos: articulos + 2, infografias }); }
  catch (_) { return { articulos: [], infografias: [] }; }
  const porParecido = (encontrado.articulos || [])
    .filter(a => !esElMismo(a.url, post.slug))
    .slice(0, articulos);
  const completados = porParecido.concat(vecinosDeCategoria(post, porParecido, articulos - porParecido.length));
  return {
    articulos: completados,
    infografias: (encontrado.infografias || []).slice(0, infografias)
  };
}

function escapar(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function render(post, opciones) {
  const { articulos, infografias } = enlaces(post, opciones);
  if (!articulos.length && !infografias.length) return '';

  const tarjeta = (item, etiqueta) => `
    <a href="${escapar(item.url)}" class="group block border border-[#E6DFD4] rounded-xl p-4 bg-white hover:border-gold transition">
      <span class="text-[10px] font-bold uppercase tracking-wide text-ink-2">${etiqueta}</span>
      <span class="block font-display font-bold text-sm text-maroon group-hover:underline mt-1">${escapar(item.title)}</span>
      ${item.summary ? `<span class="block text-xs text-ink-2 mt-1 leading-snug">${escapar(String(item.summary).slice(0, 110))}</span>` : ''}
    </a>`;

  return `
    <nav class="mt-12 border-t pt-8" aria-label="Sigue leyendo">
      <h2 class="font-display font-bold text-xl text-maroon mb-4">Sigue leyendo</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        ${articulos.map(a => tarjeta(a, 'Artículo')).join('')}
        ${infografias.map(i => tarjeta(i, 'Infografía')).join('')}
      </div>
    </nav>`;
}

module.exports = { render, enlaces, consultaDe, esElMismo, vecinosDeCategoria };
