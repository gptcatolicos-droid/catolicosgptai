'use strict';
// El chat dejaba al lector en un callejón sin salida: leía la respuesta y no
// tenía a dónde seguir. Este módulo enlaza cada consulta con el material que
// el sitio ya tiene publicado (infografías y artículos del blog) sobre ese
// mismo tema.
//
// La relación se calcula con un índice local, sin llamar a ningún modelo: no
// añade ni un milisegundo de espera al usuario ni un centavo de gasto, y
// funciona aunque las APIs externas fallen.
const path = require('path');

// Palabras que aparecen en casi cualquier pregunta en español y no dicen nada
// sobre el tema. Sin esta lista, "¿qué es la gracia?" emparejaría con todo lo
// que contenga "que" o "es".
const STOP = new Set(('a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque cada como con contra cual cuales cuando cuanto de del desde donde dos el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estan estas este esto estos fue fueron ha hace hacer hacia han hasta hay la las le les lo los mas me mi mientras muy no nos nuestra nuestro o os otra otras otro otros para pero poco por porque pues que quien quienes se ser si sin sobre son su sus tambien tan tanto te tiene tienen toda todas todo todos tras un una unas uno unos usted ustedes ya yo sea sean solo puede pueden debe deben cuanta cuantas cuantos cual cuales significa significado explicame explica dime dame quiero necesito favor gracias hola hermano hermana').split(' '));

// Términos de marca y de relleno que el catálogo repite en casi todos los
// registros: si no se descartan, cualquier consulta "coincide" con los mil
// artículos por igual.
const BOILERPLATE = new Set(['catolicosgpt', 'catolico', 'catolica', 'catolicos', 'catolicas', 'guia', 'completa', 'preguntas', 'frecuentes', 'principiantes', 'formacion', 'contenido', 'articulo', 'infografia', 'tema']);

function tokens(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 3 && !STOP.has(t) && !BOILERPLATE.has(t));
}

// Cada campo pesa distinto: que el tema aparezca en el título es mucho más
// significativo que encontrarlo perdido en una meta descripción.
function weigh(entry, value, weight) {
  for (const token of tokens(value)) entry.fields.set(token, Math.max(entry.fields.get(token) || 0, weight));
}

function load(file) {
  try { return require(path.join(__dirname, 'data', file)); } catch { return null; }
}

let index = null;

function build() {
  const entries = [];
  const blog = load('blog-catalog.json');
  for (const post of (blog && blog.posts) || []) {
    if (post.publicado === false || !post.slug) continue;
    const entry = { kind: 'articulo', slug: post.slug, title: post.titulo || post.slug, url: `/blog/${post.slug}`, summary: String(post.descripcion || post.extracto || '').slice(0, 180), category: post.categoria || '', image: post.imagenPortada || '', fields: new Map() };
    weigh(entry, post.titulo, 3);
    weigh(entry, post.categoria, 2);
    weigh(entry, post.keywords, 2);
    weigh(entry, post.descripcion || post.extracto, 1);
    entries.push(entry);
  }
  const infografias = load('infografias-catalog.json');
  for (const inf of (infografias && infografias.infografias) || []) {
    if (inf.publicado === false || !inf.slug) continue;
    const image = (Array.isArray(inf.imagenes) && inf.imagenes[0] && inf.imagenes[0].url) || '';
    const entry = { kind: 'infografia', slug: inf.slug, title: inf.titulo || inf.tema || inf.slug, url: `/infografias/${inf.slug}`, summary: String(inf.metaDescription || '').slice(0, 180), category: inf.categoria || '', image, coloring: inf.categoria === 'dibujo-para-colorear' || inf.esDibujoNinos === true, fields: new Map() };
    weigh(entry, inf.titulo || inf.tema, 3);
    weigh(entry, inf.tema, 2);
    weigh(entry, inf.categoria, 2);
    weigh(entry, inf.keywords, 2);
    weigh(entry, inf.metaDescription, 1);
    entries.push(entry);
  }
  // IDF. El catálogo repite fórmulas enteras ("doctrina catolica", "catequesis
  // catolica") en cada ficha; sin esto, esas palabras vacías dominarían el
  // puntaje y todas las consultas devolverían los mismos cinco artículos.
  const documentFrequency = new Map();
  for (const entry of entries) for (const token of entry.fields.keys()) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  const total = entries.length || 1;
  const idf = new Map();
  for (const [token, frequency] of documentFrequency) idf.set(token, Math.log(total / frequency));
  return { entries, idf };
}

function ensure() {
  if (!index) index = build();
  return index;
}

// Un término distintivo es el que aparece en pocas fichas del catálogo. "Santa"
// o "oración" salen en cientos y no identifican nada; "purgatorio" o "Lourdes"
// sí. Sin esta distinción, preguntar por Santa Teresa de Ávila —de quien no hay
// material publicado— devolvía a Santa Rita y a Santa Bernardita.
const DISTINCTIVE_IDF = 3;

function score(entry, queryTokens, idf) {
  let value = 0;
  let hits = 0;
  let titleHit = false;
  let distinctive = false;
  for (const token of queryTokens) {
    const weight = entry.fields.get(token);
    if (!weight) continue;
    const rarity = idf.get(token) || 0;
    value += weight * rarity;
    hits++;
    if (weight >= 3) titleHit = true;
    if (rarity >= DISTINCTIVE_IDF) distinctive = true;
  }
  // Sin un término distintivo en común no hay relación real, por alto que sea
  // el puntaje acumulado a fuerza de palabras genéricas.
  if (!distinctive) return 0;
  // Y una sola coincidencia solo cuenta si cayó en el título: encontrar
  // "sacramento" perdido en una meta descripción no relaciona nada.
  if (hits < 2 && !titleHit) return 0;
  return value;
}

function expose(entry) {
  return { kind: entry.kind, title: entry.title, url: entry.url, summary: entry.summary, category: entry.category, image: entry.image || '' };
}

// Devuelve el material publicado más cercano a la consulta: 2 infografías y 5
// artículos. Si nada alcanza el umbral devuelve menos (o ninguno): enlazar
// contenido que no tiene que ver con la pregunta es peor que no enlazar nada.
function related(query, { infografias = 2, articulos = 5 } = {}) {
  const queryTokens = [...new Set(tokens(query))];
  if (!queryTokens.length) return { infografias: [], articulos: [] };
  const { entries, idf } = ensure();
  // Los dibujos para colorear son material infantil: solo compiten de igual a
  // igual cuando la pregunta va de niños.
  const childish = /\b(nin|infant|colorear|dibuj|catequesis)/.test(queryTokens.join(' '));
  const ranked = [];
  for (const entry of entries) {
    let value = score(entry, queryTokens, idf);
    if (value <= 0) continue;
    if (entry.coloring && !childish) value *= 0.45;
    ranked.push({ entry, value });
  }
  if (!ranked.length) return { infografias: [], articulos: [] };
  ranked.sort((a, b) => b.value - a.value);
  // El umbral se calcula por tipo, no sobre la mezcla: una infografía muy
  // buena no debe subir el listón hasta dejar fuera a todos los artículos, que
  // compiten en otra liga de puntajes.
  const pick = (kind, limit) => {
    const group = ranked.filter(r => r.entry.kind === kind);
    if (!group.length) return [];
    const floor = Math.max(group[0].value * 0.45, 1.6);
    // El blog publica cada tema en cinco variantes ("Guía completa", "Preguntas
    // frecuentes", "Para familias"…). Sin este tope, los cinco enlaces serían
    // el mismo artículo cinco veces y no una ruta de lectura.
    const perFamily = new Map();
    const out = [];
    for (const r of group) {
      if (r.value < floor || out.length >= limit) break;
      const family = r.entry.title.split(':')[0].trim().toLowerCase();
      const used = perFamily.get(family) || 0;
      if (used >= 2) continue;
      perFamily.set(family, used + 1);
      out.push(expose(r.entry));
    }
    return out;
  };
  return { infografias: pick('infografia', infografias), articulos: pick('articulo', articulos) };
}

module.exports = { related, tokens };
