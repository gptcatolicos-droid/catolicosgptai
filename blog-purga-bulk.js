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

const { detectarPlantilla, FUENTE_BULK } = require('./blog-contenido-plantilla');

// La misma pregunta la hacen dos sitios: esta retirada y la bajada desde
// Firestore. Si no coincidieran, la nube volvería a meter mañana lo que hoy se
// quita.
function esContenidoBulk(post) {
  return Boolean(post) && String(post.fuente || '').trim() === FUENTE_BULK;
}

function purgarBlogBulk() {
  // Antes esto corría una sola vez y dejaba una marca para no repetirse. Fue un
  // error: el blog tenía un sembrador que reponía los artículos en cada
  // arranque, y la nube devolvía los suyos, así que la retirada duraba hasta el
  // siguiente reinicio mientras la marca decía que ya estaba hecho. El
  // sembrador ya no existe, pero la comprobación se queda en cada arranque:
  // sale gratis sobre un catálogo limpio y es la única forma de que un lote
  // nuevo no se quede dentro esperando a que alguien lo note.
  let catalogo;
  try {
    catalogo = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  } catch (err) {
    return { hecho: false, motivo: `no se pudo leer el catálogo: ${err.message}` };
  }

  const antes = Array.isArray(catalogo.posts) ? catalogo.posts : [];
  // detectarPlantilla mira el catálogo entero de una vez, porque "repetido" no
  // es una propiedad de un artículo suelto: hace falta ver con qué se repite.
  const plantilla = detectarPlantilla(antes);
  const quedan = antes.filter(p => !plantilla.has(p.slug || p.id));
  const retirados = antes.length - quedan.length;
  if (retirados === 0) return { hecho: false, motivo: 'no quedaba plantilla' };

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
