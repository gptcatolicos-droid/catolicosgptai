// CatolicosGPT recovery bootstrap — 2026-08-21
// Keeps server.js untouched and adds only recovery protections around it.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

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
  console.log('[Recovery] Menu filter + protected backup importer installed.');
} catch (err) {
  console.error('[Recovery] Server patch installation failed:', err.message);
}

require('./server');
