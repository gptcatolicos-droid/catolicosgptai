// CatolicosGPT content-state protection.
// Keeps admin choices stable across deploys and makes infographic ordering deterministic.
// This file patches exported module methods only; it does not alter content bodies or styles.

const infografias = require('./infografias-module');
const santoral = require('./santoral-module');

let firebaseSync = null;
try { firebaseSync = require('./firebase-module'); } catch (_) {}

function timeValue(item) {
  if (!item) return 0;
  for (const key of ['fechaModificacion', 'updatedAt', 'fechaCreacion', 'createdAt', 'fechaISO']) {
    const value = item[key];
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  const idMatch = String(item.id || '').match(/(\d{12,})/);
  return idMatch ? Number(idMatch[1]) : 0;
}

function newestFirst(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const diff = timeValue(b) - timeValue(a);
    if (diff) return diff;
    const ao = Number(a && a.orden) || Number.MAX_SAFE_INTEGER;
    const bo = Number(b && b.orden) || Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
}

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Infografías ─────────────────────────────────────────────────────────────
const originalInfLoadCatalog = infografias.loadCatalog.bind(infografias);
const originalInfSaveCatalog = infografias.saveCatalog.bind(infografias);

function readInfCatalogSorted() {
  const catalog = originalInfLoadCatalog() || { infografias: [] };
  catalog.infografias = newestFirst(catalog.infografias);
  catalog.total = catalog.infografias.length;
  return catalog;
}

infografias.loadCatalog = readInfCatalogSorted;

infografias.getInfografias = function protectedGetInfografias({ categoria, q, page = 1, limit = 20 } = {}) {
  const catalog = readInfCatalogSorted();
  let items = catalog.infografias.filter(i => i && i.publicado !== false);
  if (categoria && categoria !== 'all') {
    items = items.filter(i => i.tipo === categoria || i.categoria === categoria);
  }
  if (q) {
    const needle = normalizeText(q);
    items = items.filter(i => normalizeText([
      i.titulo, i.tema, i.descripcion, i.metaDescription, i.keywords, i.categoria
    ].filter(Boolean).join(' ')).includes(needle));
  }
  const total = items.length;
  return {
    items: items.slice((page - 1) * limit, page * limit),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
};

infografias.getInfografiaDelDia = function protectedGetInfografiaDelDia() {
  const catalog = readInfCatalogSorted();
  const items = catalog.infografias || [];
  if (catalog.infografiaDelDiaSlug) {
    const saved = items.find(i => i.slug === catalog.infografiaDelDiaSlug && i.publicado !== false);
    if (saved) return saved;
  }
  const flagged = newestFirst(items.filter(i => i.esInfografiaDelDia === true && i.publicado !== false));
  if (flagged.length) return flagged[0];
  return items.find(i => i.publicado !== false) || null;
};

infografias.setInfografiaDelDia = function protectedSetInfografiaDelDia(slug) {
  const catalog = originalInfLoadCatalog() || { infografias: [] };
  catalog.infografias = Array.isArray(catalog.infografias) ? catalog.infografias : [];
  const changed = [];
  let target = null;

  catalog.infografias = catalog.infografias.map(item => {
    const shouldFeature = item.slug === slug;
    if (shouldFeature) target = { ...item, esInfografiaDelDia: true, fechaModificacion: new Date().toISOString() };
    const next = shouldFeature ? target : { ...item, esInfografiaDelDia: false };
    if (Boolean(item.esInfografiaDelDia) !== Boolean(next.esInfografiaDelDia) || shouldFeature) changed.push(next);
    return next;
  });

  if (!target) return false;
  catalog.infografiaDelDiaSlug = slug;
  catalog.infografias = newestFirst(catalog.infografias);
  originalInfSaveCatalog(catalog);

  if (firebaseSync && typeof firebaseSync.syncUploadInfografia === 'function') {
    for (const item of changed) {
      Promise.resolve(firebaseSync.syncUploadInfografia(item)).catch(err =>
        console.warn('[Content State] Infografia sync skipped:', err.message)
      );
    }
  }
  return true;
};

// One-time normalization after a new revision starts. If legacy Firebase data contains
// more than one featured item, prefer the most recently edited/published one.
try {
  const catalog = originalInfLoadCatalog();
  if (catalog && Array.isArray(catalog.infografias) && !catalog.infografiaDelDiaSlug) {
    const flagged = newestFirst(catalog.infografias.filter(i => i.esInfografiaDelDia === true));
    if (flagged.length) {
      catalog.infografiaDelDiaSlug = flagged[0].slug;
      catalog.infografias = catalog.infografias.map(i => ({
        ...i,
        esInfografiaDelDia: i.slug === flagged[0].slug
      }));
      catalog.infografias = newestFirst(catalog.infografias);
      originalInfSaveCatalog(catalog);
    }
  }
} catch (err) {
  console.warn('[Content State] Infografia normalization skipped:', err.message);
}

// ── Santoral ────────────────────────────────────────────────────────────────
const originalSaintLoad = santoral.loadSantoral.bind(santoral);
const originalSaintSave = santoral.saveSantoral.bind(santoral);

function saintDayKey(itemOrDay, monthMaybe) {
  if (typeof itemOrDay === 'object' && itemOrDay) {
    return `${String(itemOrDay.mes_index || '').padStart(2, '0')}-${String(parseInt(itemOrDay.dia) || 0).padStart(2, '0')}`;
  }
  return `${String(monthMaybe || '').padStart(2, '0')}-${String(parseInt(itemOrDay) || 0).padStart(2, '0')}`;
}

function sameSaintDay(a, b) {
  return saintDayKey(a) === saintDayKey(b);
}

santoral.getFeaturedSaintForDay = function protectedGetFeaturedSaintForDay(dia, mesIndex) {
  const db = originalSaintLoad() || { santos: [] };
  const sameDay = (db.santos || []).filter(s => saintDayKey(s) === saintDayKey(dia, mesIndex));
  if (!sameDay.length) return null;

  const key = saintDayKey(dia, mesIndex);
  const savedSlug = db.featuredSaintByDate && db.featuredSaintByDate[key];
  if (savedSlug) {
    const saved = sameDay.find(s => s.slug === savedSlug);
    if (saved) return saved;
  }

  const flagged = newestFirst(sameDay.filter(s => s.esSantoDelDia === true));
  if (flagged.length) return flagged[0];

  // If an old deploy removed the boolean flag, the most recently edited same-day record
  // is a safer fallback than array order (which may come from a generated supplement).
  return newestFirst(sameDay)[0] || null;
};

santoral.setFeaturedSaint = function protectedSetFeaturedSaint(slug) {
  const db = originalSaintLoad() || { santos: [] };
  db.santos = Array.isArray(db.santos) ? db.santos : [];
  const idx = db.santos.findIndex(s => s.slug === slug);
  if (idx === -1) return null;

  const originalTarget = db.santos[idx];
  const now = new Date().toISOString();
  const changed = [];
  db.santos = db.santos.map(item => {
    if (!sameSaintDay(item, originalTarget)) return item;
    const shouldFeature = item.slug === slug;
    const next = { ...item, esSantoDelDia: shouldFeature };
    if (shouldFeature) next.fechaModificacion = now;
    if (Boolean(item.esSantoDelDia) !== shouldFeature || shouldFeature) changed.push(next);
    return next;
  });

  db.featuredSaintByDate = { ...(db.featuredSaintByDate || {}) };
  db.featuredSaintByDate[saintDayKey(originalTarget)] = slug;
  originalSaintSave(db);

  if (firebaseSync && typeof firebaseSync.syncUploadSanto === 'function') {
    for (const item of changed) {
      Promise.resolve(firebaseSync.syncUploadSanto(item)).catch(err =>
        console.warn('[Content State] Santoral sync skipped:', err.message)
      );
    }
  }
  return db.santos.find(s => s.slug === slug) || null;
};

// Persist the latest existing manual flag into a stable per-date map without choosing a
// different saint. This only records the state already present in the admin data.
try {
  const db = originalSaintLoad();
  if (db && Array.isArray(db.santos)) {
    const map = { ...(db.featuredSaintByDate || {}) };
    let changed = false;
    const grouped = new Map();
    for (const saint of db.santos.filter(s => s.esSantoDelDia === true)) {
      const key = saintDayKey(saint);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(saint);
    }
    for (const [key, saints] of grouped.entries()) {
      const chosen = newestFirst(saints)[0];
      if (chosen && map[key] !== chosen.slug) {
        map[key] = chosen.slug;
        changed = true;
      }
    }
    if (changed) {
      db.featuredSaintByDate = map;
      originalSaintSave(db);
    }
  }
} catch (err) {
  console.warn('[Content State] Santoral normalization skipped:', err.message);
}

module.exports = { installed: true };
