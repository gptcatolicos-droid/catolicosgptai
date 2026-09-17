'use strict';
// ════════════════════════════════════════════════════════════════════════════
// LECTURAS DE LA MISA DEL DÍA — DESDE MAGISTERIUM
// ════════════════════════════════════════════════════════════════════════════
// Magisterium publica las lecturas de cada día en un widget con la fecha en la
// URL: /es/widgets/daily-mass/2026-09-17. Siempre están, que es justo lo que le
// faltaba a este sitio: los raspadores anteriores dependían de que dominicos.org
// respondiera y de que Gemini extrajera bien el texto, y cuando algo de eso
// fallaba la página acababa sirviendo un devocional fijo como si fuera la
// liturgia del día.
//
// Sobre el análisis del HTML: no busca etiquetas ni clases, que cambian con
// cualquier rediseño. Busca los rótulos de las propias lecturas -"Primera
// lectura", "Salmo responsorial", "Evangelio"-, que no cambian porque son los
// del leccionario. Si algún día cambia la maquetación, esto sigue funcionando.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CACHE_PATH = path.join(DATA_DIR, 'lecturas-magisterium.json');
const BASE = process.env.MAGISTERIUM_DAILY_MASS_URL || 'https://www.magisterium.com/es/widgets/daily-mass';

function hoyEnBogota(ahora = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(ahora);
  const v = t => (p.find(x => x.type === t) || {}).value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}

function htmlATexto(html) {
  return String(html || '')
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Los cortes de bloque se conservan como saltos para poder separar después.
    .replace(/<\/(p|div|h[1-6]|li|section|article|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&aacute;/gi, 'á')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .trim();
}

function sinTildes(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Los rótulos del leccionario, en el orden en que se proclaman.
const ROTULOS = [
  { clave: 'primera',  etiqueta: 'Primera lectura',    patron: /primera\s+lectura/ },
  { clave: 'salmo',    etiqueta: 'Salmo responsorial', patron: /salmo\s+(responsorial|\d)/ },
  { clave: 'segunda',  etiqueta: 'Segunda lectura',    patron: /segunda\s+lectura/ },
  { clave: 'aleluya',  etiqueta: 'Aleluya',            patron: /^(aleluya|versiculo antes del evangelio|aclamacion antes del evangelio)/ },
  { clave: 'evangelio', etiqueta: 'Evangelio',         patron: /(santo\s+)?evangelio/ }
];

// Corta el texto plano en secciones usando los rótulos como fronteras.
function partirEnLecturas(texto) {
  const lineas = String(texto || '').split('\n');
  const marcas = [];
  lineas.forEach((linea, i) => {
    const plana = sinTildes(linea).trim();
    if (!plana || plana.length > 90) return;
    for (const r of ROTULOS) {
      if (r.patron.test(plana)) { marcas.push({ i, ...r, titulo: linea.trim() }); break; }
    }
  });
  if (!marcas.length) return [];

  const lecturas = [];
  for (let n = 0; n < marcas.length; n++) {
    const desde = marcas[n].i + 1;
    const hasta = n + 1 < marcas.length ? marcas[n + 1].i : lineas.length;
    const cuerpo = lineas.slice(desde, hasta).join('\n').trim();
    if (cuerpo.length < 25) continue;
    lecturas.push({ clave: marcas[n].clave, titulo: marcas[n].titulo || marcas[n].etiqueta, texto: cuerpo });
  }
  return lecturas;
}

// Un widget hecho con Next suele traer los datos en un JSON incrustado. Si está,
// se prefiere: es texto limpio, sin maquetación de por medio.
function lecturasDesdeJsonIncrustado(html) {
  const bloque = String(html || '').match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!bloque) return [];
  try {
    const datos = JSON.parse(bloque[1]);
    const encontradas = [];
    const recorrer = (nodo, prof = 0) => {
      if (!nodo || prof > 8 || encontradas.length >= 6) return;
      if (Array.isArray(nodo)) { nodo.forEach(n => recorrer(n, prof + 1)); return; }
      if (typeof nodo !== 'object') return;
      const titulo = nodo.title || nodo.titulo || nodo.label || nodo.name;
      const cuerpo = nodo.text || nodo.texto || nodo.body || nodo.content;
      if (typeof titulo === 'string' && typeof cuerpo === 'string' && cuerpo.length > 40) {
        const plana = sinTildes(titulo);
        if (ROTULOS.some(r => r.patron.test(plana))) {
          encontradas.push({ titulo: titulo.trim(), texto: cuerpo.trim() });
        }
      }
      Object.values(nodo).forEach(v => recorrer(v, prof + 1));
    };
    recorrer(datos);
    return encontradas;
  } catch (_) {
    return [];
  }
}

function leerCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')); } catch (_) { return null; }
}

function guardarCache(datos) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(datos, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Lecturas Magisterium] No se pudo guardar la caché:', err.message);
  }
}

// Descarga y analiza. Deja en el registro una huella de lo que recibió: desde
// este entorno no se puede alcanzar magisterium.com, así que los registros de
// producción son la única forma de comprobar que el análisis acierta.
async function pedir(url, fetcher) {
  const cabeceras = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
    'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9'
  };
  // Pedirlo sin identificarse devolvía 429: nos limitaban por anónimos. Ya
  // tenemos clave de Magisterium para el chat; se usa también aquí.
  const clave = String(process.env.MAGISTERIUM_API_KEY || '').trim();
  if (clave) cabeceras.Authorization = `Bearer ${clave}`;

  return fetcher(url, {
    headers: cabeceras,
    signal: AbortSignal.timeout(Number(process.env.MAGISTERIUM_DAILY_MASS_TIMEOUT_MS) || 20000)
  });
}

async function descargar(fecha, fetcher = fetch) {
  const url = `${BASE}/${fecha}`;
  let respuesta = await pedir(url, fetcher);

  // Un 429 puede ser un pico momentáneo. Se reintenta una vez, con espera; más
  // de eso sería insistirle a quien acaba de pedir que no insistamos.
  if (respuesta.status === 429) {
    const espera = Number(process.env.MAGISTERIUM_REINTENTO_MS) || 4000;
    console.warn(`[Lecturas Magisterium] ${fecha}: 429, reintentando en ${espera} ms.`);
    await new Promise(r => setTimeout(r, espera));
    respuesta = await pedir(url, fetcher);
  }

  const tipo = String(respuesta.headers.get('content-type') || '');
  const cuerpo = await respuesta.text();

  // Aunque el código no sea 200 se mira el cuerpo: una respuesta de 29 KB de
  // HTML puede traer las lecturas igual, y descartarla por el código sería
  // tirar lo que veníamos a buscar. Si no las trae, el registro dice qué llegó.
  if (!respuesta.ok) {
    const textoFallo = htmlATexto(cuerpo);
    const lecturasFallo = partirEnLecturas(textoFallo);
    console.warn(`[Lecturas Magisterium] ${fecha}: HTTP ${respuesta.status} (${tipo.split(';')[0]}, ${cuerpo.length} bytes, texto ${textoFallo.length}, ${lecturasFallo.length} lecturas). Primeras líneas: ${JSON.stringify(textoFallo.split('\n').filter(Boolean).slice(0, 5))}`);
    if (!lecturasFallo.length) return null;
    console.log(`[Lecturas Magisterium] ${fecha}: el cuerpo del ${respuesta.status} sí traía las lecturas; se usan.`);
    return {
      fecha,
      fuente: 'Magisterium',
      url: `https://www.magisterium.com/es/widgets/daily-mass/${fecha}`,
      via: `cuerpo de HTTP ${respuesta.status}`,
      descargadoEn: new Date().toISOString(),
      lecturas: lecturasFallo.slice(0, 6).map(l => ({ titulo: l.titulo, texto: l.texto }))
    };
  }

  let lecturas = [];
  let via = '';

  if (/json/i.test(tipo)) {
    try {
      const datos = JSON.parse(cuerpo);
      const lista = datos.readings || datos.lecturas || datos.data || [];
      lecturas = (Array.isArray(lista) ? lista : []).map(l => ({
        titulo: String(l.title || l.titulo || l.label || '').trim(),
        texto: String(l.text || l.texto || l.body || '').trim()
      })).filter(l => l.titulo && l.texto.length > 25);
      via = 'json';
    } catch (_) {}
  }

  if (!lecturas.length) {
    lecturas = lecturasDesdeJsonIncrustado(cuerpo);
    if (lecturas.length) via = '__NEXT_DATA__';
  }

  const texto = htmlATexto(cuerpo);
  if (!lecturas.length) {
    lecturas = partirEnLecturas(texto);
    if (lecturas.length) via = 'rótulos del leccionario';
  }

  console.log(`[Lecturas Magisterium] ${fecha}: HTTP ${respuesta.status}, ${tipo.split(';')[0]}, ${cuerpo.length} bytes, texto ${texto.length}, ${lecturas.length} lecturas${via ? ` (vía ${via})` : ''}. Primeras líneas: ${JSON.stringify(texto.split('\n').filter(Boolean).slice(0, 4))}`);

  if (!lecturas.length) return null;

  return {
    fecha,
    fuente: 'Magisterium',
    url: `https://www.magisterium.com/es/widgets/daily-mass/${fecha}`,
    via,
    descargadoEn: new Date().toISOString(),
    lecturas: lecturas.slice(0, 6).map(l => ({ titulo: l.titulo, texto: l.texto }))
  };
}

// Una descarga al día: la caché vive en el disco persistente.
async function lecturasDeHoy({ ahora = new Date(), fetcher = fetch, forzar = false } = {}) {
  const fecha = hoyEnBogota(ahora);
  const cache = leerCache();
  if (!forzar && cache && cache.fecha === fecha && Array.isArray(cache.lecturas) && cache.lecturas.length) {
    return cache;
  }
  try {
    const frescas = await descargar(fecha, fetcher);
    if (frescas) { guardarCache(frescas); return frescas; }
  } catch (err) {
    console.warn('[Lecturas Magisterium] Falló la descarga:', err.message);
  }
  // Sin lecturas nuevas se devuelve null, no la de ayer: una lectura de otro día
  // presentada como la de hoy es exactamente el error que veníamos de arreglar.
  return null;
}

module.exports = { lecturasDeHoy, descargar, partirEnLecturas, lecturasDesdeJsonIncrustado, htmlATexto, hoyEnBogota, CACHE_PATH };
