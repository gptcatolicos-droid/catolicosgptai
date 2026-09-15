// Publicación aditiva: Historia de la Iglesia — Siglos XI al XX — 2026-09-15
// Inserta el carrusel en el catálogo persistente sin sobrescribir registros existentes.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'infografias-catalog.json');

const historiaIglesiaXIXX = {
  id: 'inf-historia-iglesia-siglos-xi-xx-20260915',
  slug: 'historia-de-la-iglesia-siglos-xi-al-xx',
  tema: 'Historia de la Iglesia — Siglos XI al XX',
  titulo: 'Historia de la Iglesia — Siglos XI al XX',
  tipo: 'doctrinal',
  categoria: 'doctrinal',
  formato: '9:16',
  estilo: 'cinematic',
  totalSlides: 10,
  metaDescription: 'Carrusel visual sobre la historia de la Iglesia católica desde el siglo XI hasta el siglo XX: reformas, concilios, órdenes religiosas, misiones, santos, Vaticano I y Vaticano II.',
  altText: 'Carrusel CatolicosGPT sobre la Historia de la Iglesia desde el siglo XI hasta el siglo XX',
  keywords: 'Historia de la Iglesia, Iglesia Católica, siglos XI al XX, Reforma Gregoriana, Concilio de Trento, Vaticano I, Vaticano II, santos, misiones, CatolicosGPT',
  imagenes: [
    { url: 'https://drive.google.com/thumbnail?id=1o2pjdM35ANAlLt1w89_SskiMktKo9SFE&sz=w2400', slide: 1, model: 'GPT Image', formato: '9:16', driveId: '1o2pjdM35ANAlLt1w89_SskiMktKo9SFE' },
    { url: 'https://drive.google.com/thumbnail?id=1GMW7BquqbiKwh80vkIT7EcMH-QTSraIk&sz=w2400', slide: 2, model: 'GPT Image', formato: '9:16', driveId: '1GMW7BquqbiKwh80vkIT7EcMH-QTSraIk' },
    { url: 'https://drive.google.com/thumbnail?id=1-7Uu5-CN934Sk7vLNxYXgCj4vr6zOY0Z&sz=w2400', slide: 3, model: 'GPT Image', formato: '9:16', driveId: '1-7Uu5-CN934Sk7vLNxYXgCj4vr6zOY0Z' },
    { url: 'https://drive.google.com/thumbnail?id=1eyz8s7EAq6RXAcE8SrE_JeU1uGCr3PJH&sz=w2400', slide: 4, model: 'GPT Image', formato: '9:16', driveId: '1eyz8s7EAq6RXAcE8SrE_JeU1uGCr3PJH' },
    { url: 'https://drive.google.com/thumbnail?id=1q-ce0jvvG43ZHMfgTkkUcak5nV9oQS9B&sz=w2400', slide: 5, model: 'GPT Image', formato: '9:16', driveId: '1q-ce0jvvG43ZHMfgTkkUcak5nV9oQS9B' },
    { url: 'https://drive.google.com/thumbnail?id=1BCrKfmuLbUchBTk1vUMjMD-DLgTCLwhE&sz=w2400', slide: 6, model: 'GPT Image', formato: '9:16', driveId: '1BCrKfmuLbUchBTk1vUMjMD-DLgTCLwhE' },
    { url: 'https://drive.google.com/thumbnail?id=12eHqob1HjKP1WNjyaTyAg8J-n7RW4Fom&sz=w2400', slide: 7, model: 'GPT Image', formato: '9:16', driveId: '12eHqob1HjKP1WNjyaTyAg8J-n7RW4Fom' },
    { url: 'https://drive.google.com/thumbnail?id=1cKYewaeznzsmMsF6n6Ijj6zZQ4jJIW1Z&sz=w2400', slide: 8, model: 'GPT Image', formato: '9:16', driveId: '1cKYewaeznzsmMsF6n6Ijj6zZQ4jJIW1Z' },
    { url: 'https://drive.google.com/thumbnail?id=12KZ6hk2ZSahz-Vj_BNEyYDk4x-HscIlN&sz=w2400', slide: 9, model: 'GPT Image', formato: '9:16', driveId: '12KZ6hk2ZSahz-Vj_BNEyYDk4x-HscIlN' },
    { url: 'https://drive.google.com/thumbnail?id=1uyRWeKKs6ro-_t0Z66C_V2cYsIXsyg1b&sz=w2400', slide: 10, model: 'GPT Image', formato: '9:16', driveId: '1uyRWeKKs6ro-_t0Z66C_V2cYsIXsyg1b' }
  ],
  driveFolderId: '1UFWLi1HdGdyEiz4iaGLER-2iZ1J3wRHA',
  driveZipId: '1Ruc6lk1jf7XmcrVL0pxfl7_Rb2OdFAQT',
  fechaCreacion: '2026-09-15T23:45:00Z',
  fechaISO: '2026-09-15',
  publicado: true
};

function publishHistoriaIglesiaXIXX() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  let catalog = { version: '5.1', total: 0, categorias: [], infografias: [] };
  try {
    const current = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    if (current && Array.isArray(current.infografias)) catalog = current;
  } catch (_) {}

  catalog.infografias = Array.isArray(catalog.infografias) ? catalog.infografias : [];
  const index = catalog.infografias.findIndex(item => item && (item.id === historiaIglesiaXIXX.id || item.slug === historiaIglesiaXIXX.slug));
  if (index >= 0) {
    catalog.infografias[index] = { ...catalog.infografias[index], ...historiaIglesiaXIXX };
  } else {
    catalog.infografias.unshift(historiaIglesiaXIXX);
  }

  catalog.infografias.sort((a, b) => String(b.fechaISO || b.fechaCreacion || '').localeCompare(String(a.fechaISO || a.fechaCreacion || '')));
  catalog.total = catalog.infografias.length;
  catalog.categorias = [...new Set([...(Array.isArray(catalog.categorias) ? catalog.categorias : []), ...catalog.infografias.map(i => i.categoria || i.tipo).filter(Boolean)])];
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`[Historia Iglesia XI-XX] Publicada en catálogo. Total: ${catalog.total}`);
  return { published: true, total: catalog.total };
}

module.exports = { publishHistoriaIglesiaXIXX, historiaIglesiaXIXX };
