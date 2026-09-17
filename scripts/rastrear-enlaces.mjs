// Rastreador de enlaces internos.
//
// Sale de la portada y del sitemap, sigue los enlaces del propio sitio y anota
// el código de cada uno. Sirve para no enterarse por Search Console, semanas
// después, de que una página que anunciamos a Google devuelve 404.
//
//   node scripts/rastrear-enlaces.mjs [maximo]
//
// Por defecto apunta a localhost:3111; con SITIO=https://... mira otro.
const BASE = process.env.SITIO || 'http://localhost:3111';
const vistos = new Map();
const cola = ['/'];
const origenes = new Map();

const sitemap = await fetch(BASE + '/sitemap.xml').then(r => r.text()).catch(() => '');
for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const ruta = m[1].replace(/^https?:\/\/[^/]+/, '');
  if (ruta && !cola.includes(ruta)) { cola.push(ruta); origenes.set(ruta, 'sitemap.xml'); }
}
console.log(`partida: ${cola.length} rutas (portada + sitemap)`);

const MAX = Number(process.argv[2] || 400);
while (cola.length && vistos.size < MAX) {
  const ruta = cola.shift();
  if (vistos.has(ruta)) continue;
  let estado = 0, html = '';
  try {
    const r = await fetch(BASE + ruta, { redirect: 'manual' });
    estado = r.status;
    const tipo = r.headers.get('content-type') || '';
    if (tipo.includes('text/html')) html = await r.text();
  } catch (e) { estado = -1; }
  vistos.set(ruta, estado);

  if (html && estado === 200) {
    for (const m of html.matchAll(/href="([^"#?]+)/g)) {
      let h = m[1];
      if (h.startsWith('http')) { if (!h.startsWith(BASE)) continue; h = h.replace(BASE, ''); }
      if (!h.startsWith('/')) continue;
      if (/\.(png|jpe?g|svg|css|js|ico|webp|pdf|xml|txt)$/i.test(h)) continue;
      if (h.startsWith('/api/')) continue;
      if (!vistos.has(h) && !cola.includes(h)) { cola.push(h); if (!origenes.has(h)) origenes.set(h, ruta); }
    }
  }
}

const porEstado = {};
for (const [, e] of vistos) porEstado[e] = (porEstado[e] || 0) + 1;
console.log('\nrutas visitadas:', vistos.size, '| pendientes en cola:', cola.length);
console.log('por código:', JSON.stringify(porEstado));

const rotos = [...vistos].filter(([, e]) => e >= 400 || e === -1);
console.log(`\nENLACES ROTOS: ${rotos.length}`);
for (const [ruta, estado] of rotos.slice(0, 60)) {
  console.log(`  ${estado}  ${ruta}   (enlazado desde: ${origenes.get(ruta) || 'portada'})`);
}
