'use strict';
// Registro de borrados permanentes de infografías.
//
// Borrar una infografía desde el admin no servía de nada: tres mecanismos
// distintos la resucitaban en el siguiente arranque —el respaldo comprimido de
// bootstrap-content-restore, la línea base de infografias-safe-recovery y la
// descarga desde Firestore—, y los tres están escritos para "nunca borrar
// contenido existente". No se les puede quitar esa prudencia, porque son lo
// único que repuebla el catálogo cuando el contenedor arranca vacío.
//
// La solución es una lista de lápidas: lo que el administrador borró queda
// anotado, y toda recuperación respeta esa lista. Lo que se borró no vuelve.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const RUNTIME_PATH = path.join(DATA_DIR, 'infografias-eliminadas.json');
// Copia en el repositorio: es la única que sobrevive a un despliegue mientras
// el servicio no tenga disco persistente.
const REPO_PATH = path.join(__dirname, 'data', 'infografias-eliminadas.json');

let cache = null;

function keysOf(item) {
  if (!item || typeof item !== 'object') return [];
  return [item.id, item.slug].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
}

// Cada borrado se guarda como UNA entrada con sus dos claves (id y slug), no
// como dos claves sueltas. Con claves sueltas, restaurar por slug dejaba viva
// la lápida del id y la infografía seguía bloqueada para siempre.
function normalize(entry) {
  if (typeof entry === 'string') {
    const key = entry.trim().toLowerCase();
    return key ? { id: key, slug: key, titulo: '' } : null;
  }
  if (!entry || typeof entry !== 'object') return null;
  const id = String(entry.id || '').trim().toLowerCase();
  const slug = String(entry.slug || '').trim().toLowerCase();
  if (!id && !slug) return null;
  return { id, slug, titulo: String(entry.titulo || entry.tema || '').slice(0, 200), fecha: entry.fecha || new Date().toISOString() };
}

function readFile(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed && parsed.eliminadas) ? parsed.eliminadas : [];
  } catch (_) {
    return [];
  }
}

function load() {
  if (cache) return cache;
  // Se unen las dos copias: la del repositorio aporta lo borrado antes del
  // despliegue y la de ejecución lo borrado desde que arrancó el contenedor.
  cache = [];
  for (const raw of [...readFile(REPO_PATH), ...readFile(RUNTIME_PATH)]) {
    const entry = normalize(raw);
    if (entry && !cache.some(e => matches(e, entry))) cache.push(entry);
  }
  return cache;
}

function matches(entry, item) {
  const keys = new Set(keysOf(item));
  return (entry.id && keys.has(entry.id)) || (entry.slug && keys.has(entry.slug));
}

function persist() {
  const payload = JSON.stringify({ actualizado: new Date().toISOString(), eliminadas: load() }, null, 2);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  // Solo se escribe la copia de ejecución. La del repositorio es la semilla que
  // viene con el despliegue: escribirla desde el servidor no la haría
  // sobrevivir (el contenedor es efímero) y en las pruebas ensuciaría el
  // archivo versionado con lápidas de prueba.
  try { fs.writeFileSync(RUNTIME_PATH, payload, 'utf8'); }
  catch (err) { console.warn('[Infografías] No se pudo guardar el registro de borrados:', err.message); }
}

// Anota el borrado con id y slug: las líneas base identifican los registros por
// uno u otro, así que hacen falta ambos para que ninguna lo cuele.
function remember(item) {
  const entry = normalize(item);
  if (!entry) return false;
  const entries = load();
  if (entries.some(e => matches(e, item))) return false;
  entries.push(entry);
  persist();
  syncToCloud(entry);
  return true;
}

// Deshacer un borrado: devuelve la infografía al catálogo en la siguiente
// recuperación. Un borrado permanente sin marcha atrás sería una trampa.
// Basta con una de sus claves: se retira la entrada entera.
function forget(item) {
  const entries = load();
  const before = entries.length;
  cache = entries.filter(e => !matches(e, item));
  if (cache.length === before) return false;
  persist();
  return true;
}

function isDeleted(item) {
  return load().some(e => matches(e, item));
}

function filter(items) {
  if (!Array.isArray(items)) return [];
  const entries = load();
  if (!entries.length) return items;
  return items.filter(item => !entries.some(e => matches(e, item)));
}

// La papelera del admin necesita saber qué se borró y poder nombrarlo.
function list() {
  return load().map(e => ({ ...e }));
}

// Sin disco persistente, Firestore es lo único que recuerda un borrado hecho
// después del último despliegue. Si falla, el borrado sigue valiendo en este
// contenedor y queda anotado en disco; solo se pierde al reiniciar.
function syncToCloud(entry) {
  // Escape para pruebas y para entornos sin Firestore: sin esto, cada borrado
  // deja abierta una conexión que retrasa la salida del proceso.
  if (process.env.CATOLICOSGPT_SIN_NUBE === '1') return;
  try {
    const firebase = require('./firebase-module');
    if (typeof firebase.syncUploadInfografiaEliminada !== 'function') return;
    firebase.syncUploadInfografiaEliminada(entry).catch(err => {
      console.warn('[Infografías] No se pudo registrar el borrado en la nube:', err.message);
    });
  } catch (_) {}
}

async function hydrateFromCloud() {
  if (process.env.CATOLICOSGPT_SIN_NUBE === '1') return list();
  try {
    const firebase = require('./firebase-module');
    if (typeof firebase.syncDownloadInfografiasEliminadas !== 'function') return list();
    const remote = await firebase.syncDownloadInfografiasEliminadas(list());
    if (!Array.isArray(remote) || !remote.length) return list();
    const entries = load();
    const before = entries.length;
    for (const raw of remote) {
      const entry = normalize(raw);
      if (entry && !entries.some(e => matches(e, entry))) entries.push(entry);
    }
    if (entries.length !== before) {
      persist();
      console.log(`[Infografías] Registro de borrados actualizado desde la nube: ${entries.length} entradas.`);
    }
  } catch (err) {
    console.warn('[Infografías] No se pudo leer el registro de borrados de la nube:', err.message);
  }
  return list();
}

// Solo para pruebas: obliga a releer los archivos en la siguiente consulta.
function reset() { cache = null; }

module.exports = { remember, forget, isDeleted, filter, list, hydrateFromCloud, reset };
