const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'recursos-pdf.json');

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

function getRecursos(options = {}) {
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
    pdfUrl: String(input.pdfUrl || input.url || previous.pdfUrl || '').trim(),
    cloudinaryPublicId: String(input.cloudinaryPublicId || previous.cloudinaryPublicId || '').trim(),
    cloudinaryResourceType: input.cloudinaryResourceType || previous.cloudinaryResourceType || 'raw',
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
  return resource;
}

function deleteBySlug(slug) {
  const catalog = loadCatalog();
  const before = catalog.recursos.length;
  catalog.recursos = catalog.recursos.filter(item => item.slug !== slug);
  saveCatalog(catalog);
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
  getRecursos,
  getBySlug,
  upsertResource,
  deleteBySlug,
  searchRelated
};
