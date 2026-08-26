const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

const VERIFIED_MINIMUMS = Object.freeze({
  infografias: 51, feCatolica: 2384, catequesis: 677, recursosPdf: 7,
  videos: 12, podcasts: 4, santoral: 425
});

function sectionData(payload, name) {
  const section = payload && payload.sections && payload.sections[name];
  return section && section.data && typeof section.data === 'object' ? section.data : (section || {});
}

function listFrom(payload, section, key) {
  const value = sectionData(payload, section)[key];
  return Array.isArray(value) ? value : [];
}

function itemKey(item = {}) {
  const value = item.id || item.slug || item.url || item.driveFileId || item.public_id ||
    item.titulo || item.title || item.nombre || item.name;
  return String(value || '').trim().toLocaleLowerCase('es-CO');
}

function mergeItems(backupItems, currentItems) {
  const merged = new Map();
  const append = (item, origin) => {
    const key = itemKey(item);
    // Never discard an unkeyed legacy item.
    merged.set(key || `${origin}:${JSON.stringify(item)}`, item);
  };
  for (const item of Array.isArray(backupItems) ? backupItems : []) append(item, 'backup');
  // Current data wins on conflict: restoration never rolls a record back.
  for (const item of Array.isArray(currentItems) ? currentItems : []) append(item, 'current');
  return [...merged.values()];
}

function readJson(filename) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8')); }
  catch (_) { return {}; }
}

function atomicWrite(filename, value) {
  const target = path.join(DATA_DIR, filename);
  const temp = `${target}.restore-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, target);
}

function backupCounts(payload) {
  return {
    infografias: listFrom(payload, 'infografias', 'infografias').length,
    feCatolica: listFrom(payload, 'feCatolica', 'posts').length,
    catequesis: listFrom(payload, 'catequesis', 'posts').length,
    recursosPdf: listFrom(payload, 'recursosPdf', 'recursos').length,
    videos: listFrom(payload, 'videos', 'videos').length,
    podcasts: listFrom(payload, 'podcasts', 'podcasts').length,
    santoral: listFrom(payload, 'santoral', 'santos').length
  };
}

function validateBackup(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('El archivo no contiene un JSON válido.');
  const counts = backupCounts(payload);
  const missing = Object.entries(VERIFIED_MINIMUMS)
    .filter(([name, minimum]) => counts[name] < minimum)
    .map(([name, minimum]) => `${name}: ${counts[name]}/${minimum}`);
  if (missing.length) {
    throw new Error(`Backup rechazado: no coincide con el respaldo verificado del 18 de agosto (${missing.join(', ')}).`);
  }
  return counts;
}

function mergeCatalog(filename, listKey, backupCatalog, backupItems, decorate) {
  const current = readJson(filename);
  const merged = mergeItems(backupItems, current[listKey]);
  let result = { ...backupCatalog, ...current, [listKey]: merged };
  if (typeof decorate === 'function') result = decorate(result, merged);
  atomicWrite(filename, result);
  return merged.length;
}

function restoreBackup(payload) {
  const validated = validateBackup(payload);
  const inf = sectionData(payload, 'infografias');
  const fe = sectionData(payload, 'feCatolica');
  const catequesis = sectionData(payload, 'catequesis');
  const pdf = sectionData(payload, 'recursosPdf');
  const videos = sectionData(payload, 'videos');
  const podcasts = sectionData(payload, 'podcasts');
  const santos = sectionData(payload, 'santoral');
  const counts = {};

  counts.infografias = mergeCatalog('infografias-catalog.json', 'infografias', inf, inf.infografias, (catalog, items) => ({
    ...catalog, total: items.length, categorias: [...new Set(items.map(i => i.categoria || i.tipo).filter(Boolean))]
  }));
  // Catequesis has an independent backup section but shares the blog catalog.
  counts.feCatolica = mergeCatalog('blog-catalog.json', 'posts', fe,
    mergeItems(fe.posts, catequesis.posts), (catalog, items) => ({ ...catalog, total: items.length }));
  counts.recursosPdf = mergeCatalog('recursos-pdf.json', 'recursos', pdf, pdf.recursos,
    catalog => ({ ...catalog, updatedAt: new Date().toISOString() }));
  counts.videos = mergeCatalog('videos-catalog.json', 'videos', videos, videos.videos,
    (catalog, items) => ({ ...catalog, total: items.length }));
  counts.podcasts = mergeCatalog('podcast-catalog.json', 'podcasts', podcasts, podcasts.podcasts,
    (catalog, items) => ({ ...catalog, total: items.length }));
  counts.santoral = mergeCatalog('santoral-db.json', 'santos', santos, santos.santos);

  atomicWrite('last-restored-backup.json', payload);
  console.log('[Full Backup Restore] COMPLETADO', JSON.stringify({ validated, counts }));
  return { ok: true, validated, counts };
}

module.exports = { VERIFIED_MINIMUMS, backupCounts, validateBackup, mergeItems, restoreBackup };
