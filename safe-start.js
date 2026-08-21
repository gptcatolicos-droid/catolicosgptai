// CatolicosGPT recovery bootstrap — 2026-08-20
// Basado en el commit del que se exportó el backup: 545baee5...
const fs = require('fs');
const Module = require('module');

// 1) Restaurar primero los catálogos respaldados. Los restauradores son merge-only:
// nunca borran contenido actual y el contenido existente tiene prioridad.
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

// 2) /ninos nunca debe esperar a Firestore/Drive para renderizar.
// Se devuelve el catálogo local inmediatamente y el refresh corre en background.
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

// 3) Ocultar únicamente las cuatro secciones solicitadas del menú público.
// No se eliminan rutas ni contenidos. Se transforma server.js solo en memoria.
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
  console.log('[Recovery] Menú: Oraciones, Videos, Podcast y Horarios de Misa ocultos.');
} catch (err) {
  console.warn('[Recovery] No se pudo instalar filtro de menú:', err.message);
}

// 4) Arranque normal del servidor original del backup.
require('./server');
