// One-time, conservative recovery of published Cloudinary infographics.
// Each mapping is tied to the exact old URL; an admin-edited image is never overwritten.
const fs = require('fs');
const path = require('path');
const mappings = require('./drive-infografias-map.json');

function migrateInfografiasToDrive(items) {
  const changes = [];
  const migrated = (Array.isArray(items) ? items : []).map(item => {
    const entries = mappings[item && item.slug];
    if (!entries || !Array.isArray(item.imagenes)) return item;
    const byOldUrl = new Map(entries.map(entry => [entry.from, entry.to]));
    let count = 0;
    const imagenes = item.imagenes.map(image => {
      if (typeof image === 'string') {
        const to = byOldUrl.get(image);
        if (!to) return image;
        count++;
        return to;
      }
      if (!image || typeof image !== 'object') return image;
      const to = byOldUrl.get(image.url);
      if (!to) return image;
      count++;
      return { ...image, url: to };
    });
    if (!count) return item;
    const updated = { ...item, imagenes };
    changes.push({ item: updated, count });
    return updated;
  });
  return { items: migrated, changes, urlCount: changes.reduce((n, change) => n + change.count, 0) };
}

function restoreLocalDriveUrls() {
  const catalogPath = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'infografias-catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const result = migrateInfografiasToDrive(catalog.infografias);
  if (result.urlCount) {
    const output = { ...catalog, infografias: result.items };
    fs.writeFileSync(catalogPath, JSON.stringify(output, null, 2), 'utf8');
  }
  console.log(`[Drive Recovery] Catálogo local: ${result.changes.length} infografías, ${result.urlCount} URLs actualizadas.`);
  return result;
}

async function persistDriveChanges(db, changes) {
  if (!db || !changes.length) return { saved: 0, failed: changes.length };
  const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');
  let saved = 0;
  let failed = 0;
  // Recheck the cloud document before writing. Never revert a newer admin edit.
  for (const { item } of changes) {
    if (!item.id) { failed++; continue; }
    try {
      const ref = doc(db, 'infografias', String(item.id));
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        const current = snapshot.data() || {};
        const result = migrateInfografiasToDrive([current]);
        if (result.urlCount) await updateDoc(ref, { imagenes: result.items[0].imagenes });
      } else {
        // A record restored only from the bundled catalog needs its full metadata.
        await setDoc(ref, JSON.parse(JSON.stringify(item)), { merge: true });
      }
      saved++;
    } catch (error) {
      failed++;
      console.warn('[Drive Recovery] No se pudo guardar una infografía en Firestore:', error.message);
    }
  }
  console.log(`[Drive Recovery] Firestore: ${saved} infografías guardadas, ${failed} pendientes.`);
  return { saved, failed };
}

module.exports = { migrateInfografiasToDrive, restoreLocalDriveUrls, persistDriveChanges };
