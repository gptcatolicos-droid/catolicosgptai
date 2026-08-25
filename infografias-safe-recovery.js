// Safe, additive Infografias recovery from the verified admin backup of 2026-08-18.
// Baseline is only used when it adds missing records. Existing/current records always win.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'infografias-catalog.json');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return fallback; }
}

function itemKey(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.id || item.slug || item.titulo || item.title || item.nombre || '').trim().toLowerCase();
}

function loadBaseline() {
  const parts = [];
  // Discover every consecutive recovery part that actually exists. This avoids
  // relying on commit-message numbering and prevents truncated gzip streams.
  for (let i = 0; i < 100; i++) {
    const partPath = path.join(__dirname, 'recovery', `infografias-baseline.part${i}`);
    if (!fs.existsSync(partPath)) break;
    parts.push(fs.readFileSync(partPath, 'utf8').trim());
  }
  if (!parts.length) throw new Error('No infographic recovery baseline parts found.');
  const compressed = Buffer.from(parts.join(''), 'base64');
  const baseline = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
  console.log(`[Infografias Recovery] Baseline loaded from ${parts.length} parts.`);
  return baseline;
}

function restoreInfografiasSafely() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  const baseline = loadBaseline();
  const current = readJson(CATALOG_PATH, { version: '5.0', categorias: [], infografias: [] });
  const baseItems = Array.isArray(baseline.infografias) ? baseline.infografias : [];
  const currentItems = Array.isArray(current.infografias) ? current.infografias : [];

  const merged = new Map();
  for (const item of baseItems) {
    const key = itemKey(item);
    if (key) merged.set(key, item);
  }
  // Current data is applied second so no newer/admin-edited record is overwritten.
  for (const item of currentItems) {
    const key = itemKey(item);
    if (key) merged.set(key, item);
  }

  const items = [...merged.values()];
  if (items.length <= currentItems.length) {
    console.log(`[Infografias Recovery] Catalog preserved (${currentItems.length} records).`);
    return { restored: false, total: currentItems.length };
  }

  const categorias = [...new Set([
    ...(Array.isArray(baseline.categorias) ? baseline.categorias : []),
    ...(Array.isArray(current.categorias) ? current.categorias : []),
    ...items.map(i => i.categoria || i.tipo).filter(Boolean)
  ])];

  const output = {
    ...baseline,
    ...current,
    version: current.version || baseline.version || '5.0',
    total: items.length,
    categorias,
    infografias: items
  };
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[Infografias Recovery] Restored additive baseline: ${currentItems.length} -> ${items.length} records.`);
  return { restored: true, total: items.length };
}

module.exports = { restoreInfografiasSafely, loadBaseline };