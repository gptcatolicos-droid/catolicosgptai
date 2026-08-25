// CatolicosGPT production entrypoint — stable recovery + deterministic UI.
// No runtime source surgery is done here. The UI guard only injects presentation
// CSS/JS into server.js while stable-start keeps recovery, backup and admin tools.

// Install presentation guard first so stable-start's server load receives the
// deterministic mobile styles without depending on Tailwind/CDN timing.
try {
  require('./ui-regression-guard');
} catch (err) {
  console.warn('[Production] UI regression guard unavailable:', err.message);
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
