// CatolicosGPT production entrypoint — stable recovery + deterministic local CSS.
// Presentation is delivered from a compiled local Tailwind bundle so mobile does
// not depend on cdn.tailwindcss.com. Recovery/admin/content remain in stable-start.

// LO PRIMERO DE TODO: sembrar el disco persistente. Un disco recién creado está
// vacío, y cualquier módulo que lea DATA_DIR antes de esto vería un sitio sin
// usuarios ni catálogos. Tiene que ir por delante de todo lo demás.
try {
  require('./data-dir-seed').seedDataDir();
} catch (err) {
  console.warn('[Production] No se pudo sembrar el disco de datos:', err.message);
}

try {
  require('./local-tailwind-runtime');
} catch (err) {
  console.warn('[Production] Local Tailwind runtime unavailable:', err.message);
}

// Enable manual Google Drive image URLs in Admin > Infografias before server.js
// is compiled. Cloudinary remains fully supported.
try {
  require('./drive-admin-preload');
} catch (err) {
  console.warn('[Production] Google Drive admin preload unavailable:', err.message);
}

// Release-scoped hotfix: preserve daily selections across deployments, keep
// infographics newest-first and remove only the Fe Catolica index search panel.
try {
  require('./release-content-hotfix-20260827');
} catch (err) {
  console.warn('[Production] Release content hotfix unavailable:', err.message);
}

// Recover missing infographic records additively. Existing/current records win,
// so this cannot erase newer Google Drive or Cloudinary content.
try {
  require('./infografias-safe-recovery').restoreInfografiasSafely();
} catch (err) {
  console.warn('[Production] Safe infographic recovery skipped:', err.message);
}

// Publish the verified Santa Bernardita carousel additively into the persistent
// infographic catalog. Existing records are preserved and the item is idempotent.
try {
  require('./publish-santa-bernardita').publishSantaBernardita();
} catch (err) {
  console.warn('[Production] Santa Bernardita publication skipped:', err.message);
}

// Publish Historia de la Iglesia — Siglos I al X additively. Existing records
// are preserved, Drive URLs remain authoritative, and the item is idempotent.
try {
  require('./publish-historia-iglesia-siglos-i-x').publishHistoriaIglesia();
} catch (err) {
  console.warn('[Production] Historia de la Iglesia I-X publication skipped:', err.message);
}

// Publish Historia de la Iglesia — Siglos XI al XX additively. Existing records
// are preserved, Drive URLs remain authoritative, and the item is idempotent.
try {
  require('./publish-historia-iglesia-siglos-xi-xx').publishHistoriaIglesiaXIXX();
} catch (err) {
  console.warn('[Production] Historia de la Iglesia XI-XX publication skipped:', err.message);
}

// Seed the 20 verified children's Bible coloring resources into the local
// infographic catalog. The seed is additive/idempotent and keeps existing items.
try {
  require('./ninos-seed-20260916');
} catch (err) {
  console.warn('[Production] Niños coloring resources seed skipped:', err.message);
}

// Show recovered Drive images immediately, even before the background cloud sync.
// The cloud sync subsequently persists the same exact-URL replacements in Firestore.
try {
  const driveMigration = require('./drive-infografias-migration');
  const driveResult = driveMigration.restoreLocalDriveUrls();
  const firebaseSync = require('./firebase-module');
  driveMigration.persistDriveChanges(firebaseSync.db, driveResult.changes).catch(err =>
    console.warn('[Production] Infographic Firestore migration pending:', err.message)
  );
} catch (err) {
  console.warn('[Production] Local Drive infographic recovery skipped:', err.message);
}

// Restore the seven verified 16:9 PDF banners locally and persist only exact
// broken Cloudinary matches in Firestore.
try {
  const pdfCovers = require('./drive-pdf-covers-migration');
  pdfCovers.restoreLocalPdfCoverUrls();
  pdfCovers.persistPdfCoverUrls().catch(err =>
    console.warn('[Production] PDF cover Firestore migration pending:', err.message)
  );
} catch (err) {
  console.warn('[Production] Local PDF cover recovery skipped:', err.message);
}

// Mobile-only presentation refinement. This patch does not touch content/admin data
// and is installed before stable-start compiles server.js.
try {
  require('./mobile-minimal-ux-20260915');
} catch (err) {
  console.warn('[Production] Mobile minimal UX patch unavailable:', err.message);
}

// Stable-start remains the authoritative bootstrap for backup/admin/content tools.
require('./stable-start');
