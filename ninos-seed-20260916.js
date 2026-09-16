const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'infografias-catalog.json');

const items = [
  ['jesus-nace-en-belen','Jesús nace en Belén','Lucas 2,1-20','1NkbEITE0m0VcpjGlnl2pog2zA1QyZ5wn'],
  ['reyes-magos-visitan-a-jesus','Los Reyes Magos visitan a Jesús','Mateo 2,1-12','1bm6U6HPYx9KQlAeIPdVUYNHWjFbstoo2'],
  ['bautismo-de-jesus-para-colorear','El Bautismo de Jesús','Mateo 3,13-17','1ccOIu1lexmCd_maQjCUIUyDQsNAsGd1n'],
  ['jesus-llama-a-los-pescadores','Jesús llama a los pescadores','Marcos 1,16-20','1ZmZS7cf0vVl7qJCD0xAdIwJThNiYhupl'],
  ['jesus-calma-la-tempestad-para-colorear','Jesús calma la tempestad','Marcos 4,35-41','1OjM4aJSxreG6CfQAbJkLT75yIHcgq5Qh'],
  ['multiplicacion-panes-peces-para-colorear','La multiplicación de los panes y los peces','Juan 6,1-14','1f27oIqB8kjZ4FqMwsPuq4pe9ElJPQRsb'],
  ['jesus-sana-al-ciego-para-colorear','Jesús sana al ciego','Juan 9,1-12','1XmOTQgOJ7H8UZ2tvN5SFNVWlwn060WdY'],
  ['jesus-resucita-a-lazaro-para-colorear','Jesús resucita a Lázaro','Juan 11,1-44','1jYm903pO1Y6u4Z1sjzIYQwY8hnmvSLoX'],
  ['entrada-de-jesus-en-jerusalen-para-colorear','La entrada de Jesús en Jerusalén','Mateo 21,1-11','1F1UAxbo4Q-4L47b-z_bvhSKPeakKrsEp'],
  ['resurreccion-de-jesus-para-colorear','La Resurrección de Jesús','Mateo 28,1-10','1CqUoU5cLrUoT29HQp8eQEuMTowvZj1Ox'],
  ['torre-de-babel-para-colorear','La Torre de Babel','Génesis 11,1-9','1JUoAfD2s36Hj7lsUEjjy2VbDOAf9QgCZ'],
  ['isaac-hijo-de-la-promesa-para-colorear','Isaac, hijo de la promesa','Génesis 21,1-7','1x4nH7Q_SHsrhJVs4_9Mn0tARHlrgW4hQ'],
  ['sueno-de-jacob-para-colorear','El sueño de Jacob','Génesis 28,10-22','15CDXYcCm2KvhVWKmGHtlT93R2Pqaxmm1'],
  ['diez-mandamientos-para-colorear','Los Diez Mandamientos','Éxodo 20,1-17','1HjcSuUolvayUOH6Ai0_nTh3bxLCXvG3U'],
  ['david-y-goliat-para-colorear','David y Goliat','1 Samuel 17,1-51','1qUI-B8T9Wy5QVXuyCyXmybq3kG_47HfA'],
  ['elias-y-el-fuego-del-cielo-para-colorear','Elías y el fuego del cielo','1 Reyes 18,20-39','1-9QA_m3l5ALsdi-xEY8e3tn-2V7TFGPa'],
  ['josue-y-jerico-para-colorear','Josué y las murallas de Jericó','Josué 6,1-20','1FOzoedknqnoJwVA7aapOXIy6VAullEBF'],
  ['gedeon-y-el-vellon-para-colorear','Gedeón y el vellón','Jueces 6,36-40','18ZK_c-LaP4VdS_F7IKeVdR5YbhsKId20'],
  ['rut-y-noemi-para-colorear','Rut y Noemí','Rut 1,16-18','19CckGSgwS8jPfxgYX6VKEc-H4dd9LLNX'],
  ['jonas-y-el-gran-pez-para-colorear','Jonás y el gran pez','Jonás 2,1-11','15P5lkx9cGzfG08e6TO1t8BNYDLwulD-f']
].map(([slug,titulo,cita,driveId],idx) => ({
  id: `ninos-20260916-${String(idx+1).padStart(2,'0')}`,
  slug,
  tema: `${titulo} · dibujo bíblico para colorear`,
  tipo: 'dibujo-para-colorear',
  categoria: 'dibujo-para-colorear',
  titulo,
  seoTitle: `${titulo} para colorear | CatólicosGPT Niños`,
  metaDescription: `${titulo} (${cita}). Dibujo bíblico católico para niños, listo para descargar, imprimir y colorear en familia, colegio o catequesis.`,
  altText: `${titulo} para colorear - ${cita} - CatólicosGPT`,
  tipoVisualizacion: 'continua',
  imagenes: [{
    url: `https://drive.google.com/thumbnail?id=${driveId}&sz=w2400`,
    slide: 1,
    name: `${String(idx+1).padStart(2,'0')}-${slug}.png`,
    alt: `${titulo} para colorear - ${cita}`,
    width: 1080,
    height: 1920,
    esPortada: true,
    model: 'catolicosgpt-brand-grid-infantil',
    formato: '9:16',
    sizeLabel: 'Vertical 9:16'
  }],
  totalSlides: 1,
  formato: '9:16',
  userPlan: 'admin',
  userId: 'seed-catolicosgpt',
  fechaCreacion: '2026-09-16T10:30:00.000Z',
  fechaISO: '2026-09-16',
  publicado: true,
  keywords: `${titulo}, ${cita}, dibujo bíblico para colorear, catequesis para niños, dibujos católicos para colorear, recursos católicos imprimibles, CatólicosGPT, IA Católica`,
  audienciaRecurso: 'ninos',
  mostrarEnNinos: true,
  esDibujoNinos: true,
  esImprimible: true
}));

function seed() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let catalog = { version: '5.0', total: 0, categorias: [], infografias: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
      if (parsed && Array.isArray(parsed.infografias)) catalog = parsed;
    } catch (_) {}
    catalog.infografias = catalog.infografias || [];
    const bySlug = new Set(catalog.infografias.map(x => x && x.slug).filter(Boolean));
    let added = 0;
    for (const item of items) {
      if (!bySlug.has(item.slug)) {
        catalog.infografias.unshift(item);
        bySlug.add(item.slug);
        added++;
      }
    }
    if (!added) return;
    catalog.total = catalog.infografias.length;
    catalog.categorias = [...new Set(catalog.infografias.map(i => i.categoria || i.tipo).filter(Boolean))];
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
    console.log(`[Niños Seed] ${added} recursos infantiles agregados. Total catálogo: ${catalog.total}`);
  } catch (err) {
    console.error('[Niños Seed] Error:', err.message);
  }
}

setTimeout(seed, 20000);
setTimeout(seed, 60000);
