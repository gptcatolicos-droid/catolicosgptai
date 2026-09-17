// CatolicosGPT — normalización de enlaces de Google Drive en el admin.
//
// Un enlace de Drive copiado del navegador apunta a una página, no a la imagen.
// Aquí se convierte en la URL directa del fichero ANTES de guardarlo, en el
// servidor, para no tocar los controles del admin que ya funcionan.
// Las URLs de Cloudinary guardadas hace tiempo siguen sirviéndose tal cual: el
// código de Cloudinary se retira, los datos de los usuarios no.

const fs = require('fs');
const path = require('path');

const originalReadFileSync = fs.readFileSync.bind(fs);
const serverPath = path.resolve(__dirname, 'server.js');

function transformServerSource(source) {
  let text = String(source || '');

  // Los textos del admin ya no se reescriben aquí. Estaban en este parche una
  // docena de .replace que cambiaban "Cloudinary" por otra cosa sobre la marcha,
  // así que el HTML que se veía en el navegador no coincidía con el de
  // server.js y depurarlo era adivinar. La copia correcta vive ahora en
  // server.js, escrita una vez. Aquí queda solo lo que no puede estar allí: la
  // normalización de enlaces de Drive antes de guardarlos.

  // Authoritative backend normalizer. This keeps the existing browser JS untouched.
  const routeMarker = "// ACCIÓN: CREAR INFOGRAFÍA MANUALMENTE CON CAMPOS DE SEO E IMÁGENES MÚLTIPLES (CARRUSEL)";
  if (text.includes(routeMarker) && !text.includes('function normalizeInfografiaImageUrl(rawUrl)')) {
    const serverHelper = `function normalizeInfografiaImageUrl(rawUrl) {\n  const value = String(rawUrl || '').trim();\n  if (!value) return '';\n  let fileId = '';\n  try {\n    const parsed = new URL(value);\n    const host = String(parsed.hostname || '').toLowerCase();\n    if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {\n      const fileMatch = parsed.pathname.match(/\\/file\\/d\\/([^/]+)/i) || parsed.pathname.match(/\\/d\\/([^/]+)/i);\n      fileId = (fileMatch && fileMatch[1]) || parsed.searchParams.get('id') || '';\n    }\n  } catch (_) {}\n  if (!fileId) return value;\n  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w2400';\n}\n\n`;
    text = text.replace(routeMarker, serverHelper + routeMarker);
  }

  // Normalize each manually submitted image before validation/storage.
  // This preserves Google Drive manual URL support while leaving all client-side
  // functions exactly as they were in server.js.
  text = text.replace(
    "      url: String(url || '').trim(),",
    "      url: normalizeInfografiaImageUrl(url),"
  );

  return text;
}

fs.readFileSync = function patchedReadFileSync(file, options) {
  const result = originalReadFileSync(file, options);
  let resolved = '';
  try { resolved = path.resolve(String(file)); } catch (_) {}
  if (resolved !== serverPath) return result;

  const encoding = typeof options === 'string'
    ? options
    : (options && typeof options === 'object' ? options.encoding : null);
  const originalWasBuffer = Buffer.isBuffer(result);
  const transformed = transformServerSource(originalWasBuffer ? result.toString(encoding || 'utf8') : result);
  return originalWasBuffer && !encoding ? Buffer.from(transformed, 'utf8') : transformed;
};

module.exports = { installed: true, transformServerSource };
