'use strict';
// ════════════════════════════════════════════════════════════════════════════
// RETIRADA DEL BLOG GENERADO POR PLANTILLA
// ════════════════════════════════════════════════════════════════════════════
// El blog traía mil artículos que eran cien temas repetidos diez veces cada uno
// ("Guía completa", "Preguntas frecuentes", "Para principiantes", "Para
// familias"...). Medido sobre el catálogo: el 76% del texto era idéntico entre
// ellos, y 43 frases largas aparecían en LOS MIL. Eso es lo que Google llama
// contenido a escala, y no hunde solo esas páginas: pesa sobre el dominio
// entero, incluidas las que sí valen.
//
// Se retiran. Los identifica su propio campo fuente, así que la regla es
// quirúrgica: nada escrito a mano ni generado con Magisterium se toca.
//
// El catálogo completo sigue en el historial de git, así que esto se puede
// deshacer si hiciera falta.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'blog-catalog.json');
const MARCA_PATH = path.join(DATA_DIR, 'blog-purga-bulk.json');

const FUENTE_BULK = 'CatolicosGPT bulk editorial local';

// La misma pregunta la hacen dos sitios: esta retirada y la bajada desde
// Firestore. Si no coincidieran, la nube volvería a meter mañana lo que hoy se
// quita.
function esContenidoBulk(post) {
  return Boolean(post) && String(post.fuente || '').trim() === FUENTE_BULK;
}

function purgarBlogBulk() {
  // La marca vive en el disco persistente: esto corre una vez y nunca más,
  // aunque el servicio se reinicie veinte veces al día.
  if (fs.existsSync(MARCA_PATH)) return { hecho: false, motivo: 'ya se hizo' };

  let catalogo;
  try {
    catalogo = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  } catch (err) {
    return { hecho: false, motivo: `no se pudo leer el catálogo: ${err.message}` };
  }

  const antes = Array.isArray(catalogo.posts) ? catalogo.posts : [];
  const quedan = antes.filter(p => !esContenidoBulk(p));
  const retirados = antes.length - quedan.length;

  catalogo.posts = quedan;
  catalogo.total = quedan.length;

  try {
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalogo, null, 2), 'utf-8');
    fs.writeFileSync(MARCA_PATH, JSON.stringify({
      fecha: new Date().toISOString(),
      retirados,
      quedan: quedan.length,
      fuente: FUENTE_BULK
    }, null, 2), 'utf-8');
  } catch (err) {
    return { hecho: false, motivo: `no se pudo escribir: ${err.message}` };
  }

  console.log(`[Blog] Retirados ${retirados} artículos de plantilla; quedan ${quedan.length}.`);
  return { hecho: true, retirados, quedan: quedan.length };
}

// Saber si la retirada ya ocurrió decide algo más que no repetirla: mientras la
// nube siga llena de artículos de plantilla, bajarla entera cuesta miles de
// lecturas para tirar casi todo lo que llega.
function purgaHecha() {
  try { return fs.existsSync(MARCA_PATH); } catch (_) { return false; }
}

module.exports = { purgarBlogBulk, esContenidoBulk, purgaHecha, FUENTE_BULK, MARCA_PATH };
