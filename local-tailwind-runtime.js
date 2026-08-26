// CatolicosGPT deterministic CSS bootstrap.
// Purpose: make the UI independent from cdn.tailwindcss.com at runtime.
// It changes presentation delivery only; no catalogs, auth, backup or content data.
const fs = require('fs');
const path = require('path');

if (!global.__CGPT_LOCAL_TAILWIND_RUNTIME__) {
  global.__CGPT_LOCAL_TAILWIND_RUNTIME__ = true;

  const serverPath = require.resolve('./server');
  const originalReadFileSync = fs.readFileSync.bind(fs);

  fs.readFileSync = function cgptLocalTailwindRead(file, ...args) {
    const result = originalReadFileSync(file, ...args);
    try {
      const resolved = path.resolve(String(file));
      const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
      if (resolved !== path.resolve(serverPath) || !encoding) return result;

      let source = String(result);
      const middlewareAnchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
      const staticMarker = '// __CGPT_LOCAL_TAILWIND_STATIC__';
      if (source.includes(middlewareAnchor) && !source.includes(staticMarker)) {
        const staticRoute = `\n${staticMarker}\napp.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h', immutable: false }));\n`;
        source = source.replace(middlewareAnchor, middlewareAnchor + staticRoute);
      }

      const cdnScript = '<script src="https://cdn.tailwindcss.com"></script>';
      const localCss = '<link rel="stylesheet" href="/assets/tailwind.css?v=20260826">';
      if (!source.includes(localCss)) {
        if (source.includes(cdnScript)) source = source.replace(cdnScript, `${localCss}\n  ${cdnScript}`);
        else if (source.includes('</head>')) source = source.replace('</head>', `  ${localCss}\n</head>`);
      }

      // If the CDN is blocked/slow, its missing global must not abort later scripts.
      if (source.includes('tailwind.config = {') && !source.includes('if (window.tailwind) tailwind.config = {')) {
        source = source.replace('tailwind.config = {', 'if (window.tailwind) tailwind.config = {');
      }

      return source;
    } catch (_) {
      return result;
    }
  };
}

module.exports = { installed: true };
