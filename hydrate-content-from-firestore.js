const firebaseSync = require('./firebase-module');

function safeRequire(path) {
  try { return require(path); } catch (err) {
    console.warn(`[Hydrate] No se pudo cargar ${path}:`, err.message);
    return null;
  }
}

const infografias = safeRequire('./infografias-module');
const blog = safeRequire('./blog-module');
const videos = safeRequire('./videos-module');
const podcasts = safeRequire('./podcast-module');
const santoral = safeRequire('./santoral-module');
const recursosPdf = safeRequire('./recursos-pdf-module');
const oraciones = safeRequire('./oraciones-module');

async function withTimeout(label, fn, ms = 15000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: timeout ${ms}ms`)), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

async function hydrateContent({ reason = 'startup' } = {}) {
  const report = {};
  console.log(`[Hydrate] Iniciando hidratación de contenido (${reason}).`);

  try {
    if (typeof firebaseSync.authenticateServer === 'function') {
      await withTimeout('authenticateServer', () => firebaseSync.authenticateServer(), 12000).catch(err => {
        console.warn('[Hydrate] Auth no completada; se intentará lectura igualmente:', err.message);
      });
    }

    if (infografias && typeof firebaseSync.syncDownloadInfografias === 'function') {
      try {
        const local = infografias.loadCatalog();
        const current = arrayOrEmpty(local.infografias);
        const merged = arrayOrEmpty(await withTimeout('infografias', () => firebaseSync.syncDownloadInfografias(current)));
        if (merged.length > 0) {
          infografias.saveCatalog({ ...local, infografias: merged, total: merged.length });
        }
        report.infografias = merged.length || current.length;
      } catch (err) { console.warn('[Hydrate] Infografías:', err.message); }
    }

    if (blog && typeof firebaseSync.syncDownloadPosts === 'function') {
      try {
        const local = blog.loadBlog();
        const current = arrayOrEmpty(local.posts);
        const merged = arrayOrEmpty(await withTimeout('posts', () => firebaseSync.syncDownloadPosts(current), 25000));
        if (merged.length > 0) {
          const categorias = [...new Set(merged.map(p => p.categoria).filter(Boolean))];
          blog.saveBlog({ ...local, posts: merged, total: merged.length, categorias });
        }
        report.posts = merged.length || current.length;
      } catch (err) { console.warn('[Hydrate] Posts:', err.message); }
    }

    if (videos && typeof firebaseSync.syncDownloadVideos === 'function') {
      try {
        const local = videos.loadVideos();
        const current = arrayOrEmpty(local.videos);
        const merged = arrayOrEmpty(await withTimeout('videos', () => firebaseSync.syncDownloadVideos(current)));
        if (merged.length > 0) videos.saveVideos({ ...local, videos: merged, total: merged.length });
        report.videos = merged.length || current.length;
      } catch (err) { console.warn('[Hydrate] Videos:', err.message); }
    }

    if (podcasts && typeof firebaseSync.syncDownloadPodcasts === 'function') {
      try {
        const local = podcasts.loadPodcasts();
        const current = arrayOrEmpty(local.podcasts);
        const merged = arrayOrEmpty(await withTimeout('podcasts', () => firebaseSync.syncDownloadPodcasts(current)));
        if (merged.length > 0) podcasts.savePodcasts({ ...local, podcasts: merged, total: merged.length });
        report.podcasts = merged.length || current.length;
      } catch (err) { console.warn('[Hydrate] Podcasts:', err.message); }
    }

    if (recursosPdf && typeof firebaseSync.syncDownloadRecursosPdf === 'function') {
      try {
        const local = recursosPdf.loadCatalog();
        const current = arrayOrEmpty(local.recursos);
        const merged = arrayOrEmpty(await withTimeout('recursosPdf', () => firebaseSync.syncDownloadRecursosPdf(current)));
        if (merged.length > 0) recursosPdf.saveCatalog({ ...local, recursos: merged });
        report.recursosPdf = merged.length || current.length;
      } catch (err) { console.warn('[Hydrate] Recursos PDF:', err.message); }
    }

    if (oraciones && typeof firebaseSync.syncDownloadOraciones === 'function') {
      try {
        const local = oraciones.loadCatalog();
        const current = arrayOrEmpty(local.oraciones);
        const merged = arrayOrEmpty(await withTimeout('oraciones', () => firebaseSync.syncDownloadOraciones(current), 20000));
        if (merged.length > 0) {
          oraciones.saveCatalog({ ...local, oraciones: merged });
          console.log(`[Hydrate] Oraciones recuperadas: ${merged.length}.`);
        } else if (current.length === 0) {
          console.warn('[Hydrate] Oraciones sigue vacío: no hubo registros locales ni recuperables desde Firestore.');
        }
        report.oraciones = merged.length || current.length;
      } catch (err) { console.warn('[Hydrate] Oraciones:', err.message); }
    }

    if (santoral && typeof firebaseSync.syncDownloadSantos === 'function') {
      try {
        const localDb = typeof santoral.loadSantoral === 'function' ? santoral.loadSantoral() : { santos: santoral.getAllSaints() };
        const current = arrayOrEmpty(localDb && localDb.santos);
        const merged = arrayOrEmpty(await withTimeout('santoral', () => firebaseSync.syncDownloadSantos(current), 25000));
        if (merged.length > 0 && typeof santoral.saveSantoral === 'function') {
          santoral.saveSantoral({ ...(localDb || {}), santos: merged });
        }
        report.santoral = merged.length || current.length;
      } catch (err) { console.warn('[Hydrate] Santoral:', err.message); }
    }
  } catch (err) {
    console.warn('[Hydrate] Error general no fatal:', err.message);
  }

  console.log('[Hydrate] Resultado:', JSON.stringify(report));
  return report;
}

if (require.main === module) {
  hydrateContent({ reason: 'startup' })
    .catch(err => console.warn('[Hydrate] Fallo no fatal:', err.message))
    .finally(() => process.exit(0));
}

module.exports = { hydrateContent };
