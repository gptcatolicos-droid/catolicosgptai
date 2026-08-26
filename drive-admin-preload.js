// CatolicosGPT — Google Drive support for infographic admin only.
// Scope: manual URL entry in Admin > Infografias. Cloudinary remains supported.
// This preload patches server.js in memory before it is compiled so public Google
// Drive share links are accepted, previewed and normalized both client- and server-side.

const fs = require('fs');
const path = require('path');

const originalReadFileSync = fs.readFileSync.bind(fs);
const serverPath = path.resolve(__dirname, 'server.js');

function transformServerSource(source) {
  let text = String(source || '');

  // Admin copy only: preserve the existing Cloudinary explorer while making Drive explicit.
  text = text
    .replace(/📥 Registrar Infografía \(URLs de Cloudinary \/ Carrusel\)/g, '📥 Registrar Infografía (Google Drive o Cloudinary / Carrusel)')
    .replace(/URL de la Imagen Cloudinary/g, 'URL de imagen (Google Drive o Cloudinary)')
    .replace(/placeholder=\"https:\/\/res\.cloudinary\.com\/\.\.\.\"/g, 'placeholder="Pega enlace público de Google Drive o URL de Cloudinary"')
    .replace(/Biblioteca Cloudinary conectada/g, 'Cloudinary legado + Google Drive')
    .replace(/Selecciona imágenes desde \$\{cloudName\}; se agregan al carrusel sin copiar URLs\./g, 'Tus imágenes existentes de Cloudinary siguen disponibles. Para contenido nuevo, pega enlaces públicos de Google Drive en los campos de cada diapositiva.')
    .replace(/Sube o ingresa múltiples imágenes de tu carrusel e incorpora meta-descripciones y palabras clave optimizadas por Inteligencia Artificial\./g, 'Ingresa hasta 10 imágenes por carrusel. Para contenido nuevo pega enlaces públicos de archivos de Google Drive; las URLs existentes de Cloudinary siguen funcionando.')
    .replace(/Falta información requerida o no has seleccionado ninguna imagen de Cloudinary\./g, 'Falta información requerida o no has ingresado ninguna URL de imagen de Google Drive o Cloudinary.');

  // Server-side normalizer. This is authoritative and works even if browser JS fails.
  const routeMarker = "// ACCIÓN: CREAR INFOGRAFÍA MANUALMENTE CON CAMPOS DE SEO E IMÁGENES MÚLTIPLES (CARRUSEL)";
  if (text.includes(routeMarker) && !text.includes('function normalizeInfografiaImageUrl(rawUrl)')) {
    const serverHelper = `function normalizeInfografiaImageUrl(rawUrl) {\n  const value = String(rawUrl || '').trim();\n  if (!value) return '';\n  let fileId = '';\n  try {\n    const parsed = new URL(value);\n    const host = String(parsed.hostname || '').toLowerCase();\n    if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {\n      const fileMatch = parsed.pathname.match(/\\/file\\/d\\/([^/]+)/i) || parsed.pathname.match(/\\/d\\/([^/]+)/i);\n      fileId = (fileMatch && fileMatch[1]) || parsed.searchParams.get('id') || '';\n    }\n  } catch (_) {}\n  if (!fileId) return value;\n  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w2400';\n}\n\n`;
    text = text.replace(routeMarker, serverHelper + routeMarker);
  }

  // Normalize each manually submitted image on the backend before validation/storage.
  text = text.replace(
    "      url: String(url || '').trim(),",
    "      url: normalizeInfografiaImageUrl(url),"
  );

  // Browser-side normalizer immediately before the existing preview function.
  const previewMarker = '          function previewImage(rowId) {';
  if (text.includes(previewMarker) && !text.includes('function normalizeGoogleDriveImageUrl(rawUrl)')) {
    const helper = `          function normalizeGoogleDriveImageUrl(rawUrl) {\n            const value = String(rawUrl || '').trim();\n            if (!value) return '';\n            let fileId = '';\n            try {\n              const parsed = new URL(value);\n              const host = String(parsed.hostname || '').toLowerCase();\n              if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {\n                const fileMatch = parsed.pathname.match(/\\/file\\/d\\/([^/]+)/i) || parsed.pathname.match(/\\/d\\/([^/]+)/i);\n                fileId = (fileMatch && fileMatch[1]) || parsed.searchParams.get('id') || '';\n              }\n            } catch (e) {}\n            if (!fileId) return value;\n            return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w2400';\n          }\n\n`;
    text = text.replace(previewMarker, helper + previewMarker);
  }

  // Preview Drive links without modifying the text currently being typed.
  text = text.replace(
    '              if (previewImg) previewImg.src = url;',
    '              if (previewImg) previewImg.src = normalizeGoogleDriveImageUrl(url);'
  );

  // Normalize visible inputs before submit as a second layer; backend still validates again.
  const seoMarker = '          async function generarSeoConIA() {';
  if (text.includes(seoMarker) && !text.includes('normalizeDriveInputsBeforeSubmit')) {
    const submitHelper = `          function normalizeDriveInputsBeforeSubmit() {\n            document.querySelectorAll('#infografiaManualForm input[name="imageUrls[]"]').forEach(function(input) {\n              const normalized = normalizeGoogleDriveImageUrl(input.value);\n              if (normalized) input.value = normalized;\n            });\n          }\n\n          const driveAwareInfografiaForm = document.getElementById('infografiaManualForm');\n          if (driveAwareInfografiaForm && !driveAwareInfografiaForm.dataset.driveNormalizeBound) {\n            driveAwareInfografiaForm.dataset.driveNormalizeBound = '1';\n            driveAwareInfografiaForm.addEventListener('submit', normalizeDriveInputsBeforeSubmit);\n          }\n\n`;
    text = text.replace(seoMarker, submitHelper + seoMarker);
  }

  // Make reset copy consistent as well.
  text = text.replace(
    "document.getElementById('infografia-form-title').innerText = '📥 Registrar Infografía (URLs de Cloudinary / Carrusel)';",
    "document.getElementById('infografia-form-title').innerText = '📥 Registrar Infografía (Google Drive o Cloudinary / Carrusel)';"
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
