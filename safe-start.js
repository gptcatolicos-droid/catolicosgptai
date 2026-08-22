// CatolicosGPT recovery bootstrap — 2026-08-22
// Keeps server.js untouched and adds recovery protections + a local responsive fallback.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

// Critical CSS fallback. It is intentionally local and small: if Tailwind CDN fails,
// mobile remains usable instead of rendering raw/oversized HTML and SVGs.
const CRITICAL_MOBILE_CSS = `
<style id="catolicosgpt-critical-mobile-fallback">
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; max-width: 100%; overflow-x: hidden; }
  body { background: #F9F6F0; color: #2D241E; }
  img { max-width: 100%; height: auto; }
  button, input, select, textarea { font: inherit; }
  .hidden { display: none !important; }

  @media (min-width: 768px) {
    body > header { display: none !important; }
  }

  @media (max-width: 767px) {
    body { min-height: 100svh; }

    /* Mobile header must work even without Tailwind utilities. */
    body > header {
      position: sticky !important;
      top: 0 !important;
      z-index: 900 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      width: 100% !important;
      min-height: 72px !important;
      padding: 12px 16px !important;
      background: rgba(255,255,255,.98) !important;
      border-bottom: 1px solid #E6DFD4 !important;
      box-shadow: 0 2px 10px rgba(37,27,21,.06) !important;
    }
    body > header > div {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      min-width: 0 !important;
    }
    body > header button {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 42px !important;
      height: 42px !important;
      padding: 8px !important;
      border: 0 !important;
      border-radius: 12px !important;
      background: transparent !important;
      color: #251B15 !important;
    }
    body > header button svg { width: 24px !important; height: 24px !important; max-width: 24px !important; flex: 0 0 24px !important; }
    body > header a { text-decoration: none !important; }
    body > header a > svg { width: 30px !important; height: 30px !important; max-width: 30px !important; flex: 0 0 30px !important; }
    body > header a span { font-size: 18px !important; line-height: 1 !important; white-space: nowrap !important; }
    body > header a[href="/login"] {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-height: 40px !important;
      padding: 0 18px !important;
      border-radius: 999px !important;
      background: #5E1B22 !important;
      color: #fff !important;
      font-size: 14px !important;
      font-weight: 700 !important;
    }

    /* Desktop sidebar cannot leak into the mobile viewport. */
    .sidebar-desktop { display: none !important; }

    /* The top-level shell remains a single mobile column. */
    body > div.flex.flex-1.h-full.overflow-hidden {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      min-height: calc(100svh - 72px) !important;
      overflow: visible !important;
    }
    main {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      min-height: calc(100svh - 72px) !important;
      overflow-x: hidden !important;
      overflow-y: visible !important;
    }
    main > div {
      width: 100% !important;
      max-width: 100% !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 16px !important;
      padding-right: 16px !important;
    }
    main h1 {
      max-width: 100% !important;
      margin-top: 0 !important;
      font-size: clamp(2rem, 9vw, 3rem) !important;
      line-height: 1.06 !important;
      overflow-wrap: anywhere !important;
    }
    main h2 { font-size: clamp(1.35rem, 6vw, 2rem) !important; line-height: 1.12 !important; }
    main p { max-width: 100% !important; font-size: 1rem !important; line-height: 1.55 !important; overflow-wrap: anywhere !important; }

    /* Common Tailwind layout semantics needed by content pages. */
    main .grid { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; gap: 16px !important; }
    main .flex-col { display: flex !important; flex-direction: column !important; }
    main .flex-wrap { display: flex !important; flex-wrap: wrap !important; }
    main .items-center { align-items: center !important; }
    main .justify-between { justify-content: space-between !important; }

    /* Search/filter controls should never fall back to browser-blue raw controls. */
    main form {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    main form input[type="text"], main form input[type="search"] {
      flex: 1 1 190px !important;
      min-width: 0 !important;
      min-height: 42px !important;
      padding: 9px 14px !important;
      border: 1px solid #D8D0C5 !important;
      border-radius: 999px !important;
      background: #fff !important;
      color: #2D241E !important;
      outline: none !important;
    }
    main form button, main button[type="submit"] {
      min-height: 42px !important;
      padding: 9px 18px !important;
      border: 0 !important;
      border-radius: 999px !important;
      background: #5E1B22 !important;
      color: #fff !important;
      font-weight: 700 !important;
      appearance: none !important;
      -webkit-appearance: none !important;
    }
    main a[href*="categoria="] {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-height: 34px !important;
      padding: 7px 13px !important;
      margin: 2px !important;
      border: 1px solid #E6DFD4 !important;
      border-radius: 999px !important;
      background: #fff !important;
      color: #5E1B22 !important;
      text-decoration: none !important;
      font-size: 12px !important;
      font-weight: 700 !important;
    }

    /* Cards and media remain inside the viewport. */
    .seo-card {
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      max-width: 100% !important;
      overflow: hidden !important;
      padding: 16px !important;
      border: 1px solid #E6DFD4 !important;
      border-radius: 18px !important;
      background: #fff !important;
      box-shadow: 0 4px 16px rgba(37,27,21,.05) !important;
    }
    .seo-card img { display: block !important; width: 100% !important; max-width: 100% !important; height: auto !important; object-fit: cover !important; border-radius: 12px !important; }

    /* Closed drawer is truly invisible without Tailwind; JS class toggles still work. */
    #mobile-drawer {
      position: fixed !important;
      inset: 0 !important;
      z-index: 1000 !important;
      background: rgba(0,0,0,.48) !important;
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity .2s ease !important;
    }
    #mobile-drawer.opacity-100 { opacity: 1 !important; pointer-events: auto !important; }
    #mobile-drawer-content {
      width: min(82vw, 320px) !important;
      max-width: 320px !important;
      height: 100% !important;
      padding: 0 !important;
      background: #fff !important;
      transform: translateX(-100%) !important;
      transition: transform .2s ease !important;
      overflow-y: auto !important;
      box-shadow: 8px 0 24px rgba(0,0,0,.14) !important;
    }
    #mobile-drawer-content.translate-x-0 { transform: translateX(0) !important; }
    #mobile-drawer-content svg { width: 24px !important; height: 24px !important; max-width: 24px !important; }
    #mobile-drawer-content nav { display: flex !important; flex-direction: column !important; gap: 4px !important; }
    #mobile-drawer-content .nav-link {
      display: block !important;
      padding: 10px 12px !important;
      border-radius: 10px !important;
      color: #2D241E !important;
      text-decoration: none !important;
      font-size: 14px !important;
    }

    /* Chat remains usable if utilities fail. */
    .chat-shell { width: 100% !important; max-width: 100% !important; min-height: calc(100svh - 72px) !important; }
    .chat-input-wrap { position: sticky !important; bottom: 0 !important; width: 100% !important; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)) !important; background: rgba(255,255,255,.98) !important; z-index: 50 !important; }
    .chat-input-wrap form { display: flex !important; flex-wrap: nowrap !important; align-items: center !important; gap: 8px !important; }
  }
</style>`;

// Existing lightweight bundled fallback for Infografías/PDF and hidden media.
try {
  require('./bootstrap-content-restore').restoreBundledCatalogs();
  console.log('[Recovery] Bundled Infografías/PDF restore executed.');
} catch (err) {
  console.warn('[Recovery] Bundled Infografías/PDF restore skipped:', err.message);
}
try {
  require('./bootstrap-hidden-content-restore').restoreHiddenCatalogs();
  console.log('[Recovery] Bundled Video/Podcast restore executed.');
} catch (err) {
  console.warn('[Recovery] Bundled Video/Podcast restore skipped:', err.message);
}

// /ninos must render local content immediately; cloud refresh runs in background.
try {
  const recursosPdf = require('./recursos-pdf-module');
  if (recursosPdf && typeof recursosPdf.refreshFromCloud === 'function') {
    const originalRefresh = recursosPdf.refreshFromCloud.bind(recursosPdf);
    recursosPdf.refreshFromCloud = async function recoveryRefresh(...args) {
      Promise.resolve().then(() => originalRefresh(...args)).catch(err =>
        console.warn('[Recovery] PDF background refresh:', err.message)
      );
      try { return recursosPdf.loadCatalog(); }
      catch (_) { return { recursos: [] }; }
    };
  }
} catch (err) {
  console.warn('[Recovery] /ninos background protection unavailable:', err.message);
}

// Patch server.js only in memory. The source file itself is never modified.
try {
  const serverPath = require.resolve('./server');
  const originalJsLoader = Module._extensions['.js'];
  Module._extensions['.js'] = function recoveryLoader(mod, filename) {
    if (filename !== serverPath) return originalJsLoader(mod, filename);
    let source = fs.readFileSync(filename, 'utf8');

    // Hide only the four requested navigation links; routes and data remain available.
    for (const route of ['/oraciones', '/videos', '/podcasts', '/misas']) {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const anchor = new RegExp(`<a\\s+href=["']${escaped}["'][\\s\\S]*?<\\/a>`, 'g');
      source = source.replace(anchor, '');
    }

    // Inject a local responsive safety net before </head>. It does not replace Tailwind;
    // it only guarantees a usable mobile layout when the external CDN is unavailable.
    if (!source.includes('catolicosgpt-critical-mobile-fallback')) {
      source = source.replace('</head>', CRITICAL_MOBILE_CSS + '\n</head>');
    }

    // Add protected full-backup restore routes immediately after body parsers.
    const middlewareAnchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
    if (source.includes(middlewareAnchor) && !source.includes("/admin/restaurar-backup")) {
      const restoreRoutes = [
        '',
        '// === RECOVERY: FULL BACKUP IMPORT (admin-only) ===',
        "const backupRestore = require('./backup-restore-module');",
        "app.get('/admin/restaurar-backup', requireStrictAdminPage, (req, res) => {",
        "  try { res.type('html').send(fs.readFileSync(path.join(__dirname, 'backup-restore-page.html'), 'utf8')); }",
        "  catch (err) { res.status(500).send('No se pudo cargar la herramienta de restauración.'); }",
        '});',
        "app.post('/admin/restaurar-backup', requireStrictAdminPage, (req, res) => {",
        '  try {',
        '    const result = backupRestore.restoreBackup(req.body);',
        "    const inf = require('./infografias-module').loadCatalog();",
        "    const pdf = require('./recursos-pdf-module').loadCatalog();",
        "    const blog = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'blog-catalog.json'), 'utf8')); } catch (_) { return {}; } })();",
        "    const saints = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'santoral-db.json'), 'utf8')); } catch (_) { return {}; } })();",
        '    const live = {',
        '      infografias: Array.isArray(inf.infografias) ? inf.infografias.length : 0,',
        '      recursosPdf: Array.isArray(pdf.recursos) ? pdf.recursos.length : 0,',
        '      feCatolica: Array.isArray(blog.posts) ? blog.posts.length : 0,',
        '      santoral: Array.isArray(saints.santos) ? saints.santos.length : 0',
        '    };',
        "    console.log('[Full Backup Restore] LIVE COUNTS', JSON.stringify(live));",
        '    res.json({ ...result, live });',
        '  } catch (err) {',
        "    console.error('[Full Backup Restore] FAILED', err.message);",
        '    res.status(400).json({ ok:false, error:err.message });',
        '  }',
        '});',
        '// === END RECOVERY ===',
        ''
      ].join('\n');
      source = source.replace(middlewareAnchor, middlewareAnchor + restoreRoutes);
    }

    Module._extensions['.js'] = originalJsLoader;
    return mod._compile(source, filename);
  };
  console.log('[Recovery] Menu filter + backup importer + mobile CSS fallback installed.');
} catch (err) {
  console.error('[Recovery] Server patch installation failed:', err.message);
}

require('./server');
