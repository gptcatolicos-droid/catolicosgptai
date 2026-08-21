// CatolicosGPT recovery bootstrap — 2026-08-20
// Basado en el commit exacto del que se exportó el backup: 545baee5...
// Objetivo: recuperar datos SIN tocar el servidor original ni depender de Firestore para renderizar.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function recordKey(item = {}) {
  return String(item.id || item.slug || item.url || item.titulo || item.title || item.fecha || '').trim().toLowerCase();
}

function mergeLists(repoItems = [], runtimeItems = []) {
  const merged = new Map();
  for (const item of Array.isArray(repoItems) ? repoItems : []) {
    const key = recordKey(item);
    if (key) merged.set(key, item);
  }
  // El runtime gana si contiene una versión actual del mismo registro.
  for (const item of Array.isArray(runtimeItems) ? runtimeItems : []) {
    const key = recordKey(item);
    if (key) merged.set(key, item);
  }
  return [...merged.values()];
}

function promoteRepoCatalog(filename, listKey) {
  const repoFile = path.join(__dirname, 'data', filename);
  const runtimeFile = path.join(DATA_DIR, filename);
  const repo = readJson(repoFile);
  const runtime = readJson(runtimeFile);
  const repoItems = Array.isArray(repo[listKey]) ? repo[listKey] : [];
  const runtimeItems = Array.isArray(runtime[listKey]) ? runtime[listKey] : [];

  if (!repoItems.length) {
    console.warn(`[Recovery] ${filename}: el catálogo del repo no contiene ${listKey}.`);
    return runtimeItems.length;
  }

  const merged = mergeLists(repoItems, runtimeItems);
  const result = { ...repo, ...runtime, [listKey]: merged };
  if ('total' in repo || 'total' in runtime) result.total = merged.length;

  // Solo escribimos cuando el runtime tiene menos datos que el catálogo sano del repo.
  if (merged.length > runtimeItems.length || !fs.existsSync(runtimeFile)) {
    try {
      fs.writeFileSync(runtimeFile, JSON.stringify(result, null, 2), 'utf8');
      console.log(`[Recovery] ${filename}: runtime promovido de ${runtimeItems.length} a ${merged.length} registros.`);
    } catch (err) {
      console.error(`[Recovery] ${filename}: no se pudo promover al runtime:`, err.message);
    }
  } else {
    console.log(`[Recovery] ${filename}: runtime conserva ${runtimeItems.length} registros.`);
  }
  return merged.length;
}

// 1) Restaurar catálogos que sí están completos en el repo base del backup.
// Fe Católica/Catequesis viven en blog-catalog.json; Santoral en santoral-db.json.
promoteRepoCatalog('blog-catalog.json', 'posts');
promoteRepoCatalog('santoral-db.json', 'santoral');

// 2) Restaurar desde el backup adjunto los catálogos que estaban vacíos en el repo:
// 51 infografías, 7 PDFs, 12 videos y 4 podcasts. Restauradores merge-only.
try {
  require('./bootstrap-content-restore').restoreBundledCatalogs();
  console.log('[Recovery] Infografías y PDFs restaurados/verificados antes del arranque.');
} catch (err) {
  console.error('[Recovery] Restauración Infografías/PDF falló sin bloquear arranque:', err.message);
}

try {
  require('./bootstrap-hidden-content-restore').restoreHiddenCatalogs();
  console.log('[Recovery] Videos y podcasts restaurados/verificados (seguirán ocultos del menú).');
} catch (err) {
  console.error('[Recovery] Restauración Video/Podcast falló sin bloquear arranque:', err.message);
}

// 3) /ninos nunca debe esperar a Firestore/Drive para renderizar.
// Devuelve el catálogo local restaurado inmediatamente y refresca la nube en background.
try {
  const recursosPdf = require('./recursos-pdf-module');
  if (recursosPdf && typeof recursosPdf.refreshFromCloud === 'function') {
    const originalRefresh = recursosPdf.refreshFromCloud.bind(recursosPdf);
    recursosPdf.refreshFromCloud = async function recoveryRefresh(...args) {
      Promise.resolve()
        .then(() => originalRefresh(...args))
        .catch(err => console.warn('[Recovery] Refresh PDF en background:', err.message));
      try {
        return typeof recursosPdf.loadCatalog === 'function' ? recursosPdf.loadCatalog() : { recursos: [] };
      } catch (err) {
        console.warn('[Recovery] Lectura local PDF:', err.message);
        return { recursos: [] };
      }
    };
    console.log('[Recovery] /ninos desacoplado de sincronización externa.');
  }
} catch (err) {
  console.warn('[Recovery] No se pudo instalar protección de /ninos:', err.message);
}

// 4) Validación PRE-STARTUP: deja en logs los conteos que deben llegar al renderer.
try {
  const inf = require('./infografias-module').loadCatalog();
  const pdf = require('./recursos-pdf-module').loadCatalog();
  const blog = readJson(path.join(DATA_DIR, 'blog-catalog.json'));
  const santoral = readJson(path.join(DATA_DIR, 'santoral-db.json'));
  const videos = readJson(path.join(DATA_DIR, 'videos-catalog.json'));
  const podcasts = readJson(path.join(DATA_DIR, 'podcast-catalog.json'));
  console.log('[Recovery Check]', JSON.stringify({
    infografias: Array.isArray(inf.infografias) ? inf.infografias.length : 0,
    recursosPdf: Array.isArray(pdf.recursos) ? pdf.recursos.length : 0,
    feCatolicaBlogPosts: Array.isArray(blog.posts) ? blog.posts.length : 0,
    santoral: Array.isArray(santoral.santoral) ? santoral.santoral.length : 0,
    videos: Array.isArray(videos.videos) ? videos.videos.length : 0,
    podcasts: Array.isArray(podcasts.podcasts) ? podcasts.podcasts.length : 0
  }));
} catch (err) {
  console.error('[Recovery Check] Error de validación:', err.message);
}

// 5) Ocultar únicamente las cuatro secciones solicitadas del menú público.
// No elimina rutas ni datos. "Oración del día" permanece porque usa otra ruta.
try {
  const serverPath = require.resolve('./server');
  const originalJsLoader = Module._extensions['.js'];
  Module._extensions['.js'] = function recoveryLoader(mod, filename) {
    if (filename !== serverPath) return originalJsLoader(mod, filename);
    let source = fs.readFileSync(filename, 'utf8');
    for (const route of ['/oraciones', '/videos', '/podcasts', '/misas']) {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const anchor = new RegExp(`<a\\s+href=["']${escaped}["'][\\s\\S]*?<\\/a>`, 'g');
      source = source.replace(anchor, '');
    }
    Module._extensions['.js'] = originalJsLoader;
    return mod._compile(source, filename);
  };
  console.log('[Recovery] Menú público filtrado: Oraciones, Videos, Podcast y Horarios de Misa.');
} catch (err) {
  console.warn('[Recovery] No se pudo instalar filtro de menú:', err.message);
}

// 6) Arranque normal del server.js original asociado al backup.
require('./server');
