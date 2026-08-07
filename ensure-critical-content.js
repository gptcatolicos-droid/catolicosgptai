const infografias = require('./infografias-module');

const REQUIRED = {
  fechaCreacion: '2026-06-28T19:53:43.170Z',
  categoria: 'doctrinal',
  tema: 'Doctrina',
  userPlan: 'admin',
  id: 'inf-1782676423170',
  formato: '1:1',
  altText: 'Historia de la Iglesia Siglos 1 -5 | CatólicosGPT IA Católica',
  totalSlides: 6,
  titulo: 'Historia de la Iglesia Siglos 1 -5',
  tipo: 'doctrinal',
  slug: 'historia-de-la-iglesia-siglos-1-5',
  keywords: 'historia de la Iglesia, siglos 1 al 5, Iglesia primitiva, Padres de la Iglesia, doctrina católica, Magisterio, catequesis catolica, CatólicosGPT, CatolicosGPT, ia catolica, inteligencia artificial catolica, chat catolico, formación doctrinal, cristianismo antiguo',
  metaDescription: 'Descubre la historia de la Iglesia en los siglos 1 al 5. Formación doctrinal clara y fiel al Magisterio con CatólicosGPT, la IA Católica líder.',
  userId: 'u-1782132066408-ih52rk',
  publicado: true,
  fechaISO: '2026-06-28',
  imagenes: [
    { formato:'1:1', sizeLabel:'Cuadrado (1:1)', slide:1, url:'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1782674705/48D02D1E-F233-470C-AE01-CCDF9D08F21B_cfbfrz.png', width:1200, model:'cloudinary-native', esPortada:true, alt:'Historia de la Iglesia: Siglos I al V | CatólicosGPT', height:1200, name:'slide-1.jpg' },
    { sizeLabel:'Cuadrado (1:1)', esPortada:false, name:'slide-2.jpg', height:1200, alt:'Historia de la Iglesia: Siglos I al V | CatólicosGPT', url:'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1782590277/E70ACBE7-0881-4FD8-A1F5-FA974089EABD_ah7asw.png', width:1200, model:'cloudinary-native', slide:2, formato:'1:1' },
    { height:1200, width:1200, model:'cloudinary-native', url:'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1782590277/60D14ABB-9B26-49A9-9D76-28D80039BC3F_pwica4.png', slide:3, name:'slide-3.jpg', sizeLabel:'Cuadrado (1:1)', alt:'Historia de la Iglesia: Siglos I al V | CatólicosGPT', formato:'1:1', esPortada:false },
    { formato:'1:1', slide:4, width:1200, url:'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1782590278/7FAC96C7-BBA8-4CB7-BCF0-C6A9E4B3DFC9_csohph.png', model:'cloudinary-native', alt:'Historia de la Iglesia: Siglos I al V | CatólicosGPT', height:1200, name:'slide-4.jpg', esPortada:false, sizeLabel:'Cuadrado (1:1)' },
    { alt:'Historia de la Iglesia: Siglos I al V | CatólicosGPT', name:'slide-5.jpg', slide:5, formato:'1:1', sizeLabel:'Cuadrado (1:1)', url:'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1782590280/76522BC0-38CF-4DD3-8BA0-A63889A4EAFA_zycqza.png', esPortada:false, width:1200, model:'cloudinary-native', height:1200 },
    { height:1200, sizeLabel:'Cuadrado (1:1)', width:1200, model:'cloudinary-native', alt:'Historia de la Iglesia: Siglos I al V | CatólicosGPT', formato:'1:1', slide:6, esPortada:false, url:'https://res.cloudinary.com/dwbqrp7kk/image/upload/v1782590280/67714920-63F0-4364-81F3-CDF8079C73D8_ocu4qy.png', name:'slide-6.jpg' }
  ]
};

async function ensureCriticalContent() {
  const catalog = infografias.loadCatalog();
  const items = Array.isArray(catalog.infografias) ? catalog.infografias : [];
  const idx = items.findIndex(item => item.slug === REQUIRED.slug || item.id === REQUIRED.id);
  if (idx >= 0) {
    console.log('[Critical Content] Historia de la Iglesia I-V ya existe.');
    return;
  }

  items.push(REQUIRED);
  infografias.saveCatalog({ ...catalog, infografias: items, total: items.length }, REQUIRED);
  console.log('[Critical Content] Restaurada Historia de la Iglesia I-V.');
}

ensureCriticalContent().catch(err => {
  console.warn('[Critical Content] Error no fatal:', err.message);
}).finally(() => process.exit(0));
