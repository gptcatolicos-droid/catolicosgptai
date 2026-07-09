const fs = require('fs');
const path = require('path');
const firebaseSync = require('./firebase-module');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'oraciones-catalog.json');

let lastCloudRefresh = 0;
const CLOUD_REFRESH_MS = 60 * 1000;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90) || `oracion-${Date.now()}`;
}

function emptyCatalog() {
  return { oraciones: [], total: 0, updatedAt: new Date().toISOString() };
}

function loadCatalog() {
  try {
    ensureDir();
    if (!fs.existsSync(DATA_FILE)) {
      const initial = emptyCatalog();
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    parsed.oraciones = Array.isArray(parsed.oraciones) ? parsed.oraciones : [];
    parsed.total = parsed.oraciones.length;
    return parsed;
  } catch (error) {
    console.error('[Oraciones] Error leyendo catálogo local:', error.message);
    return emptyCatalog();
  }
}

function saveCatalog(catalog, itemToSync) {
  ensureDir();
  const safeCatalog = catalog || emptyCatalog();
  safeCatalog.oraciones = Array.isArray(safeCatalog.oraciones) ? safeCatalog.oraciones : [];
  safeCatalog.total = safeCatalog.oraciones.length;
  safeCatalog.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(safeCatalog, null, 2));
  if (itemToSync) {
    firebaseSync.syncUploadOracion(itemToSync).catch(err => {
      console.warn('[Oraciones] No se pudo sincronizar en Firestore:', err.message);
    });
  }
  return safeCatalog;
}

async function refreshFromCloud({ force = false } = {}) {
  const local = loadCatalog();
  if (!force && Date.now() - lastCloudRefresh < CLOUD_REFRESH_MS) return local;
  try {
    const cloudItems = await firebaseSync.syncDownloadOraciones(local.oraciones);
    if (Array.isArray(cloudItems) && cloudItems.length > 0) {
      const next = { oraciones: cloudItems, total: cloudItems.length, updatedAt: new Date().toISOString() };
      fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
      lastCloudRefresh = Date.now();
      return next;
    }
  } catch (error) {
    console.warn('[Oraciones] Firestore no disponible. Se usa catálogo local:', error.message);
  }
  lastCloudRefresh = Date.now();
  return local;
}

function getAll() {
  return loadCatalog().oraciones || [];
}

function getOracionBySlug(slug) {
  return getAll().find(item => item.slug === slug && item.publicado !== false) || null;
}

function normalizeImages(inputImages, fallbackUrl = '', fallbackAlt = '', titulo = '') {
  let list = Array.isArray(inputImages) ? inputImages : [];
  if (!list.length && fallbackUrl) {
    list = [{ url: fallbackUrl, alt: fallbackAlt }];
  }

  const cleaned = list
    .map((img, index) => {
      const row = typeof img === 'string' ? { url: img } : (img || {});
      const width = parseInt(row.width, 10) || '';
      const height = parseInt(row.height, 10) || '';
      return {
        url: String(row.url || '').trim(),
        name: String(row.name || '').trim(),
        alt: String(row.alt || fallbackAlt || `${titulo} | CatólicosGPT IA Católica`).trim(),
        width,
        height,
        esPortada: row.esPortada === true || row.esPortada === 'true' || row.cover === '1',
        slide: index + 1,
        formato: width && height ? (height > width ? '9:16' : width > height ? '16:9' : '1:1') : (row.formato || ''),
        sizeLabel: row.sizeLabel || (width && height ? `${width}x${height}` : '')
      };
    })
    .filter(img => img.url);

  if (cleaned.length && !cleaned.some(img => img.esPortada)) {
    cleaned[0].esPortada = true;
  }

  return cleaned.map((img, index) => ({ ...img, slide: index + 1 }));
}

function getOraciones({ categoria = 'all', q = '', page = 1, limit = 12, includeUnpublished = false } = {}) {
  const term = normalizeText(q);
  let items = getAll().filter(item => includeUnpublished || item.publicado !== false);
  if (categoria && categoria !== 'all') {
    items = items.filter(item => String(item.categoria || 'general') === categoria);
  }
  if (term) {
    items = items.filter(item => normalizeText([
      item.titulo,
      item.descripcion,
      item.textoOracion,
      item.keywords,
      item.categoria,
      Array.isArray(item.imagenes) ? item.imagenes.map(img => img.alt || img.name || '').join(' ') : ''
    ].join(' ')).includes(term));
  }
  items.sort((a, b) => {
    const ao = Number.isFinite(Number(a.orden)) ? Number(a.orden) : 999999;
    const bo = Number.isFinite(Number(b.orden)) ? Number(b.orden) : 999999;
    if (ao !== bo) return ao - bo;
    return new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0);
  });
  const safeLimit = Math.max(1, Number(limit) || 12);
  const safePage = Math.max(1, Number(page) || 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;
  return { items: items.slice(start, start + safeLimit), total, totalPages, page: safePage };
}

function upsertOracion(input = {}) {
  const catalog = loadCatalog();
  const now = new Date().toISOString();
  const originalSlug = String(input.originalSlug || '').trim();
  const baseSlug = slugify(input.titulo);
  const existingIndex = originalSlug
    ? catalog.oraciones.findIndex(item => item.slug === originalSlug)
    : catalog.oraciones.findIndex(item => item.id && item.id === input.id);
  const existing = existingIndex >= 0 ? catalog.oraciones[existingIndex] : null;
  let slug = originalSlug || baseSlug;
  if (!existing) {
    let candidate = baseSlug;
    let count = 2;
    while (catalog.oraciones.some(item => item.slug === candidate)) {
      candidate = `${baseSlug}-${count++}`;
    }
    slug = candidate;
  }

  const imagenes = normalizeImages(input.imagenes, input.imagenUrl, input.imagenAlt, input.titulo);
  const portada = imagenes.find(img => img.esPortada) || imagenes[0] || {};
  const descripcion = String(input.descripcion || input.metaDescription || '').trim();

  const item = {
    id: existing?.id || input.id || `ora-${Date.now()}`,
    slug,
    titulo: String(input.titulo || '').trim(),
    categoria: String(input.categoria || 'basicas').trim(),
    descripcion,
    imagenUrl: String(portada.url || input.imagenUrl || '').trim(),
    imagenAlt: String(portada.alt || input.imagenAlt || '').trim(),
    imagenes,
    tipoVisualizacion: String(input.tipoVisualizacion || 'continua').trim(),
    textoOracion: String(input.textoOracion || '').trim(),
    seoTitle: String(input.seoTitle || input.titulo || '').trim(),
    metaDescription: String(input.metaDescription || descripcion || '').trim(),
    keywords: String(input.keywords || '').trim(),
    orden: Number.isFinite(Number(input.orden)) ? Number(input.orden) : (existing?.orden || 999999),
    publicado: input.publicado === true || input.publicado === 'true' || input.publicado === 'on',
    fechaCreacion: existing?.fechaCreacion || now,
    actualizadoEn: now
  };

  if (existingIndex >= 0) catalog.oraciones[existingIndex] = item;
  else catalog.oraciones.unshift(item);
  return saveCatalog(catalog, item);
}

function deleteOracion(slug) {
  const catalog = loadCatalog();
  catalog.oraciones = catalog.oraciones.filter(item => item.slug !== slug && item.id !== slug);
  saveCatalog(catalog);
  firebaseSync.syncDeleteOracion(slug).catch(err => {
    console.warn('[Oraciones] No se pudo borrar en Firestore:', err.message);
  });
  return catalog;
}

module.exports = {
  loadCatalog,
  saveCatalog,
  refreshFromCloud,
  getAll,
  getOraciones,
  getOracionBySlug,
  upsertOracion,
  deleteOracion,
  generateSlug: slugify,
  slugify
};
