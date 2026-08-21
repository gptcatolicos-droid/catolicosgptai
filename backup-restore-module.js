const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

function keyFor(item = {}) {
  return String(item.id || item.slug || item.url || item.titulo || item.title || item.fecha || item.nombre || '').trim().toLowerCase();
}

function mergeItems(backupItems = [], currentItems = []) {
  const map = new Map();
  for (const item of Array.isArray(backupItems) ? backupItems : []) {
    const key = keyFor(item);
    if (key) map.set(key, item);
  }
  // El contenido actual gana en caso de conflicto: la restauración nunca pisa una versión más nueva.
  for (const item of Array.isArray(currentItems) ? currentItems : []) {
    const key = keyFor(item);
    if (key) map.set(key, item);
  }
  return [...map.values()];
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return {}; }
}

function atomicWrite(filename, value) {
  const target = path.join(DATA_DIR, filename);
  const temp = `${target}.restore-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, target);
}

function sectionData(payload, name) {
  const section = payload && payload.sections && payload.sections[name];
  if (!section) return {};
  return section.data && typeof section.data === 'object' ? section.data : section;
}

function validateBackup(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('El archivo no contiene un JSON válido.');
  const inf = sectionData(payload, 'infografias');
  const fe = sectionData(payload, 'feCatolica');
  const pdf = sectionData(payload, 'recursosPdf');
  const santos = sectionData(payload, 'santoral');
  const checks = {
    infografias: Array.isArray(inf.infografias) ? inf.infografias.length : 0,
    feCatolica: Array.isArray(fe.posts) ? fe.posts.length : 0,
    recursosPdf: Array.isArray(pdf.recursos) ? pdf.recursos.length : 0,
    santoral: Array.isArray(santos.santos) ? santos.santos.length : 0
  };
  if (checks.infografias < 40) throw new Error(`Backup rechazado: solo contiene ${checks.infografias} infografías.`);
  if (checks.feCatolica < 2000) throw new Error(`Backup rechazado: solo contiene ${checks.feCatolica} contenidos de Fe Católica.`);
  if (checks.recursosPdf < 5) throw new Error(`Backup rechazado: solo contiene ${checks.recursosPdf} PDFs.`);
  if (checks.santoral < 300) throw new Error(`Backup rechazado: solo contiene ${checks.santoral} santos.`);
  return checks;
}

function mergeCatalog(filename, listKey, backupCatalog, decorate) {
  const current = readJson(path.join(DATA_DIR, filename));
  const backupItems = Array.isArray(backupCatalog[listKey]) ? backupCatalog[listKey] : [];
  const currentItems = Array.isArray(current[listKey]) ? current[listKey] : [];
  const merged = mergeItems(backupItems, currentItems);
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

  // Catequesis es un subconjunto editorial de Fe Católica. Se añade por clave por si hubiera registros ausentes.
  const feWithCatechesis = {
    ...fe,
    posts: mergeItems(Array.isArray(fe.posts) ? fe.posts : [], Array.isArray(catequesis.posts) ? catequesis.posts : [])
  };

  const counts = {};
  counts.infografias = mergeCatalog('infografias-catalog.json', 'infografias', inf, (c, items) => ({
    ...c,
    total: items.length,
    categorias: [...new Set(items.map(i => i.categoria || i.tipo).filter(Boolean))]
  }));
  counts.feCatolica = mergeCatalog('blog-catalog.json', 'posts', feWithCatechesis, (c, items) => ({ ...c, total: items.length }));
  counts.recursosPdf = mergeCatalog('recursos-pdf.json', 'recursos', pdf, c => ({ ...c, updatedAt: new Date().toISOString() }));
  counts.santoral = mergeCatalog('santoral-db.json', 'santos', santos);
  counts.videos = mergeCatalog('videos-catalog.json', 'videos', videos, (c, items) => ({ ...c, total: items.length }));
  counts.podcasts = mergeCatalog('podcast-catalog.json', 'podcasts', podcasts, (c, items) => ({ ...c, total: items.length }));

  // Guardamos una copia del backup que produjo la recuperación para diagnóstico/rollback dentro del runtime.
  try { atomicWrite('last-restored-backup.json', payload); } catch (_) {}

  console.log('[Full Backup Restore] COMPLETADO', JSON.stringify({ validated, counts }));
  return { ok: true, validated, counts };
}

module.exports = { validateBackup, restoreBackup };
