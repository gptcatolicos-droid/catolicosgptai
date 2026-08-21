// CatolicosGPT recovery bootstrap — 2026-08-21
// Recovery is isolated from server.js. It preserves the existing app and adds one admin-only restore path.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) { return {}; }
}

// Keep the previous conservative bundled restore as a first recovery layer.
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

// /ninos must never block on Firestore/Drive. Render local restored content first.
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

// Patch server.js only in memory. No server.js file is modified.
try {
  const serverPath = require.resolve('./server');
  const originalJsLoader = Module._extensions['.js'];
  Module._extensions['.js'] = function recoveryLoader(mod, filename) {
    if (filename !== serverPath) return originalJsLoader(mod, filename);
    let source = fs.readFileSync(filename, 'utf8');

    // 1) Hide only the four requested navigation links. Their routes/data remain untouched.
    for (const route of ['/oraciones', '/videos', '/podcasts', '/misas']) {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const anchor = new RegExp(`<a\\s+href=["']${escaped}["'][\\s\\S]*?<\\/a>`, 'g');
      source = source.replace(anchor, '');
    }

    // 2) Add a strict-admin-only one-time restore UI and endpoint.
    const middlewareAnchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
    if (source.includes(middlewareAnchor) && !source.includes("/admin/restaurar-backup")) {
      const restoreRoutes = String.raw`

// === RECOVERY: FULL BACKUP IMPORT (admin-only) ===
const backupRestore = require('./backup-restore-module');
app.get('/admin/restaurar-backup', requireStrictAdminPage, (req, res) => {
  res.type('html').send(` + "`" + String.raw`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Restaurar Backup · CatólicosGPT</title><style>body{font-family:Arial,sans-serif;background:#f7f3ed;color:#3b2415;margin:0;padding:40px}.card{max-width:760px;margin:auto;background:#fff;border:1px solid #e6dfd4;border-radius:18px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,.06)}h1{color:#6d1922}.warn{background:#fff5e5;border:1px solid #d8ad58;padding:14px;border-radius:10px;margin:18px 0}button{background:#6d1922;color:white;border:0;border-radius:10px;padding:13px 20px;font-weight:700;cursor:pointer}input{display:block;margin:20px 0;width:100%}pre{white-space:pre-wrap;background:#f5f5f5;padding:15px;border-radius:10px;max-height:360px;overflow:auto}</style></head><body><div class="card"><h1>Restaurar backup completo</h1><p>Selecciona el archivo JSON de backup de CatólicosGPT. El sistema valida los conteos y hace merge: no borra contenido actual.</p><div class="warn"><strong>Backup esperado:</strong> al menos 40 infografías, 2.000 contenidos de Fe Católica, 5 PDFs y 300 santos.</div><input id="file" type="file" accept="application/json,.json"><button id="go">Validar y restaurar</button><pre id="out">Esperando archivo…</pre></div><script>const f=document.getElementById('file'),o=document.getElementById('out'),b=document.getElementById('go');b.onclick=async()=>{if(!f.files[0]){o.textContent='Selecciona el backup JSON.';return}b.disabled=true;o.textContent='Leyendo y enviando backup…';try{const text=await f.files[0].text();JSON.parse(text);const r=await fetch('/admin/restaurar-backup',{method:'POST',headers:{'Content-Type':'application/json'},body:text});const t=await r.text();let v;try{v=JSON.parse(t)}catch(_){v={ok:false,response:t}}o.textContent=JSON.stringify(v,null,2);if(!r.ok)throw new Error(v.error||'Error HTTP '+r.status)}catch(e){o.textContent+='\n\nERROR: '+e.message}finally{b.disabled=false}};</script></body></html>` + "`" + String.raw`);
});
app.post('/admin/restaurar-backup', requireStrictAdminPage, (req, res) => {
  try {
    const result = backupRestore.restoreBackup(req.body);
    const inf = require('./infografias-module').loadCatalog();
    const pdf = require('./recursos-pdf-module').loadCatalog();
    const blog = readJson(path.join(DATA_DIR, 'blog-catalog.json'));
    const saints = readJson(path.join(DATA_DIR, 'santoral-db.json'));
    const live = {
      infografias: Array.isArray(inf.infografias) ? inf.infografias.length : 0,
      recursosPdf: Array.isArray(pdf.recursos) ? pdf.recursos.length : 0,
      feCatolica: Array.isArray(blog.posts) ? blog.posts.length : 0,
      santoral: Array.isArray(saints.santos) ? saints.santos.length : 0
    };
    console.log('[Full Backup Restore] LIVE COUNTS', JSON.stringify(live));
    res.json({ ...result, live });
  } catch (err) {
    console.error('[Full Backup Restore] FAILED', err);
    res.status(400).json({ ok:false, error:err.message });
  }
});
// === END RECOVERY ===
`;
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
