// CatolicosGPT — Google Drive support for infographic admin only.
// This preload does NOT modify stored data, catalogs, styles, routes or Cloudinary assets.
// It only adjusts the server source in memory so the existing imageUrls[] fields accept
// public Google Drive share links and normalize them to embeddable image URLs on submit.

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
    .replace(/Sube o ingresa múltiples imágenes de tu carrusel e incorpora meta-descripciones y palabras clave optimizadas por Inteligencia Artificial\./g, 'Ingresa hasta 10 imágenes por carrusel. Puedes usar enlaces públicos de Google Drive para contenido nuevo o conservar las URLs existentes de Cloudinary.');

  // Add a browser-side normalizer immediately before the existing preview function.
  const previewMarker = '          function previewImage(rowId) {';
  if (text.includes(previewMarker) && !text.includes('function normalizeGoogleDriveImageUrl(rawUrl)')) {
    const helper = `          function normalizeGoogleDriveImageUrl(rawUrl) {\n            const value = String(rawUrl || '').trim();\n            if (!value) return '';\n            let fileId = '';\n            try {\n              const parsed = new URL(value);\n              const host = String(parsed.hostname || '').toLowerCase();\n              if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {\n                const fileMatch = parsed.pathname.match(/\\/file\\/d\\/([^/]+)/i) || parsed.pathname.match(/\\/d\\/([^/]+)/i);\n                fileId = (fileMatch && fileMatch[1]) || parsed.searchParams.get('id') || '';\n              }\n            } catch (e) {}\n            if (!fileId) return value;\n            return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w2400';\n          }\n\n`;
    text = text.replace(previewMarker, helper + previewMarker);
  }

  // Preview Drive links without changing what the admin is currently typing.
  text = text.replace(
    '              if (previewImg) previewImg.src = url;',
    '              if (previewImg) previewImg.src = normalizeGoogleDriveImageUrl(url);'
  );

  // Normalize Drive share URLs to an embeddable URL only at submit time.
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
