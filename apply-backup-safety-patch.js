const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');

const routeAnchor = "app.get('/admin/backup-completo', (req, res) => {";
const asyncRouteAnchor = "app.get('/admin/backup-completo', async (req, res) => {";
const authAnchor = "  if (!isStrictAdminUser(user)) return res.status(403).send('No autorizado');";
const hydrateBlock = `\n\n  // BACKUP SAFETY: antes de exportar, recuperar la versión persistente en Firestore.\n  // Así el backup no depende del filesystem efímero de Cloud Run.\n  try {\n    const { hydrateContent } = require('./hydrate-content-from-firestore');\n    await hydrateContent({ reason: 'admin-backup' });\n  } catch (err) {\n    console.warn('[Backup] No se pudo hidratar todo el contenido antes de exportar:', err.message);\n  }`;

if (source.includes("// BACKUP SAFETY: antes de exportar")) {
  console.log('[Backup Patch] Ya estaba aplicado.');
  process.exit(0);
}

if (source.includes(routeAnchor)) {
  source = source.replace(routeAnchor, asyncRouteAnchor);
} else if (!source.includes(asyncRouteAnchor)) {
  throw new Error('No se encontró la ruta /admin/backup-completo.');
}

const routeIndex = source.indexOf(asyncRouteAnchor);
const authIndex = source.indexOf(authAnchor, routeIndex);
if (routeIndex === -1 || authIndex === -1) {
  throw new Error('No se encontró el control de autorización del backup.');
}

const insertAt = authIndex + authAnchor.length;
source = source.slice(0, insertAt) + hydrateBlock + source.slice(insertAt);

fs.writeFileSync(serverPath, source, 'utf8');
console.log('[Backup Patch] Backup cloud-first aplicado.');
