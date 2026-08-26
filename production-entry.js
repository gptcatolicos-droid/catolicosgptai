// CatolicosGPT production entrypoint — stable recovery + deterministic local CSS.
// Presentation is delivered from a compiled local Tailwind bundle so mobile does
// not depend on cdn.tailwindcss.com. Recovery/admin/content remain in stable-start.

try {
  require('./local-tailwind-runtime');
} catch (err) {
  console.warn('[Production] Local Tailwind runtime unavailable:', err.message);
}

// Recover missing infographic records additively. Existing/current records win,
// so this cannot erase newer Google Drive or Cloudinary content.
try {
  require('./infografias-safe-recovery').restoreInfografiasSafely();
} catch (err) {
  console.warn('[Production] Safe infographic recovery skipped:', err.message);
}

// Stable-start remains the authoritative bootstrap for backup/admin/content tools.
require('./stable-start');
