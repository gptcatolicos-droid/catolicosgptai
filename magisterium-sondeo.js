'use strict';
// ════════════════════════════════════════════════════════════════════════════
// SONDEO DE LA API DE MAGISTERIUM — UNA VEZ, PARA SABER QUÉ HAY
// ════════════════════════════════════════════════════════════════════════════
// El widget web de las lecturas está detrás del "Vercel Security Checkpoint":
// responde 429 con una página que pide ejecutar JavaScript. Saltárselo con un
// navegador headless sería rodear un control que el dueño del sitio encendió a
// propósito, así que no se hace.
//
// La API es otra cosa: es el canal previsto, se paga y ya funciona desde
// producción (el chat la usa a diario, /api/v1/search y /api/v1/chat/completions
// responden sin checkpoint). Lo que no sé es si publica el leccionario.
//
// Esto lo averigua: prueba unas pocas rutas candidatas con nuestra clave, una
// sola vez, y deja en el registro qué respondió cada una. Con eso se decide sin
// adivinar. Se activa con MAGISTERIUM_SONDEO=1 y se apaga después.
const BASE = 'https://www.magisterium.com/api/v1';

// Resultado del sondeo del 17/09/2026: las siete devolvieron 404 con la página
// HTML de Next, no JSON. La API de Magisterium no publica el leccionario. Se
// deja escrito para que nadie vuelva a intentarlo creyendo que falta probar.
const CANDIDATAS = [
  '/readings',
  '/readings/today',
  '/daily-mass',
  '/daily-mass/2026-09-17',
  '/lectionary',
  '/liturgy/today',
  '/calendar/today'
];

async function sondear(fetcher = fetch) {
  const clave = String(process.env.MAGISTERIUM_API_KEY || '').trim();
  if (!clave) {
    console.warn('[Sondeo Magisterium] Sin MAGISTERIUM_API_KEY; no hay nada que probar.');
    return [];
  }

  const resultados = [];
  for (const ruta of CANDIDATAS) {
    const url = `${BASE}${ruta}`;
    try {
      const r = await fetcher(url, {
        headers: { Authorization: `Bearer ${clave}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
      const tipo = String(r.headers.get('content-type') || '').split(';')[0];
      const cuerpo = (await r.text()).slice(0, 220).replace(/\s+/g, ' ');
      resultados.push({ ruta, estado: r.status, tipo, muestra: cuerpo });
      console.log(`[Sondeo Magisterium] ${ruta} -> ${r.status} ${tipo} :: ${cuerpo}`);
    } catch (err) {
      resultados.push({ ruta, error: err.message });
      console.log(`[Sondeo Magisterium] ${ruta} -> error: ${err.message}`);
    }
    // Sin prisa: es un sondeo, no una carga.
    await new Promise(r => setTimeout(r, 1200));
  }
  console.log('[Sondeo Magisterium] Terminado. Apaga MAGISTERIUM_SONDEO cuando lo hayas leído.');
  return resultados;
}

module.exports = { sondear, CANDIDATAS, BASE };
