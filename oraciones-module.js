const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOG_FILE = path.join(DATA_DIR, 'oraciones-catalog.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function emptyCatalog() {
  return { oraciones: [], updatedAt: null };
}

function loadCatalog() {
  ensureDataDir();
  if (!fs.existsSync(CATALOG_FILE)) return emptyCatalog();
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    return {
      ...emptyCatalog(),
      ...parsed,
      oraciones: Array.isArray(parsed.oraciones) ? parsed.oraciones : []
    };
  } catch (err) {
    console.error('[Oraciones] No se pudo leer el catálogo:', err.message);
    return emptyCatalog();
  }
}

function saveCatalog(catalog) {
  ensureDataDir();
  const next = {
    ...emptyCatalog(),
    ...catalog,
    oraciones: Array.isArray(catalog.oraciones) ? catalog.oraciones : [],
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(next, null, 2));
  return next;
}

function generateSlug(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `oracion-${Date.now()}`;
}

function normalizeImages(images = []) {
  return (Array.isArray(images) ? images : [])
    .filter(img => img && String(img.url || '').trim())
    .map((img, index) => ({
      url: String(img.url || '').trim(),
      alt: String(img.alt || '').trim(),
      name: String(img.name || '').trim(),
      width: Number(img.width) || 1200,
      height: Number(img.height) || 1200,
      slide: index + 1,
      esPortada: img.esPortada === true || index === 0
    }));
}

function uniqueSlug(baseSlug, originalSlug = '') {
  const catalog = loadCatalog();
  const wanted = generateSlug(baseSlug);
  if (originalSlug && wanted === originalSlug) return wanted;
  const exists = catalog.oraciones.some(item => item.slug === wanted && item.slug !== originalSlug);
  return exists ? `${wanted}-${Date.now().toString().slice(-5)}` : wanted;
}

function upsertOracion(payload = {}) {
  const catalog = loadCatalog();
  const originalSlug = String(payload.originalSlug || '').trim();
  const now = new Date().toISOString();
  const titulo = String(payload.titulo || '').trim();
  const slug = uniqueSlug(payload.slug || titulo, originalSlug);
  const images = normalizeImages(payload.imagenes);
  const cover = images.find(img => img.esPortada) || images[0] || null;
  const record = {
    id: payload.id || `oracion-${Date.now()}`,
    slug,
    titulo,
    tipo: String(payload.tipo || 'oracion').trim(),
    categoria: String(payload.categoria || 'devocional').trim(),
    descripcion: String(payload.descripcion || '').trim(),
    seoTitle: String(payload.seoTitle || titulo).trim(),
    metaDescription: String(payload.metaDescription || payload.descripcion || '').trim(),
    keywords: String(payload.keywords || '').trim(),
    imagenes: images,
    coverUrl: payload.coverUrl || (cover ? cover.url : ''),
    tipoVisualizacion: payload.tipoVisualizacion || (images.length > 1 ? 'carrusel' : 'continua'),
    publicado: payload.publicado !== false,
    createdAt: payload.createdAt || now,
    updatedAt: now
  };

  const index = catalog.oraciones.findIndex(item => item.slug === originalSlug || item.id === payload.id);
  if (index >= 0) {
    catalog.oraciones[index] = { ...catalog.oraciones[index], ...record, createdAt: catalog.oraciones[index].createdAt || record.createdAt };
  } else {
    catalog.oraciones.unshift(record);
  }
  return saveCatalog(catalog);
}

function deleteOracion(slug) {
  const catalog = loadCatalog();
  const before = catalog.oraciones.length;
  catalog.oraciones = catalog.oraciones.filter(item => item.slug !== slug && item.id !== slug);
  if (catalog.oraciones.length !== before) saveCatalog(catalog);
  return catalog.oraciones.length !== before;
}

function getOracionBySlug(slug) {
  return loadCatalog().oraciones.find(item => item.slug === slug) || null;
}

function getOraciones({ q = '', categoria = 'all', page = 1, limit = 12, publishedOnly = true } = {}) {
  const query = String(q || '').trim().toLowerCase();
  let items = loadCatalog().oraciones || [];
  if (publishedOnly) items = items.filter(item => item.publicado !== false);
  if (categoria && categoria !== 'all') {
    items = items.filter(item => item.categoria === categoria || item.tipo === categoria);
  }
  if (query) {
    items = items.filter(item => [
      item.titulo,
      item.descripcion,
      item.metaDescription,
      item.keywords,
      item.categoria,
      item.tipo
    ].join(' ').toLowerCase().includes(query));
  }
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.max(1, Math.min(Number(page) || 1, totalPages));
  const start = (safePage - 1) * limit;
  return { items: items.slice(start, start + limit), total, totalPages, page: safePage };
}

module.exports = {
  loadCatalog,
  saveCatalog,
  generateSlug,
  upsertOracion,
  deleteOracion,
  getOracionBySlug,
  getOraciones
};
