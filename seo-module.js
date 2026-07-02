// ════════════════════════════════════════════════════════════════
// SEO MODULE — Generador de XML Sitemaps, RSS Feeds, y canonical
// tags para potenciar el sitio CatólicosGPT en motores de búsqueda
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const APP_URL = (process.env.PUBLIC_SITE_URL || process.env.APP_URL || 'https://ai.catolicosgpt.com').replace(/\/+$/, '');

// ── Sitemap Generator ──
function generateSitemapXML({ infografias = [], posts = [], sementeras = [], santos = [], videos = [], podcasts = [], pdfs = [], authorityPages = [] } = {}) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`;

  const addUrl = (loc, priority = '0.5', changefreq = 'weekly', lastmod = null) => {
    const modStr = lastmod ? `<lastmod>${lastmod}</lastmod>` : `<lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>`;
    xml += `
  <url>
    <loc>${APP_URL}${loc}</loc>
    ${modStr}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  };

  // 1. Core pages
  addUrl('/', '1.0', 'daily');
  addUrl('/preguntas-frecuentes', '0.9', 'weekly');
  addUrl('/infografias', '0.8', 'daily');
  addUrl('/blog', '0.8', 'daily');
  addUrl('/podcasts', '0.7', 'weekly');
  addUrl('/videos', '0.7', 'weekly');
  addUrl('/catequesis-ia', '0.8', 'daily');
  addUrl('/ninos', '0.8', 'daily');
  addUrl('/misa-de-hoy', '0.8', 'daily');
  addUrl('/santo-del-dia', '0.8', 'daily');
  addUrl('/santoral', '0.8', 'daily');
  addUrl('/liturgia-de-las-horas', '0.8', 'daily');

  authorityPages.forEach(page => {
    if (page && page.path) addUrl(page.path, page.path === '/ia-catolica' ? '1.0' : '0.9', 'weekly');
  });

  // 2. Infografías
  infografias.forEach(inf => {
    const fecha = inf.fechaCreacion ? inf.fechaCreacion.slice(0, 10) : null;
    addUrl(`/infografias/${inf.slug}`, '0.7', 'monthly', fecha);
    const childText = [inf.titulo, inf.tema, inf.categoria, inf.tipo, inf.keywords, inf.metaDescription].join(' ').toLowerCase();
    const isChild = inf.mostrarEnNinos === true
      || inf.esDibujoNinos === true
      || inf.esImprimible === true
      || String(inf.audienciaRecurso || '').toLowerCase() === 'ninos'
      || ['catequesis-ninos', 'dibujo-para-colorear', 'infografia-ninos', 'ninos'].includes(String(inf.categoria || inf.tipo || '').toLowerCase())
      || /\b(niñ|ninos|niños|infantil|colorear|imprimir|catequesis infantil)\b/.test(childText);
    if (isChild) addUrl(`/ninos/recursos/${inf.slug}`, '0.7', 'weekly', fecha);
  });

  const slugifySimple = (val) => (val || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // 3. Blog posts
  posts.forEach(p => {
    const fecha = p.fechaCreacion ? p.fechaCreacion.slice(0, 10) : null;
    const catSlug = p.categoria ? slugifySimple(p.categoria) : 'catequesis';
    addUrl(`/blog/${catSlug}/${p.slug}`, '0.7', 'weekly', fecha);
  });

  // 4. Secciones SEO temáticas (sementeras)
  sementeras.forEach(sem => {
    addUrl(`/recursos/${sem.slug}`, '0.6', 'weekly');
  });

  santos.forEach(s => {
    if (!s.slug) return;
    const fecha = s.fechaModificacion ? s.fechaModificacion.slice(0, 10) : (s.fechaCreacion ? s.fechaCreacion.slice(0, 10) : null);
    addUrl(`/santoral/${s.slug}`, '0.7', 'monthly', fecha);
  });

  videos.forEach(v => {
    if (!v.slug) return;
    const fecha = v.fechaCreacion ? v.fechaCreacion.slice(0, 10) : null;
    addUrl(`/videos/${v.slug}`, '0.6', 'monthly', fecha);
  });

  podcasts.forEach(p => {
    if (!p.slug) return;
    const fecha = p.fechaCreacion ? p.fechaCreacion.slice(0, 10) : null;
    addUrl(`/podcasts/${p.slug}`, '0.6', 'monthly', fecha);
  });

  pdfs.forEach(p => {
    if (!p.slug || p.publicado === false) return;
    const fecha = p.actualizadoEn ? p.actualizadoEn.slice(0, 10) : (p.creadoEn ? p.creadoEn.slice(0, 10) : null);
    addUrl(`/catequesis-ia/recursos/${p.slug}`, '0.7', 'weekly', fecha);
  });

  xml += '\n</urlset>';
  return xml;
}

// ── RSS Feed ──
function generateRSSFeed({ posts = [], infografias = [] } = {}) {
  let rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>CatólicosGPT — Blog e Infografías</title>
  <link>${APP_URL}</link>
  <description>Asistente Católico Virtual con Inteligencia Artificial, base de datos de catequesis, liturgia, y generador de infografías.</description>
  <language>es-es</language>
  <atom:link href="${APP_URL}/rss.xml" rel="self" type="application/rss+xml" />
  <pubDate>${new Date().toUTCString()}</pubDate>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <generator>CatólicosGPT Engine 2026</generator>`;

  // Combinar posts e infografías
  const combinados = [
    ...posts.map(p => ({
      titulo: p.titulo,
      link: `/blog/${p.slug}`,
      desc: p.extracto || p.descripcion || 'Artículo de formación de fe católico.',
      fecha: new Date(p.fechaCreacion || Date.now()).toUTCString(),
      id: `post-${p.slug}`
    })),
    ...infografias.map(i => ({
      titulo: `${i.titulo || i.tema} (Infografía)`,
      link: `/infografias/${i.slug}`,
      desc: i.metaDescription || 'Visualización catequética interactiva en alta resolución.',
      fecha: new Date(i.fechaCreacion || Date.now()).toUTCString(),
      id: `inf-${i.slug}`
    }))
  ];

  // Ordenar descendente por fecha
  combinados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  combinados.slice(0, 30).forEach(item => {
    rss += `
  <item>
    <title><![CDATA[${item.titulo}]]></title>
    <link>${APP_URL}${item.link}</link>
    <guid isPermaLink="true">${APP_URL}${item.link}</guid>
    <pubDate>${item.fecha}</pubDate>
    <description><![CDATA[${item.desc}]]></description>
  </item>`;
  });

  rss += '\n</channel>\n</rss>';
  return rss;
}

module.exports = { generateSitemapXML, generateRSSFeed };
