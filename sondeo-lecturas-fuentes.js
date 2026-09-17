'use strict';
// ════════════════════════════════════════════════════════════════════════════
// SONDEO DE FUENTES PARA LAS LECTURAS DEL DÍA
// ════════════════════════════════════════════════════════════════════════════
// Magisterium quedó descartado por dos vías distintas y comprobadas: su widget
// web está detrás del Vercel Security Checkpoint (429 pidiendo ejecutar
// JavaScript) y su API devuelve 404 en las siete rutas plausibles.
//
// Hace falta otra fuente. Este sondeo prueba varias, dice cuál responde y, más
// importante, cuál trae de verdad los rótulos del leccionario en español. Se
// enciende con LECTURAS_SONDEO=1 y se apaga después.
//
// No se prueba nada que exija rodear una protección: si una fuente responde con
// un muro antibots, queda descartada igual que Magisterium.
const { htmlATexto, partirEnLecturas } = require('./magisterium-lecturas');

function fechas(hoy = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(hoy);
  const v = t => (p.find(x => x.type === t) || {}).value;
  return { iso: `${v('year')}-${v('month')}-${v('day')}`, compacta: `${v('year')}${v('month')}${v('day')}`, usccb: `${v('month')}${v('day')}${String(v('year')).slice(2)}` };
}

function candidatas(f) {
  return [
    // Evangelizo / Evangeli.net: API pensada para republicar las lecturas.
    { nombre: 'evangelizo feed (SP)', url: `https://feed.evangelizo.org/v2/reader.php?date=${f.compacta}&type=all&lang=SP` },
    { nombre: 'evangelizo publication', url: `https://publication.evangelizo.org/SP/days/${f.iso}` },
    // Conferencia episcopal de EE. UU., sección en español. Fuente oficial.
    { nombre: 'USCCB lecturas', url: `https://bible.usccb.org/es/bible/lecturas/${f.usccb}.cfm` },
    // Ya estaba en el código, por si sigue sirviendo sin necesitar Gemini.
    { nombre: 'dominicos.org', url: 'https://www.dominicos.org/predicacion/evangelio-del-dia/hoy/' },
    { nombre: 'Vatican News', url: 'https://www.vaticannews.va/es/evangelio-de-hoy.html' }
  ];
}

async function sondear(fetcher = fetch) {
  const f = fechas();
  console.log(`[Sondeo Lecturas] Buscando fuente para ${f.iso}.`);

  for (const c of candidatas(f)) {
    try {
      const r = await fetcher(c.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
          'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9'
        },
        signal: AbortSignal.timeout(20000)
      });
      const tipo = String(r.headers.get('content-type') || '').split(';')[0];
      const cuerpo = await r.text();
      const texto = htmlATexto(cuerpo);
      const lecturas = partirEnLecturas(texto);
      const muro = /security checkpoint|verifying your browser|cf-browser-verification|captcha/i.test(texto);

      console.log(`[Sondeo Lecturas] ${c.nombre} -> HTTP ${r.status} ${tipo}, ${cuerpo.length} bytes, texto ${texto.length}, ${lecturas.length} lecturas${muro ? ' [MURO ANTIBOTS]' : ''}. Primeras líneas: ${JSON.stringify(texto.split('\n').filter(Boolean).slice(0, 5))}`);
      if (lecturas.length) {
        console.log(`[Sondeo Lecturas] ${c.nombre} SIRVE. Rótulos: ${JSON.stringify(lecturas.map(l => l.titulo))}. Primer texto: ${JSON.stringify(lecturas[0].texto.slice(0, 160))}`);
      }
    } catch (err) {
      console.log(`[Sondeo Lecturas] ${c.nombre} -> error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('[Sondeo Lecturas] Terminado. Apaga LECTURAS_SONDEO cuando lo hayas leído.');
}

module.exports = { sondear, candidatas, fechas };
