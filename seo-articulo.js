'use strict';
// ════════════════════════════════════════════════════════════════════════════
// LA URL BUENA DE UN ARTÍCULO Y SU MARCADO
// ════════════════════════════════════════════════════════════════════════════
// Vivía dentro de server.js, y ahí no se puede probar nada: requerir ese fichero
// arranca un servidor. Aquí sí.

// El host publico. Se repite aqui en vez de importarlo de server.js porque
// requerir ese fichero arranca un servidor, que es justo lo que se evita al
// sacar esto fuera. Lee las mismas variables, asi que no puede desincronizarse.
function getPublicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.APP_URL || 'https://www.catolicosgpt.com').replace(/\/+$/, '');
}

// La URL buena de un articulo. Se sirve en dos rutas -/blog/slug y
// /blog/categoria/slug- y hasta ahora cada una se declaraba canonica de si
// misma: para Google eran dos paginas distintas con el mismo texto,
// compitiendo entre ellas, en los 1372 articulos. Manda la larga porque es la
// que anuncia el sitemap.
function urlCanonicaDeArticulo(post) {
  return `/blog/${post.categoria || 'doctrina'}/${post.slug}`;
}

// El marcado estructurado del articulo. Estaba escrito dentro de una sola de
// las dos rutas, asi que la otra servia los articulos sin fecha, sin autor y
// sin migas de pan. Aqui se escribe una vez y lo usan las dos.
//
// Las URLs salen de getPublicSiteUrl y ya no de un host escrito a mano: el
// marcado decia ai.catolicosgpt.com mientras la etiqueta canonica decia
// www.catolicosgpt.com, o sea dos hosts distintos para la misma pagina.
function esquemasDeArticulo(post) {
  const sitio = getPublicSiteUrl();
  const canonica = `${sitio}${urlCanonicaDeArticulo(post)}`;
  const categoria = post.categoria || 'doctrina';
  const esquemas = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.titulo,
      "description": post.descripcion || post.extracto || "",
      "image": post.imagenPortada || `${sitio}/favicon.png`,
      "datePublished": post.fechaCreacion,
      "dateModified": post.fechaModificacion || post.fechaCreacion,
      "mainEntityOfPage": { "@type": "WebPage", "@id": canonica },
      "author": { "@type": "Organization", "name": "CatólicosGPT", "url": sitio },
      "publisher": {
        "@type": "Organization",
        "name": "CatólicosGPT",
        "logo": { "@type": "ImageObject", "url": `${sitio}/favicon.png` }
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": sitio },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${sitio}/blog` },
        { "@type": "ListItem", "position": 3, "name": categoria, "item": `${sitio}/blog?categoria=${encodeURIComponent(categoria)}` },
        { "@type": "ListItem", "position": 4, "name": post.titulo, "item": canonica }
      ]
    }
  ];
  if (Array.isArray(post.faqs) && post.faqs.length > 0) {
    esquemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": post.faqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    });
  }
  return esquemas;
}

module.exports = { urlCanonicaDeArticulo, esquemasDeArticulo, getPublicSiteUrl };
