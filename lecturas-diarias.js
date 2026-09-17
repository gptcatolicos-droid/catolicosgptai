'use strict';
// ════════════════════════════════════════════════════════════════════════════
// LAS LECTURAS DE LA MISA DE CADA DÍA
// ════════════════════════════════════════════════════════════════════════════
// Magisterium quedó descartado por dos vías comprobadas desde producción: su
// widget está tras el Vercel Security Checkpoint (429 pidiendo ejecutar
// JavaScript) y su API devuelve 404 en las siete rutas plausibles. Rodear ese
// checkpoint con un navegador headless sería ignorar a propósito algo que el
// dueño del sitio encendió, así que no se hace.
//
// Un sondeo desde producción probó cinco fuentes. Se quedan dos, y las dos
// coincidieron en el contenido del día -1 Corintios 15,1-11 y Lucas 7,36-50-,
// que es la mejor señal de que ambas están bien:
//
//   1. evangelizo.org, cuyo feed existe justamente para republicar las
//      lecturas. Devuelve 3,7 KB de texto limpio, sin menús ni cookies.
//   2. La sección en español de la USCCB, fuente oficial de los obispos de
//      Estados Unidos, con los rótulos del leccionario escritos tal cual.
//
// Si la primera falla se usa la segunda. Si fallan las dos, no se inventa nada:
// la página dice que hoy no están.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CACHE_PATH = path.join(DATA_DIR, 'lecturas-del-dia.json');

const CABECERAS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9'
};

function fechas(ahora = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(ahora);
  const v = t => (p.find(x => x.type === t) || {}).value;
  return {
    iso: `${v('year')}-${v('month')}-${v('day')}`,
    compacta: `${v('year')}${v('month')}${v('day')}`,
    usccb: `${v('month')}${v('day')}${String(v('year')).slice(2)}`
  };
}

function htmlATexto(html) {
  return String(html || '')
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|section|article|tr)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t ]+/g, ' ')
    .split('\n').map(l => l.trim()).filter((l, i, a) => l || (a[i - 1] || '').length)
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function hayMuroAntibots(texto) {
  return /security checkpoint|verifying your browser|cf-browser-verification|captcha/i.test(texto || '');
}

// ── evangelizo.org ──────────────────────────────────────────────────────────
// Su feed no rotula las lecturas con "Primera lectura": las encabeza con la
// referencia bíblica misma ("Carta I de San Pablo a los Corintios 15,1-11."),
// que es como se leen en la Misa. Así que las fronteras se buscan ahí.
const LIBROS = 'G[ée]nesis|[ÉE]xodo|Lev[ií]tico|N[úu]meros|Deuteronomio|Josu[ée]|Jueces|Rut|Samuel|Reyes|Cr[óo]nicas|Esdras|Nehem[ií]as|Tob[ií]as|Judit|Ester|Macabeos|Job|Salmo|Proverbios|Eclesiast[ée]s|Cantar|Sabidur[ií]a|Eclesi[áa]stico|Sir[áa]cida|Isa[ií]as|Jerem[ií]as|Lamentaciones|Baruc|Ezequiel|Daniel|Oseas|Joel|Am[óo]s|Abd[ií]as|Jon[áa]s|Miqueas|Nah[úu]m|Habacuc|Sofon[ií]as|Ageo|Zacar[ií]as|Malaqu[ií]as|Mateo|Marcos|Lucas|Juan|Hechos|Romanos|Corintios|G[áa]latas|Efesios|Filipenses|Colosenses|Tesalonicenses|Timoteo|Tito|Filem[óo]n|Hebreos|Santiago|Pedro|Judas|Apocalipsis|Evangelio|Carta|Libro|Profec[ií]a';
const REFERENCIA = new RegExp(`(${LIBROS})`, 'i');

function pareceReferencia(linea) {
  const l = String(linea || '').trim();
  if (l.length < 6 || l.length > 130) return false;
  if (!REFERENCIA.test(l)) return false;
  // Una referencia lleva capítulo y versículo: "15,1-11", "7,36-50", "118(117),1-2".
  return /\d\s*[,.]\s*\d/.test(l);
}

function papelDeLaLectura(referencia, indice) {
  const r = String(referencia || '').toLowerCase();
  if (/^salmo/.test(r)) return 'salmo';
  if (/evangelio|seg[úu]n san/.test(r)) return 'evangelio';
  return indice === 0 ? 'primera' : 'segunda';
}

function analizarEvangelizo(texto) {
  const lineas = String(texto || '').split('\n').map(l => l.trim());
  const marcas = [];
  lineas.forEach((l, i) => { if (pareceReferencia(l)) marcas.push(i); });
  if (!marcas.length) return [];

  const lecturas = [];
  marcas.forEach((inicio, n) => {
    const fin = n + 1 < marcas.length ? marcas[n + 1] : lineas.length;
    const cuerpo = lineas.slice(inicio + 1, fin).join('\n').trim();
    if (cuerpo.length < 40) return;
    const referencia = lineas[inicio];
    lecturas.push({ papel: papelDeLaLectura(referencia, lecturas.length), titulo: referencia, texto: cuerpo });
  });
  return lecturas;
}

async function desdeEvangelizo(f, fetcher) {
  const url = `https://feed.evangelizo.org/v2/reader.php?date=${f.compacta}&type=all&lang=SP`;
  const r = await fetcher(url, { headers: CABECERAS, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`evangelizo respondió ${r.status}`);
  const texto = htmlATexto(await r.text());
  if (hayMuroAntibots(texto)) throw new Error('evangelizo devolvió un muro antibots');
  const lecturas = analizarEvangelizo(texto);
  if (!lecturas.length) throw new Error('evangelizo no trajo lecturas reconocibles');
  return { fuente: 'evangelizo.org', url, lecturas };
}

// ── USCCB, sección en español ───────────────────────────────────────────────
// Aquí sí están los rótulos del leccionario escritos, así que se parte por
// ellos. Su página trae menús alrededor; el corte por rótulos los deja fuera.
const ROTULOS = [
  { papel: 'primera',  patron: /^primera\s+lectura/i },
  { papel: 'salmo',    patron: /^salmo(\s|\b)/i },
  { papel: 'segunda',  patron: /^segunda\s+lectura/i },
  { papel: 'aleluya',  patron: /^(aclamaci[óo]n antes del evangelio|aleluya|vers[íi]culo antes del evangelio)/i },
  { papel: 'evangelio', patron: /^(santo\s+)?evangelio\b/i }
];

function analizarUSCCB(texto) {
  const lineas = String(texto || '').split('\n').map(l => l.trim());
  const marcas = [];
  lineas.forEach((l, i) => {
    if (!l || l.length > 90) return;
    // Un rótulo es una etiqueta, no una frase. "Aleluya, aleluya. Mis ovejas
    // escuchan mi voz, dice el Señor." empieza por "Aleluya" y encajaba en el
    // patrón, así que se tomaba por rótulo y el texto de la aclamación
    // desaparecía entero. Los rótulos del leccionario no terminan en punto.
    if (/[.!?]$/.test(l)) return;
    const r = ROTULOS.find(x => x.patron.test(l));
    if (r) marcas.push({ i, papel: r.papel, titulo: l });
  });
  if (!marcas.length) return [];

  const lecturas = [];
  marcas.forEach((m, n) => {
    const fin = n + 1 < marcas.length ? marcas[n + 1].i : lineas.length;
    const cuerpo = lineas.slice(m.i + 1, fin).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (cuerpo.length < 40) return;
    lecturas.push({ papel: m.papel, titulo: m.titulo, texto: cuerpo });
  });
  return lecturas;
}

async function desdeUSCCB(f, fetcher) {
  const url = `https://bible.usccb.org/es/bible/lecturas/${f.usccb}.cfm`;
  const r = await fetcher(url, { headers: CABECERAS, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`USCCB respondió ${r.status}`);
  const texto = htmlATexto(await r.text());
  if (hayMuroAntibots(texto)) throw new Error('USCCB devolvió un muro antibots');
  const lecturas = analizarUSCCB(texto);
  if (!lecturas.length) throw new Error('USCCB no trajo lecturas reconocibles');
  return { fuente: 'USCCB (Conferencia Episcopal de EE. UU.)', url, lecturas };
}

const FUENTES = [
  { nombre: 'evangelizo.org', leer: desdeEvangelizo },
  { nombre: 'USCCB', leer: desdeUSCCB }
];

function leerCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')); } catch (_) { return null; }
}

function guardarCache(datos) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(datos, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Lecturas] No se pudo guardar la caché:', err.message);
  }
}

async function lecturasDeHoy({ ahora = new Date(), fetcher = fetch, forzar = false } = {}) {
  const f = fechas(ahora);
  const cache = leerCache();
  if (!forzar && cache && cache.fecha === f.iso && Array.isArray(cache.lecturas) && cache.lecturas.length) {
    return cache;
  }

  for (const fuente of FUENTES) {
    try {
      const resultado = await fuente.leer(f, fetcher);
      const datos = {
        fecha: f.iso,
        fuente: resultado.fuente,
        url: resultado.url,
        descargadoEn: new Date().toISOString(),
        lecturas: resultado.lecturas.slice(0, 6)
      };
      guardarCache(datos);
      console.log(`[Lecturas] ${f.iso}: ${datos.lecturas.length} lecturas desde ${datos.fuente}.`);
      return datos;
    } catch (err) {
      console.warn(`[Lecturas] ${fuente.nombre} no sirvió: ${err.message}`);
    }
  }

  // Sin lecturas nuevas se devuelve nada, nunca la de ayer: una lectura de otro
  // día presentada como la de hoy es peor que una página que reconoce el hueco.
  console.warn(`[Lecturas] ${f.iso}: ninguna fuente sirvió.`);
  return null;
}

module.exports = {
  lecturasDeHoy, desdeEvangelizo, desdeUSCCB,
  analizarEvangelizo, analizarUSCCB, htmlATexto, fechas, pareceReferencia, CACHE_PATH
};
