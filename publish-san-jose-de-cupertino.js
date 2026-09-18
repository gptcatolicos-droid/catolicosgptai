// Publicación aditiva: San José de Cupertino — 2026-09-18
// Inserta el carrusel en el catálogo persistente sin borrar los registros existentes.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'infografias-catalog.json');

const sanJoseDeCupertino = {
  "id": "inf-san-jose-de-cupertino-20260918",
  "slug": "san-jose-de-cupertino",
  "tema": "San José de Cupertino",
  "titulo": "San José de Cupertino — Vida, virtudes y milagros",
  "tipo": "santo",
  "categoria": "santos-y-devociones",
  "formato": "9:12",
  "resolucion": "1086x1448",
  "estilo": "clasico-brand-grid-oficial",
  "totalSlides": 10,
  "metaDescription": "Carrusel católico sobre la vida de San José de Cupertino: su infancia, vocación franciscana, sacerdocio, éxtasis y levitaciones, milagros, obediencia, canonización y patronazgo de estudiantes y aviadores.",
  "altText": "Carrusel CatolicosGPT sobre la vida, virtudes y milagros de San José de Cupertino",
  "keywords": "San José de Cupertino, José de Cupertino, santo de los estudiantes, patrono de los aviadores, levitación, éxtasis místico, franciscano conventual, milagros, canonización, CatolicosGPT",
  "imagenes": [
    {
      "url": "https://drive.google.com/thumbnail?id=1yU_w55jJs6Ogac7HJDJFNLNNCwZ2XEaq&sz=w2400",
      "slide": 1,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1yU_w55jJs6Ogac7HJDJFNLNNCwZ2XEaq"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=1I9k3D4fVUgY4z2vbWLzfGpjk7eAdvrBp&sz=w2400",
      "slide": 2,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1I9k3D4fVUgY4z2vbWLzfGpjk7eAdvrBp"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=1nfkOhBYeWP2vIfRrCQg5Tpu1XqCV7yRG&sz=w2400",
      "slide": 3,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1nfkOhBYeWP2vIfRrCQg5Tpu1XqCV7yRG"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=18lEcRMiproHK97b0XsDbvlTmpTnaem9b&sz=w2400",
      "slide": 4,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "18lEcRMiproHK97b0XsDbvlTmpTnaem9b"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=1tuA6dQE4rIFC03-r8WnrFo_Ii0Cedo2k&sz=w2400",
      "slide": 5,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1tuA6dQE4rIFC03-r8WnrFo_Ii0Cedo2k"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=1zwuNHAcdU4b4O9s62pcbJwNOtZHvhH8Y&sz=w2400",
      "slide": 6,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1zwuNHAcdU4b4O9s62pcbJwNOtZHvhH8Y"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=1W1319u1Gy2hud8MQEv6nW8D7Dql0sxH9&sz=w2400",
      "slide": 7,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1W1319u1Gy2hud8MQEv6nW8D7Dql0sxH9"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=1VrDKZ9Y9XqmVn2VDsFUbLC2sAf4UoYwP&sz=w2400",
      "slide": 8,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1VrDKZ9Y9XqmVn2VDsFUbLC2sAf4UoYwP"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=1Lm94j4vjjDT1nv0J7A2F-vOL_sROFeYW&sz=w2400",
      "slide": 9,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1Lm94j4vjjDT1nv0J7A2F-vOL_sROFeYW"
    },
    {
      "url": "https://drive.google.com/thumbnail?id=1HqIuopVdfuaL-gjC0VAITzhxEVzLUjgP&sz=w2400",
      "slide": 10,
      "model": "GPT Image",
      "formato": "9:12",
      "driveId": "1HqIuopVdfuaL-gjC0VAITzhxEVzLUjgP"
    }
  ],
  "driveFolderId": "1gGJBwzzaDhEl55wqv8Nf65bbOeLEBjvt",
  "zipDriveId": "1CR3x5kqotfCyJL6iTvL3NKGtnJt_EO3G",
  "fechaCreacion": "2026-09-18T06:46:00Z",
  "fechaISO": "2026-09-18",
  "publicado": true
};

function publishSanJoseDeCupertino() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  let catalog = { version: '5.7', total: 0, categorias: [], infografias: [] };
  try {
    const current = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    if (current && Array.isArray(current.infografias)) catalog = current;
  } catch (_) {}

  catalog.infografias = Array.isArray(catalog.infografias) ? catalog.infografias : [];
  const index = catalog.infografias.findIndex(entry =>
    entry && (entry.id === sanJoseDeCupertino.id || entry.slug === sanJoseDeCupertino.slug)
  );

  if (index >= 0) {
    catalog.infografias[index] = { ...catalog.infografias[index], ...sanJoseDeCupertino };
  } else {
    catalog.infografias.unshift(sanJoseDeCupertino);
  }

  catalog.infografias.sort((a, b) =>
    String(b.fechaISO || b.fechaCreacion || '').localeCompare(String(a.fechaISO || a.fechaCreacion || ''))
  );
  catalog.total = catalog.infografias.length;
  catalog.categorias = [...new Set([
    ...(Array.isArray(catalog.categorias) ? catalog.categorias : []),
    ...catalog.infografias.map(i => i.categoria || i.tipo).filter(Boolean)
  ])];

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');

  // Persist the same record to Firestore when Firebase is enabled so the
  // publication survives cloud-first reads as well as the persistent disk.
  try {
    const firebaseSync = require('./firebase-module');
    if (firebaseSync && typeof firebaseSync.syncUploadInfografia === 'function') {
      firebaseSync.syncUploadInfografia(sanJoseDeCupertino).catch(err =>
        console.warn('[San José de Cupertino] Firestore sync pending:', err.message)
      );
    }
  } catch (err) {
    console.warn('[San José de Cupertino] Firestore sync unavailable:', err.message);
  }

  console.log(`[San José de Cupertino] Publicado en catálogo. Total: ${catalog.total}`);
  return { published: true, total: catalog.total };
}

module.exports = { publishSanJoseDeCupertino, sanJoseDeCupertino };
