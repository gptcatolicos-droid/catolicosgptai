// Publicación aditiva: Historia de la Iglesia — Siglos I al X — 2026-09-15
// Inserta el carrusel en el catálogo persistente sin sobrescribir registros existentes.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'infografias-catalog.json');

const historiaIglesia = {
  id: 'inf-historia-iglesia-siglos-i-x-20260915',
  slug: 'historia-de-la-iglesia-siglos-i-al-x',
  tema: 'Historia de la Iglesia — Siglos I al X',
  titulo: 'Historia de la Iglesia — Siglos I al X',
  tipo: 'doctrinal',
  categoria: 'doctrinal',
  formato: '9:16',
  estilo: 'cinematic',
  totalSlides: 10,
  metaDescription: 'Carrusel visual sobre la historia de la Iglesia católica desde el siglo I hasta el siglo X: primeros cristianos, mártires, concilios, Padres de la Iglesia, monacato y expansión misionera.',
  altText: 'Carrusel CatolicosGPT sobre la Historia de la Iglesia desde el siglo I hasta el siglo X',
  keywords: 'Historia de la Iglesia, Iglesia Católica, siglos I al X, primeros cristianos, mártires, Concilio de Nicea, Padres de la Iglesia, San Benito, evangelización, CatolicosGPT',
  imagenes: [
    { url: 'https://drive.google.com/thumbnail?id=1vZXoXuWMsMBlegBlC-SPdwWpVvJPVQvV&sz=w2400', slide: 1, model: 'GPT Image', formato: '9:16', driveId: '1vZXoXuWMsMBlegBlC-SPdwWpVvJPVQvV' },
    { url: 'https://drive.google.com/thumbnail?id=1rSNjlTbQjIekuuhQfvMUniBAE77WQRTN&sz=w2400', slide: 2, model: 'GPT Image', formato: '9:16', driveId: '1rSNjlTbQjIekuuhQfvMUniBAE77WQRTN' },
    { url: 'https://drive.google.com/thumbnail?id=15bjCbRefBPmYZEoH5POehlHJROpTU866&sz=w2400', slide: 3, model: 'GPT Image', formato: '9:16', driveId: '15bjCbRefBPmYZEoH5POehlHJROpTU866' },
    { url: 'https://drive.google.com/thumbnail?id=1hYm13OLSNDeLFhrv-AA7IJ4ae2s2wNXh&sz=w2400', slide: 4, model: 'GPT Image', formato: '9:16', driveId: '1hYm13OLSNDeLFhrv-AA7IJ4ae2s2wNXh' },
    { url: 'https://drive.google.com/thumbnail?id=1CzAsyHlvLP6v5-8JCj3HP9FKBuFcoaNR&sz=w2400', slide: 5, model: 'GPT Image', formato: '9:16', driveId: '1CzAsyHlvLP6v5-8JCj3HP9FKBuFcoaNR' },
    { url: 'https://drive.google.com/thumbnail?id=1V6cIU5kj1GDnj-cFkEcJWaGras2JM4sB&sz=w2400', slide: 6, model: 'GPT Image', formato: '9:16', driveId: '1V6cIU5kj1GDnj-cFkEcJWaGras2JM4sB' },
    { url: 'https://drive.google.com/thumbnail?id=1eOylFEN0fiugRv0h-Kpz0w8_bdDUh7Zz&sz=w2400', slide: 7, model: 'GPT Image', formato: '9:16', driveId: '1eOylFEN0fiugRv0h-Kpz0w8_bdDUh7Zz' },
    { url: 'https://drive.google.com/thumbnail?id=16vF9_9wsWGXyXikOFPG3BOsWh2pus_aM&sz=w2400', slide: 8, model: 'GPT Image', formato: '9:16', driveId: '16vF9_9wsWGXyXikOFPG3BOsWh2pus_aM' },
    { url: 'https://drive.google.com/thumbnail?id=1ybziVmT5IYes73lPr9YyF4tP6L8btHku&sz=w2400', slide: 9, model: 'GPT Image', formato: '9:16', driveId: '1ybziVmT5IYes73lPr9YyF4tP6L8btHku' },
    { url: 'https://drive.google.com/thumbnail?id=1D-HcfVdP7UaFn5h5yXvcXroWml1ikoiw&sz=w2400', slide: 10, model: 'GPT Image', formato: '9:16', driveId: '1D-HcfVdP7UaFn5h5yXvcXroWml1ikoiw' }
  ],
  driveFolderId: '1mStexMbSgZUZh_Bi6PbZQRxrsfO1yngf',
  driveZipId: '1r4gIb2WgUhwFk27on5qXilOZDZcbCJiO',
  fechaCreacion: '2026-09-15T23:05:00Z',
  fechaISO: '2026-09-15',
  publicado: true
};

function publishHistoriaIglesia() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  let catalog = { version: '5.1', total: 0, categorias: [], infografias: [] };
  try {
    const current = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    if (current && Array.isArray(current.infografias)) catalog = current;
  } catch (_) {}

  catalog.infografias = Array.isArray(catalog.infografias) ? catalog.infografias : [];
  const index = catalog.infografias.findIndex(item => item && (item.id === historiaIglesia.id || item.slug === historiaIglesia.slug));
  if (index >= 0) {
    catalog.infografias[index] = { ...catalog.infografias[index], ...historiaIglesia };
  } else {
    catalog.infografias.unshift(historiaIglesia);
  }

  catalog.infografias.sort((a, b) => String(b.fechaISO || b.fechaCreacion || '').localeCompare(String(a.fechaISO || a.fechaCreacion || '')));
  catalog.total = catalog.infografias.length;
  catalog.categorias = [...new Set([...(Array.isArray(catalog.categorias) ? catalog.categorias : []), ...catalog.infografias.map(i => i.categoria || i.tipo).filter(Boolean)])];
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`[Historia Iglesia I-X] Publicada en catálogo. Total: ${catalog.total}`);
  return { published: true, total: catalog.total };
}

module.exports = { publishHistoriaIglesia, historiaIglesia };
