const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'recursos-pdf.json');
let cloudSyncStarted = false;
let lastCloudRefreshAt = 0;

function getFirebaseSync() {
  try {
    return require('./firebase-module');
  } catch (err) {
    return null;
  }
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ recursos: [], updatedAt: new Date().toISOString() }, null, 2));
  }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `recurso-${Date.now()}`;
}

function loadCatalog() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(parsed.recursos)) parsed.recursos = [];
    return parsed;
  } catch (e) {
    return { recursos: [], updatedAt: new Date().toISOString(), error: e.message };
  }
}

function saveCatalog(catalog) {
  ensureStore();
  const safe = {
    recursos: Array.isArray(catalog.recursos) ? catalog.recursos : [],
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(safe, null, 2));
  return safe;
}

function mergeCatalogItems(localItems = [], cloudItems = []) {
  const merged = [...localItems];
  cloudItems.forEach((cloudItem) => {
    if (!cloudItem) return;
    const idx = merged.findIndex(item =>
      (item.id && cloudItem.id && item.id === cloudItem.id) ||
      (item.slug && cloudItem.slug && item.slug === cloudItem.slug)
    );
    if (idx === -1) {
      merged.push(cloudItem);
      return;
    }
    const localTime = new Date(merged[idx].actualizadoEn || merged[idx].creadoEn || 0).getTime();
    const cloudTime = new Date(cloudItem.actualizadoEn || cloudItem.creadoEn || 0).getTime();
    if (cloudTime >= localTime) {
      merged[idx] = { ...merged[idx], ...cloudItem };
    }
  });
  return merged;
}

function syncFromCloudOnce() {
  if (cloudSyncStarted) return;
  cloudSyncStarted = true;
  const firebaseSync = getFirebaseSync();
  if (!firebaseSync || typeof firebaseSync.syncDownloadRecursosPdf !== 'function') return;
  const localCatalog = loadCatalog();
  firebaseSync.syncDownloadRecursosPdf(localCatalog.recursos || [])
    .then((mergedItems) => {
      if (!Array.isArray(mergedItems)) return;
      const merged = mergeCatalogItems(localCatalog.recursos || [], mergedItems);
      if (merged.length >= (localCatalog.recursos || []).length) {
        saveCatalog({ recursos: merged });
      }
    })
    .catch((err) => {
      console.warn('[Recursos PDF] No se pudo sincronizar desde Firestore:', err.message);
    });
}

async function refreshFromCloud(options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();
  if (!force && now - lastCloudRefreshAt < 30000) return loadCatalog();
  lastCloudRefreshAt = now;

  const firebaseSync = getFirebaseSync();
  if (!firebaseSync || typeof firebaseSync.syncDownloadRecursosPdf !== 'function') {
    return loadCatalog();
  }

  const localCatalog = loadCatalog();
  try {
    const mergedItems = await firebaseSync.syncDownloadRecursosPdf(localCatalog.recursos || []);
    if (Array.isArray(mergedItems)) {
      const merged = mergeCatalogItems(localCatalog.recursos || [], mergedItems);
      return saveCatalog({ recursos: merged });
    }
  } catch (err) {
    console.warn('[Recursos PDF] No se pudo refrescar desde Firestore:', err.message);
  }
  return localCatalog;
}

function syncResourceToCloud(resource) {
  const firebaseSync = getFirebaseSync();
  if (!firebaseSync || typeof firebaseSync.syncUploadRecursoPdf !== 'function') return;
  firebaseSync.syncUploadRecursoPdf(resource).catch((err) => {
    console.warn('[Recursos PDF] No se pudo guardar en Firestore:', err.message);
  });
}

async function syncResourceToCloudNow(resource) {
  const firebaseSync = getFirebaseSync();
  if (!firebaseSync || typeof firebaseSync.syncUploadRecursoPdf !== 'function') return false;
  await firebaseSync.syncUploadRecursoPdf(resource);
  return true;
}

function syncDeleteFromCloud(slug) {
  const firebaseSync = getFirebaseSync();
  if (!firebaseSync || typeof firebaseSync.syncDeleteRecursoPdf !== 'function') return;
  firebaseSync.syncDeleteRecursoPdf(slug).catch((err) => {
    console.warn('[Recursos PDF] No se pudo eliminar en Firestore:', err.message);
  });
}

function getRecursos(options = {}) {
  syncFromCloudOnce();
  const catalog = loadCatalog();
  const q = normalizeText(options.q || '');
  const audiencia = normalizeText(options.audiencia || '');
  const categoria = normalizeText(options.categoria || '');
  const publicado = options.publicado === undefined ? true : options.publicado;
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, Math.min(500, parseInt(options.limit || 48, 10)));

  let items = (catalog.recursos || []).filter(item => {
    if (publicado !== null && Boolean(item.publicado !== false) !== Boolean(publicado)) return false;
    if (audiencia && audiencia !== 'todo' && normalizeText(item.audiencia) !== audiencia) return false;
    if (categoria && normalizeText(item.categoria) !== categoria) return false;
    if (q) {
      const haystack = normalizeText([
        item.titulo,
        item.descripcion,
        item.categoria,
        item.audiencia,
        item.tags,
        item.keywords,
        item.slug
      ].join(' '));
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  items = items.sort((a, b) => {
    const ao = Number.isFinite(Number(a.orden)) ? Number(a.orden) : 999999;
    const bo = Number.isFinite(Number(b.orden)) ? Number(b.orden) : 999999;
    if (ao !== bo) return ao - bo;
    return String(b.creadoEn || '').localeCompare(String(a.creadoEn || ''));
  });

  const total = items.length;
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total, page, limit };
}

function getBySlug(slug) {
  syncFromCloudOnce();
  const wanted = normalizeText(slug);
  return (loadCatalog().recursos || []).find(item => normalizeText(item.slug) === wanted) || null;
}

function upsertResource(input = {}) {
  const catalog = loadCatalog();
  const now = new Date().toISOString();
  const originalSlug = input.originalSlug || input.slug || '';
  const existingIndex = originalSlug
    ? catalog.recursos.findIndex(item => item.slug === originalSlug)
    : -1;
  const baseTitle = String(input.titulo || input.title || '').trim();
  if (!baseTitle) throw new Error('El título del recurso PDF es obligatorio.');

  const proposedSlug = slugify(input.slug || baseTitle);
  let finalSlug = proposedSlug;
  let suffix = 2;
  while (catalog.recursos.some((item, idx) => idx !== existingIndex && item.slug === finalSlug)) {
    finalSlug = `${proposedSlug}-${suffix++}`;
  }

  const previous = existingIndex >= 0 ? catalog.recursos[existingIndex] : {};
  const resource = {
    id: previous.id || `pdf-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    slug: finalSlug,
    titulo: baseTitle,
    descripcion: String(input.descripcion || input.description || '').trim(),
    categoria: String(input.categoria || 'catequesis').trim(),
    audiencia: String(input.audiencia || 'general').trim(),
    tags: String(input.tags || '').trim(),
    keywords: String(input.keywords || input.tags || '').trim(),
    coverUrl: String(input.coverUrl || input.cover || previous.coverUrl || '').trim(),
    pdfUrl: String(input.pdfUrl || input.url || previous.pdfUrl || '').trim(),
    driveFileId: String(input.driveFileId || previous.driveFileId || '').trim(),
    driveViewUrl: String(input.driveViewUrl || previous.driveViewUrl || '').trim(),
    driveDownloadUrl: String(input.driveDownloadUrl || previous.driveDownloadUrl || '').trim(),
    cloudinaryPublicId: String(input.cloudinaryPublicId || previous.cloudinaryPublicId || '').trim(),
    cloudinaryResourceType: input.cloudinaryResourceType || previous.cloudinaryResourceType || 'raw',
    cloudinaryVersion: String(input.cloudinaryVersion || previous.cloudinaryVersion || '').trim(),
    cloudinaryAssetId: String(input.cloudinaryAssetId || previous.cloudinaryAssetId || '').trim(),
    cloudinarySecureUrl: String(input.cloudinarySecureUrl || previous.cloudinarySecureUrl || '').trim(),
    bytes: Number(input.bytes || previous.bytes || 0),
    format: input.format || previous.format || 'pdf',
    paginas: input.paginas ? Number(input.paginas) : (previous.paginas || null),
    orden: input.orden !== undefined && input.orden !== '' ? Number(input.orden) : (previous.orden ?? catalog.recursos.length + 1),
    publicado: input.publicado === undefined ? (previous.publicado !== false) : Boolean(input.publicado),
    creadoEn: previous.creadoEn || now,
    actualizadoEn: now
  };

  if (existingIndex >= 0) {
    catalog.recursos[existingIndex] = resource;
  } else {
    catalog.recursos.push(resource);
  }
  saveCatalog(catalog);
  syncResourceToCloud(resource);
  return resource;
}

async function upsertResourceAsync(input = {}) {
  const resource = upsertResource(input);
  await syncResourceToCloudNow(resource);
  return resource;
}

function deleteBySlug(slug) {
  const catalog = loadCatalog();
  const before = catalog.recursos.length;
  catalog.recursos = catalog.recursos.filter(item => item.slug !== slug);
  saveCatalog(catalog);
  if (before !== catalog.recursos.length) syncDeleteFromCloud(slug);
  return before !== catalog.recursos.length;
}

function searchRelated(query, limit = 3) {
  const qNorm = normalizeText(query);
  const terms = qNorm.split(/\s+/).filter(term => term.length > 3);
  if (!terms.length) return [];
  const scored = getRecursos({ limit: 500 }).items.map(item => {
    const title = normalizeText(item.titulo);
    const haystack = normalizeText([item.titulo, item.descripcion, item.tags, item.keywords, item.categoria, item.audiencia].join(' '));
    let score = 0;
    terms.forEach(term => {
      if (title.includes(term)) score += 20;
      if (haystack.includes(term)) score += 8;
    });
    if (qNorm.includes('confes') && haystack.includes('confes')) score += 40;
    if (qNorm.includes('fatima') && haystack.includes('fatima')) score += 40;
    if ((qNorm.includes('colorear') || qNorm.includes('ninos') || qNorm.includes('niños')) && normalizeText(item.audiencia).includes('nino')) score += 20;
    return { ...item, _score: score };
  }).filter(item => item._score > 0);

  return scored.sort((a, b) => b._score - a._score).slice(0, limit);
}

module.exports = {
  DATA_FILE,
  ensureStore,
  slugify,
  normalizeText,
  loadCatalog,
  saveCatalog,
  refreshFromCloud,
  getRecursos,
  getBySlug,
  upsertResource,
  upsertResourceAsync,
  deleteBySlug,
  searchRelated
};

setTimeout(syncFromCloudOnce, 500);
