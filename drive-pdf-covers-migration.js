// Conservative one-time replacement of broken PDF covers with verified Drive banners.
const fs = require('fs');
const path = require('path');

const COVER_MAPPINGS = {
  'san-juan-pablo-ii-vida-y-obra': {
    from: 'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1783494185/0BAEBE0E-3E72-46CB-BEE9-EA69284F6B5D_kc3z5x.png',
    to: 'https://drive.google.com/thumbnail?id=1RHgkPurqT846oDR-ZBZLF_XgNcbAfgfV&sz=w2400'
  },
  'historia-de-la-iglesia-libro-digital': {
    from: 'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1782674706/FD037597-CF99-4F38-8633-84E808348D64_kayeh4.png',
    to: 'https://drive.google.com/thumbnail?id=11IwyRERiLUV8mi5klpxlKmLAGP54mCcg&sz=w2400'
  },
  'parabola-hijo-prodigo-ninos': {
    from: 'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1783027187/25BACCE6-05B2-4279-8C15-E642F5FFAFE8_hmhffj.png',
    to: 'https://drive.google.com/thumbnail?id=1vMRmZuiPx2FabgCPppF-ZiQzrf86kYsd&sz=w2400'
  },
  'la-historia-de-la-iglesia-timeline-visual': {
    from: 'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1782674706/FD037597-CF99-4F38-8633-84E808348D64_kayeh4.png',
    to: 'https://drive.google.com/thumbnail?id=1Va53M2SivAej7YHSPOX3cByUkxPPNRmO&sz=w2400'
  },
  'historia-de-los-papas-1-10': {
    from: 'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1783689560/papas_xl2o8p.png',
    to: 'https://drive.google.com/thumbnail?id=1V349EXo0-YzSR2wOYhEmrjd09b8YPTS_&sz=w2400'
  },
  'parabola-del-sembrador-para-ninos': {
    from: 'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1783027187/25BACCE6-05B2-4279-8C15-E642F5FFAFE8_hmhffj.png',
    to: 'https://drive.google.com/thumbnail?id=1pXii9LyIEyLMEfRCw8562cueURR4Ij2a&sz=w2400'
  },
  'eucaristia-para-ninos-primera-comunion': {
    from: 'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1786361631/banner-eucaristia-ninos_xxsish.png',
    to: 'https://drive.google.com/thumbnail?id=1_A0raG_CqdIJ4ZTzGusPCsKBUNk0PdNQ&sz=w2400'
  }
};

function ensureBundledPdfCatalog() {
  try { require('./bootstrap-content-restore').restoreBundledCatalogs(); }
  catch (error) { console.warn('[PDF Covers] Bundled catalog restore skipped:', error.message); }
}

function migrateCatalog(catalog) {
  const recursos = Array.isArray(catalog && catalog.recursos) ? catalog.recursos : [];
  const changes = [];
  const migrated = recursos.map(item => {
    const mapping = COVER_MAPPINGS[item && item.slug];
    if (!mapping || item.coverUrl !== mapping.from) return item;
    const updated = { ...item, coverUrl: mapping.to, actualizadoEn: new Date().toISOString() };
    changes.push(updated);
    return updated;
  });
  return { catalog: { ...catalog, recursos: migrated, updatedAt: new Date().toISOString() }, changes };
}

function restoreLocalPdfCoverUrls() {
  ensureBundledPdfCatalog();
  const dataPath = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'recursos-pdf.json');
  const catalog = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const result = migrateCatalog(catalog);
  if (result.changes.length) fs.writeFileSync(dataPath, JSON.stringify(result.catalog, null, 2), 'utf8');
  console.log(`[PDF Covers] Catálogo local: ${result.changes.length} portadas actualizadas.`);
  return result;
}

async function persistPdfCoverUrls() {
  const recursosPdf = require('./recursos-pdf-module');
  await recursosPdf.refreshFromCloud({ force: true });
  const current = recursosPdf.loadCatalog();
  const result = migrateCatalog(current);
  let saved = 0;
  let failed = 0;
  for (const resource of result.changes) {
    try {
      await recursosPdf.upsertResourceAsync(resource);
      saved++;
    } catch (error) {
      failed++;
      console.warn('[PDF Covers] No se pudo guardar en Firestore:', error.message);
    }
  }
  console.log(`[PDF Covers] Firestore: ${saved} portadas guardadas, ${failed} pendientes.`);
  return { saved, failed };
}

module.exports = { COVER_MAPPINGS, migrateCatalog, restoreLocalPdfCoverUrls, persistPdfCoverUrls };
