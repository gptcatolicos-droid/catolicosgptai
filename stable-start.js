// CatolicosGPT stable bootstrap — 2026-08-22
// Preserves PR #8 recovery and adds scoped UI protections, modern infographics UX,
// and a protected full-backup download endpoint.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

// Keep the verified recovery behavior from PR #8.
try {
  require('./bootstrap-content-restore').restoreBundledCatalogs();
  console.log('[Stable] Bundled Infografías/PDF restore executed.');
} catch (err) {
  console.warn('[Stable] Bundled Infografías/PDF restore skipped:', err.message);
}
try {
  require('./bootstrap-hidden-content-restore').restoreHiddenCatalogs();
  console.log('[Stable] Bundled Video/Podcast restore executed.');
} catch (err) {
  console.warn('[Stable] Bundled Video/Podcast restore skipped:', err.message);
}

// /ninos renders from local recovered data immediately; cloud sync stays background-only.
try {
  const recursosPdf = require('./recursos-pdf-module');
  if (recursosPdf && typeof recursosPdf.refreshFromCloud === 'function') {
    const originalRefresh = recursosPdf.refreshFromCloud.bind(recursosPdf);
    recursosPdf.refreshFromCloud = async function stableRefresh(...args) {
      Promise.resolve().then(() => originalRefresh(...args)).catch(err =>
        console.warn('[Stable] PDF background refresh:', err.message)
      );
      try { return recursosPdf.loadCatalog(); }
      catch (_) { return { recursos: [] }; }
    };
  }
} catch (err) {
  console.warn('[Stable] /ninos background protection unavailable:', err.message);
}

// This CSS is intentionally scoped. It only protects layout primitives and ChatIA on mobile;
// it does NOT globally resize content-page headings or paragraphs.
const STABLE_MOBILE_CSS = `
<style id="catolicosgpt-stable-mobile">
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;width:100%;max-width:100%;overflow-x:hidden}
  img{max-width:100%;height:auto}
  @media(min-width:768px){body>header{display:none!important}}
  @media(max-width:767px){
    body{min-height:100svh;background:#F9F6F0;color:#2D241E}
    body>header{position:sticky!important;top:0!important;z-index:900!important;display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:70px!important;padding:10px 14px!important;background:rgba(255,255,255,.98)!important;border-bottom:1px solid #E6DFD4!important;box-shadow:0 2px 10px rgba(37,27,21,.05)!important}
    body>header>div{display:flex!important;align-items:center!important;gap:9px!important;min-width:0!important}
    body>header button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:40px!important;height:40px!important;padding:8px!important;border:0!important;border-radius:11px!important;background:transparent!important;color:#251B15!important}
    body>header button svg{width:23px!important;height:23px!important;max-width:23px!important}
    body>header a{text-decoration:none!important}
    body>header a>svg{width:29px!important;height:29px!important;max-width:29px!important;flex:0 0 29px!important}
    body>header a span{font-size:17px!important;line-height:1!important;white-space:nowrap!important}
    body>header a[href="/login"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:38px!important;padding:0 16px!important;border-radius:999px!important;background:#5E1B22!important;color:#fff!important;font-size:13px!important;font-weight:700!important}
    .sidebar-desktop{display:none!important}
    body>div.flex.flex-1.h-full.overflow-hidden{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:calc(100svh - 70px)!important;overflow:visible!important}
    main{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:calc(100svh - 70px)!important;overflow-x:hidden!important;overflow-y:visible!important}
    #mobile-drawer{position:fixed!important;inset:0!important;z-index:1000!important;background:rgba(0,0,0,.48)!important;opacity:0!important;pointer-events:none!important;transition:opacity .2s ease!important}
    #mobile-drawer.opacity-100{opacity:1!important;pointer-events:auto!important}
    #mobile-drawer-content{width:min(82vw,320px)!important;max-width:320px!important;height:100%!important;background:#fff!important;transform:translateX(-100%)!important;transition:transform .2s ease!important;overflow-y:auto!important;box-shadow:8px 0 24px rgba(0,0,0,.14)!important}
    #mobile-drawer-content.translate-x-0{transform:translateX(0)!important}
    #mobile-drawer-content svg{width:24px!important;height:24px!important;max-width:24px!important}
    #mobile-drawer-content nav{display:flex!important;flex-direction:column!important;gap:4px!important}
    #mobile-drawer-content .nav-link{display:block!important;padding:10px 12px!important;border-radius:10px!important;color:#2D241E!important;text-decoration:none!important;font-size:14px!important}

    /* Content pages: only containment, never global typography rewrites. */
    main .seo-card{width:100%!important;max-width:100%!important;overflow:hidden!important}
    main .seo-card img{display:block!important;width:100%!important;max-width:100%!important;height:auto!important}
    main form input[type="text"],main form input[type="search"]{min-width:0!important;max-width:100%!important}

    /* ChatIA compact mobile presentation. */
    .chat-shell{display:flex!important;flex-direction:column!important;width:100%!important;max-width:100%!important;height:calc(100svh - 70px)!important;min-height:0!important;overflow:hidden!important}
    .chat-panel{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important}
    .chat-topbar{display:none!important}
    #chat-box{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;padding:14px 14px 10px!important;background:transparent!important}
    #welcome-screen{justify-content:center!important;gap:10px!important;padding:8px 0!important}
    #welcome-screen>div:first-child{width:42px!important;height:42px!important;border-radius:14px!important;font-size:18px!important}
    #welcome-screen h1{font-size:22px!important;line-height:1.12!important;margin:0!important;text-align:center!important}
    #welcome-screen p{font-size:13px!important;line-height:1.35!important;margin:0!important;text-align:center!important}
    .welcome-cards{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;margin-top:4px!important;padding:0!important}
    .welcome-card{min-height:0!important;padding:14px!important;gap:8px!important;border-radius:16px!important;box-shadow:none!important;background:rgba(255,253,248,.9)!important}
    .welcome-card-icon{width:34px!important;height:34px!important}
    .welcome-card-title{font-size:12px!important;line-height:1.2!important}
    .welcome-card-text{font-size:13px!important;line-height:1.35!important}
    .message-content,.markdown-body,.chat-bubble.bot{max-width:100%!important;font-size:15px!important;line-height:1.55!important;overflow-wrap:anywhere!important}
    .message-content p,.markdown-body p,.chat-bubble.bot p{font-size:15px!important;line-height:1.55!important;margin:.55em 0!important}
    .message-content h1,.markdown-body h1,.chat-bubble.bot h1{font-size:22px!important;line-height:1.18!important;margin:.8em 0 .35em!important}
    .message-content h2,.markdown-body h2,.chat-bubble.bot h2{font-size:19px!important;line-height:1.22!important;margin:.75em 0 .3em!important}
    .message-content h3,.markdown-body h3,.chat-bubble.bot h3{font-size:17px!important;line-height:1.25!important;margin:.7em 0 .25em!important}
    .message-content li,.markdown-body li,.chat-bubble.bot li{font-size:15px!important;line-height:1.5!important}
    .chat-input-wrap{flex:0 0 auto!important;position:sticky!important;bottom:0!important;z-index:60!important;width:100%!important;padding:9px 12px calc(9px + env(safe-area-inset-bottom))!important;background:rgba(255,255,255,.98)!important;backdrop-filter:blur(14px)!important;box-shadow:0 -8px 22px rgba(37,27,21,.07)!important;font-size:10px!important;line-height:1.25!important}
    .chat-input-wrap form{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:8px!important;width:100%!important;margin:0!important;font-size:16px!important}
    .chat-input-wrap input,.chat-input-wrap textarea{min-width:0!important;min-height:48px!important;max-height:96px!important;padding:10px 14px!important;border:1px solid #D8D0C5!important;border-radius:999px!important;background:#fff!important;color:#2D241E!important;font-size:16px!important;line-height:1.25!important}
    .chat-input-wrap button{flex:0 0 48px!important;width:48px!important;height:48px!important;min-height:48px!important;padding:0!important;border:0!important;border-radius:16px!important;background:#5E1B22!important;color:#fff!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
    .chat-input-wrap button svg{width:23px!important;height:23px!important;max-width:23px!important}
    .chat-input-wrap>div:not(:first-child),.chat-input-wrap small{font-size:10px!important;line-height:1.25!important;margin-top:5px!important}
  }
</style>`;

function readJsonSafe(filename, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8')); }
  catch (_) { return fallback; }
}

try {
  const serverPath = require.resolve('./server');
  const originalJsLoader = Module._extensions['.js'];
  Module._extensions['.js'] = function stableLoader(mod, filename) {
    if (filename !== serverPath) return originalJsLoader(mod, filename);
    let source = fs.readFileSync(filename, 'utf8');

    // Keep requested menu items hidden without deleting routes or data.
    for (const route of ['/oraciones', '/videos', '/podcasts', '/misas']) {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      source = source.replace(new RegExp(`<a\\s+href=["']${escaped}["'][\\s\\S]*?<\\/a>`, 'g'), '');
    }

    // Replace the prior emergency CSS if present and inject the scoped stable version.
    source = source.replace(/<style id="catolicosgpt-critical-mobile-fallback">[\s\S]*?<\/style>/g, '');
    if (!source.includes('catolicosgpt-stable-mobile')) {
      source = source.replace('</head>', STABLE_MOBILE_CSS + '\n</head>');
    }

    // Restore the latest Infografías behavior: newest first, filters retained,
    // first 24 visible and progressive loading as the user scrolls.
    const oldQueryBlock = "  const page = parseInt(req.query.page) || 1;\n  const cat  = req.query.categoria || 'all';\n  const q    = req.query.q || '';\n  \n  const { items, total, totalPages } = infografias.getInfografias({ categoria: cat, q, page, limit: 12 });";
    const newQueryBlock = [
      "  const page = 1;",
      "  const cat  = req.query.categoria || 'all';",
      "  const q    = req.query.q || '';",
      "  let items = (infografias.loadCatalog().infografias || [])",
      "    .filter(i => i && i.publicado !== false)",
      "    .sort((a, b) => new Date(b.fechaCreacion || b.createdAt || b.updatedAt || 0) - new Date(a.fechaCreacion || a.createdAt || a.updatedAt || 0));",
      "  if (cat !== 'all') items = items.filter(i => String(i.categoria || i.tipo || '').toLowerCase() === String(cat).toLowerCase());",
      "  if (q) { const needle = String(q).toLowerCase().trim(); items = items.filter(i => ((i.titulo || '') + ' ' + (i.tema || '') + ' ' + (i.keywords || '') + ' ' + (i.metaDescription || '')).toLowerCase().includes(needle)); }",
      "  const total = items.length;",
      "  const totalPages = 1;"
    ].join('\n');
    if (source.includes(oldQueryBlock)) source = source.replace(oldQueryBlock, newQueryBlock);
    source = source.replace('${items.map(i => {', '${items.map((i, index) => {');
    source = source.replace('          <div class="seo-card flex flex-col justify-between overflow-hidden">', '          <div data-infografia-card="${index}" style="${index >= 24 ? \'display:none;\' : \'\'}" class="seo-card flex flex-col justify-between overflow-hidden">');
    const listAnchor = '      <div class="flex flex-col gap-6">\n        ${listHtml}\n      </div>';
    if (source.includes(listAnchor) && !source.includes('infografias-load-more')) {
      const progressive = [
        '      <div class="flex flex-col gap-6">',
        '        ${listHtml}',
        '      </div>',
        '      <div id="infografias-load-more" class="h-8" aria-hidden="true"></div>',
        '      <script>',
        '        (() => {',
        '          const cards = [...document.querySelectorAll("[data-infografia-card]")];',
        '          let shown = cards.filter(card => card.style.display !== "none").length || 24;',
        '          const sentinel = document.getElementById("infografias-load-more");',
        '          if (!sentinel || cards.length <= shown) { if (sentinel) sentinel.remove(); return; }',
        '          const reveal = () => {',
        '            const next = Math.min(shown + 24, cards.length);',
        '            for (let i = shown; i < next; i++) cards[i].style.display = "";',
        '            shown = next;',
        '            if (shown >= cards.length && observer) { observer.disconnect(); sentinel.remove(); }',
        '          };',
        '          if ("IntersectionObserver" in window) {',
        '            observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) reveal(); }, { rootMargin: "500px 0px" });',
        '            observer.observe(sentinel);',
        '          } else {',
        '            window.addEventListener("scroll", () => { if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 700) reveal(); }, { passive:true });',
        '          }',
        '        })();',
        '      </script>'
      ].join('\n');
      source = source.replace(listAnchor, progressive);
    }

    // Protected backup restore + download endpoints.
    const middlewareAnchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
    if (source.includes(middlewareAnchor) && !source.includes("/admin/restaurar-backup")) {
      const restoreRoutes = [
        '',
        '// === STABLE ADMIN BACKUP TOOLS ===',
        "const backupRestore = require('./backup-restore-module');",
        "app.get('/admin/restaurar-backup', requireStrictAdminPage, (req, res) => {",
        "  try { res.type('html').send(fs.readFileSync(path.join(__dirname, 'backup-restore-page.html'), 'utf8')); }",
        "  catch (err) { res.status(500).send('No se pudo cargar la herramienta de backup.'); }",
        '});',
        "app.post('/admin/restaurar-backup', requireStrictAdminPage, (req, res) => {",
        '  try {',
        '    const result = backupRestore.restoreBackup(req.body);',
        "    const inf = require('./infografias-module').loadCatalog();",
        "    const pdf = require('./recursos-pdf-module').loadCatalog();",
        "    const blog = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'blog-catalog.json'), 'utf8')); } catch (_) { return {}; } })();",
        "    const saints = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'santoral-db.json'), 'utf8')); } catch (_) { return {}; } })();",
        '    const live = { infografias:Array.isArray(inf.infografias)?inf.infografias.length:0, recursosPdf:Array.isArray(pdf.recursos)?pdf.recursos.length:0, feCatolica:Array.isArray(blog.posts)?blog.posts.length:0, santoral:Array.isArray(saints.santos)?saints.santos.length:0 };',
        '    res.json({ ...result, live });',
        '  } catch (err) { res.status(400).json({ ok:false, error:err.message }); }',
        '});',
        "app.get('/admin/descargar-backup', requireStrictAdminPage, (req, res) => {",
        '  try {',
        "    const read = (name, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); } catch (_) { return fallback; } };",
        "    const inf = read('infografias-catalog.json', {infografias:[]});",
        "    const blog = read('blog-catalog.json', {posts:[]});",
        "    const pdf = read('recursos-pdf.json', {recursos:[]});",
        "    const videosData = read('videos-catalog.json', {videos:[]});",
        "    const podcastsData = read('podcast-catalog.json', {podcasts:[]});",
        "    const santosData = read('santoral-db.json', {santos:[]});",
        "    const catePosts = (blog.posts || []).filter(p => String(p.categoria || '').toLowerCase().includes('catequesis'));",
        '    const backup = {',
        "      format:'catolicosgpt-full-backup-v2', generatedAt:new Date().toISOString(), source:'admin-download',",
        '      sections:{',
        "        infografias:{data:inf}, feCatolica:{data:blog}, catequesis:{data:{posts:catePosts}}, recursosPdf:{data:pdf}, videos:{data:videosData}, podcasts:{data:podcastsData}, santoral:{data:santosData}",
        '      }',
        '    };',
        "    const stamp = new Date().toISOString().replace(/[:.]/g, '-');",
        "    res.setHeader('Content-Type','application/json; charset=utf-8');",
        "    res.setHeader('Content-Disposition', `attachment; filename=catolicosgpt-backup-${stamp}.json`);",
        '    res.send(JSON.stringify(backup, null, 2));',
        '  } catch (err) { res.status(500).send(`No se pudo generar el backup: ${err.message}`); }',
        '});',
        '// === END STABLE ADMIN BACKUP TOOLS ===',
        ''
      ].join('\n');
      source = source.replace(middlewareAnchor, middlewareAnchor + restoreRoutes);
    }

    Module._extensions['.js'] = originalJsLoader;
    return mod._compile(source, filename);
  };
  console.log('[Stable] Recovery + scoped mobile UI + modern Infografías + backup tools installed.');
} catch (err) {
  console.error('[Stable] Server patch installation failed:', err.message);
}

require('./server');
