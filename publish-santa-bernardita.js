// Publicación aditiva: Santa Bernardita Soubirous — 2026-09-15
// Inserta el carrusel en el catálogo persistente sin sobrescribir registros existentes.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'infografias-catalog.json');

const bernardita = {
  id: 'inf-santa-bernardita-soubirous-20260915',
  slug: 'santa-bernardita-soubirous',
  tema: 'Santa Bernardita Soubirous',
  titulo: 'Santa Bernardita Soubirous — Vida, apariciones de Lourdes y legado espiritual',
  tipo: 'santo',
  categoria: 'santo',
  formato: '9:12',
  estilo: 'cinematic',
  totalSlides: 10,
  metaDescription: 'Carrusel sobre la vida de Santa Bernardita Soubirous: infancia en Lourdes, apariciones de 1858, vida religiosa en Nevers, muerte, canonización y legado espiritual.',
  altText: 'Carrusel CatolicosGPT sobre la vida de Santa Bernardita Soubirous y las apariciones de Nuestra Señora de Lourdes',
  keywords: 'Santa Bernardita Soubirous, Bernadette Soubirous, Lourdes, Nuestra Señora de Lourdes, Massabielle, Inmaculada Concepción, Nevers, santa católica, apariciones marianas, CatolicosGPT',
  imagenes: [
    { url: 'https://drive.google.com/thumbnail?id=1yq_mzXcSSbMHZHDfo30L4k_kjoqeBeI7&sz=w2400', slide: 1, model: 'GPT Image', formato: '9:12', driveId: '1yq_mzXcSSbMHZHDfo30L4k_kjoqeBeI7' },
    { url: 'https://drive.google.com/thumbnail?id=1NgUqJVlGn36kCpyv-pvExqC0Ceug8MXo&sz=w2400', slide: 2, model: 'GPT Image', formato: '9:12', driveId: '1NgUqJVlGn36kCpyv-pvExqC0Ceug8MXo' },
    { url: 'https://drive.google.com/thumbnail?id=14vJSXyM2nYtLSmp_xW2ndk0WyzyCo0Vn&sz=w2400', slide: 3, model: 'GPT Image', formato: '9:12', driveId: '14vJSXyM2nYtLSmp_xW2ndk0WyzyCo0Vn' },
    { url: 'https://drive.google.com/thumbnail?id=1SvQ8oTylRSXTuDh5ObsCIAsq-Mf5kr3N&sz=w2400', slide: 4, model: 'GPT Image', formato: '9:12', driveId: '1SvQ8oTylRSXTuDh5ObsCIAsq-Mf5kr3N' },
    { url: 'https://drive.google.com/thumbnail?id=1n4lJ-4yRQ7CLAhhM8SQicIyVupk9Qo85&sz=w2400', slide: 5, model: 'GPT Image', formato: '9:12', driveId: '1n4lJ-4yRQ7CLAhhM8SQicIyVupk9Qo85' },
    { url: 'https://drive.google.com/thumbnail?id=1tbtFsjp0MQMUstK93J83R2IAe9EHRRLI&sz=w2400', slide: 6, model: 'GPT Image', formato: '9:12', driveId: '1tbtFsjp0MQMUstK93J83R2IAe9EHRRLI' },
    { url: 'https://drive.google.com/thumbnail?id=1_GTC9ldvl0i7Qi0vGGv67P4kMWGNboHi&sz=w2400', slide: 7, model: 'GPT Image', formato: '9:12', driveId: '1_GTC9ldvl0i7Qi0vGGv67P4kMWGNboHi' },
    { url: 'https://drive.google.com/thumbnail?id=17GCbx8ZYAZ_s3_zeLDwwfez_BX0htHbD&sz=w2400', slide: 8, model: 'GPT Image', formato: '9:12', driveId: '17GCbx8ZYAZ_s3_zeLDwwfez_BX0htHbD' },
    { url: 'https://drive.google.com/thumbnail?id=1klPYe7GTj6Onw-RMtorIIxEtvJ1ady8o&sz=w2400', slide: 9, model: 'GPT Image', formato: '9:12', driveId: '1klPYe7GTj6Onw-RMtorIIxEtvJ1ady8o' },
    { url: 'https://drive.google.com/thumbnail?id=1ed5FRQZoeHUaOMpx1-qhWRj6EA1bQnXM&sz=w2400', slide: 10, model: 'GPT Image', formato: '9:12', driveId: '1ed5FRQZoeHUaOMpx1-qhWRj6EA1bQnXM' }
  ],
  driveFolderId: '1NaYlDAqxeYD3bte-Jbbym9QfPFBrksAp',
  driveZipId: '1te_tYfoMQ-2epOahcSyyW58NsaRMmk0n',
  fechaCreacion: '2026-09-15T22:48:00Z',
  fechaISO: '2026-09-15',
  publicado: true
};

function publishSantaBernardita() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  let catalog = { version: '5.1', total: 0, categorias: [], infografias: [] };
  try {
    const current = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    if (current && Array.isArray(current.infografias)) catalog = current;
  } catch (_) {}

  catalog.infografias = Array.isArray(catalog.infografias) ? catalog.infografias : [];
  const index = catalog.infografias.findIndex(item => item && (item.id === bernardita.id || item.slug === bernardita.slug));
  if (index >= 0) {
    catalog.infografias[index] = { ...catalog.infografias[index], ...bernardita };
  } else {
    catalog.infografias.unshift(bernardita);
  }

  catalog.infografias.sort((a, b) => String(b.fechaISO || b.fechaCreacion || '').localeCompare(String(a.fechaISO || a.fechaCreacion || '')));
  catalog.total = catalog.infografias.length;
  catalog.categorias = [...new Set([...(Array.isArray(catalog.categorias) ? catalog.categorias : []), ...catalog.infografias.map(i => i.categoria || i.tipo).filter(Boolean)])];
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`[Bernardita] Publicada en catálogo. Total: ${catalog.total}`);
  return { published: true, total: catalog.total };
}

module.exports = { publishSantaBernardita, bernardita };
