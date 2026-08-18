const firebaseSync = require('./firebase-module');

function safeRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`[Restore] No se pudo cargar ${name}:`, err.message);
    return null;
  }
}

const infografias = safeRequire('./infografias-module');
const blog = safeRequire('./blog-module');
const oraciones = safeRequire('./oraciones-module');
const recursosPdf = safeRequire('./recursos-pdf-module');
const videos = safeRequire('./videos-module');
const podcast = safeRequire('./podcast-module');

function arr(v) { return Array.isArray(v) ? v : []; }

function recordKey(item) {
  const source = item || {};
  return String(source.id || source.slug || source.url || source.titulo || source.title || '').trim().toLowerCase();
}

function mergeRecords(local, remote) {
  const merged = arr(local).filter(Boolean).map(item => ({ ...item }));
  for (const item of arr(remote)) {
    const key = recordKey(item);
    const index = key ? merged.findIndex(existing => recordKey(existing) === key) : -1;
    if (index < 0) merged.push(item);
    else merged[index] = { ...merged[index], ...item };
  }
  return merged;
}

async function restoreContent() {
  const report = {};
  console.log('[Restore] Iniciando recuperación no bloqueante de contenido desde Firestore.');

  try {
    if (infografias && typeof firebaseSync.syncDownloadInfografias === 'function') {
      const local = infografias.loadCatalog();
      const merged = arr(await firebaseSync.syncDownloadInfografias(arr(local.infografias)));
      if (merged.length) infografias.saveCatalog({ ...local, infografias: merged, total: merged.length });
      report.infografias = merged.length;
    }
  } catch (e) { console.warn('[Restore] Infografías:', e.message); }

  try {
    if (blog && typeof firebaseSync.syncDownloadPosts === 'function') {
      const local = blog.loadBlog();
      const merged = arr(await firebaseSync.syncDownloadPosts(arr(local.posts)));
      if (merged.length) {
        blog.saveBlog({
          ...local,
          posts: merged,
          total: merged.length,
          categorias: [...new Set(merged.map(p => p.categoria).filter(Boolean))]
        });
      }
      report.feCatolica = merged.length;
      report.catequesis = merged.filter(p => ['catequesis-ninos','catequesis-jovenes'].includes(p.categoria)).length;
    }
  } catch (e) { console.warn('[Restore] Fe Católica:', e.message); }

  try {
    if (oraciones && typeof firebaseSync.syncDownloadOraciones === 'function') {
      const local = oraciones.loadCatalog();
      const merged = arr(await firebaseSync.syncDownloadOraciones(arr(local.oraciones)));
      if (merged.length) oraciones.saveCatalog({ ...local, oraciones: merged });
      report.oraciones = merged.length;
    }
  } catch (e) { console.warn('[Restore] Oraciones:', e.message); }

  try {
    if (recursosPdf && typeof firebaseSync.syncDownloadRecursosPdf === 'function') {
      const local = recursosPdf.loadCatalog();
      const current = arr(local.recursos || local.items);
      const merged = arr(await firebaseSync.syncDownloadRecursosPdf(current));
      if (merged.length) recursosPdf.saveCatalog({ ...local, recursos: merged });
      report.recursosPdf = merged.length;
    }
  } catch (e) { console.warn('[Restore] PDFs:', e.message); }

  try {
    if (videos && typeof firebaseSync.syncDownloadVideos === 'function') {
      const local = videos.loadVideos();
      const merged = arr(await firebaseSync.syncDownloadVideos(arr(local.videos)));
      if (merged.length) videos.saveVideos({ ...local, videos: merged, total: merged.length });
      report.videos = merged.length;
    }
  } catch (e) { console.warn('[Restore] Videos:', e.message); }

  try {
    if (podcast && typeof firebaseSync.syncDownloadPodcasts === 'function') {
      const local = podcast.loadPodcasts();
      const merged = arr(await firebaseSync.syncDownloadPodcasts(arr(local.podcasts)));
      if (merged.length) podcast.savePodcasts({ ...local, podcasts: merged, total: merged.length });
      report.podcasts = merged.length;
    }
  } catch (e) { console.warn('[Restore] Podcasts:', e.message); }

  console.log('[Restore] Resultado:', JSON.stringify(report));
  return report;
}

module.exports = { restoreContent };
