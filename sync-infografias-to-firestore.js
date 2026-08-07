const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
    const primary = path.join(DATA_DIR, 'infografias-catalog.json');
    const fallback = path.join(__dirname, 'data', 'infografias-catalog.json');
    const source = fs.existsSync(primary) ? primary : fallback;
    const catalog = JSON.parse(fs.readFileSync(source, 'utf8'));
    const items = Array.isArray(catalog.infografias) ? catalog.infografias : [];

    if (!items.length) {
      console.warn('[Restore Sync] Catálogo vacío; no hay nada que subir a Firestore.');
      return;
    }

    const firebase = require('./firebase-module');
    try { await firebase.authenticateServer(); } catch (_) {}

    let ok = 0;
    let failed = 0;
    for (let i = 0; i < items.length; i += 6) {
      const batch = items.slice(i, i + 6);
      const results = await Promise.allSettled(batch.map(item => firebase.syncUploadInfografia(item)));
      results.forEach(result => result.status === 'fulfilled' ? ok++ : failed++);
    }
    console.log(`[Restore Sync] Firestore: ${ok} infografías sincronizadas, ${failed} fallidas.`);
  } catch (err) {
    console.warn('[Restore Sync] No se pudo completar la persistencia en Firestore:', err.message);
  }
})();
