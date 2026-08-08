const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');
let changed = false;

const staticMarker = "// === LOCAL TAILWIND STATIC ASSETS ===";
if (!source.includes(staticMarker)) {
  const middlewareAnchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
  if (!source.includes(middlewareAnchor)) {
    throw new Error('[CSS] No se encontró el ancla de middleware de Express.');
  }

  const staticMiddleware = `${middlewareAnchor}\n\n${staticMarker}\napp.use('/assets', express.static(path.join(__dirname, 'public'), {\n  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,\n  immutable: false\n}));`;
  source = source.replace(middlewareAnchor, staticMiddleware);
  changed = true;
}

const localCssLink = '<link rel="stylesheet" href="/assets/tailwind.css">';
const cdnScript = '<script src="https://cdn.tailwindcss.com"></script>';
if (!source.includes(localCssLink)) {
  if (!source.includes(cdnScript)) {
    throw new Error('[CSS] No se encontró la carga actual de Tailwind CDN.');
  }
  source = source.replace(cdnScript, `${localCssLink}\n  ${cdnScript}`);
  changed = true;
}

// Si el CDN no carga, no debe lanzar ReferenceError ni detener scripts posteriores.
if (source.includes('    tailwind.config = {') && !source.includes('    if (window.tailwind) tailwind.config = {')) {
  source = source.replace('    tailwind.config = {', '    if (window.tailwind) tailwind.config = {');
  changed = true;
}

if (changed) {
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[CSS] server.js preparado para CSS local con CDN como respaldo.');
} else {
  console.log('[CSS] Preparación ya aplicada; no se requieren cambios.');
}

const cssPath = path.join(__dirname, 'public', 'tailwind.css');
if (!fs.existsSync(cssPath)) {
  console.warn('[CSS] public/tailwind.css aún no existe. Debe generarse con npm run build:css durante el build.');
} else {
  const size = fs.statSync(cssPath).size;
  console.log(`[CSS] Bundle local listo: ${size} bytes.`);
}
