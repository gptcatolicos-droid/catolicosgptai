const fs = require('fs');
const path = require('path');

const firebase = require('./firebase-module');

const backupPath = process.argv[2] || process.env.CATOLICOSGPT_BACKUP;
if (!backupPath) {
  console.error('Uso: node restore-backup-to-firestore.js /ruta/backup.json');
  process.exit(2);
}

function getBackup(file) {
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const backup = JSON.parse(raw);
  if (!backup || backup.app !== 'CatolicosGPT' || !backup.sections) {
    throw new Error('El archivo no parece ser un backup válido de CatolicosGPT.');
  }
  return backup;
}

function sectionData(backup, key) {
  return backup.sections?.[key]?.data || {};
}

async function existingKeys(downloadFn, keyFn) {
  const cloud = await downloadFn([]);
  return new Set((cloud || []).map(keyFn).filter(Boolean));
}

async function restoreMissing(label, items, existing, keyFn, uploadFn, concurrency = 6) {
  const pending = (items || []).filter(item => {
    const k = keyFn(item);
    return k && !existing.has(k);
  });

  console.log(`[Restore] ${label}: backup=${(items || []).length}, ya_en_cloud=${existing.size}, faltantes=${pending.length}`);
  let ok = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= pending.length) return;
      const item = pending[index];
      try {
        await uploadFn(item);
        ok++;
        if (ok % 50 === 0) console.log(`[Restore] ${label}: ${ok}/${pending.length} restaurados`);
      } catch (err) {
        failed++;
        console.error(`[Restore] ${label}: error en ${keyFn(item)}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, worker));
  return { backup: (items || []).length, already: existing.size, restored: ok, failed };
}

(async () => {
  const backup = getBackup(backupPath);
  console.log(`[Restore] Backup: ${backup.exportedAt || 'sin fecha'} | commitBase=${backup.commitBase || 'n/a'}`);
  console.log('[Restore] Modo seguro: SOLO inserta documentos que no existen en Firestore. No elimina ni reemplaza existentes.');

  await firebase.authenticateServer();

  const infografias = sectionData(backup, 'infografias').infografias || [];
  const posts = sectionData(backup, 'feCatolica').posts || [];
  const recursos = sectionData(backup, 'recursosPdf').recursos || [];
  const videos = sectionData(backup, 'videos').videos || [];
  const podcasts = sectionData(backup, 'podcasts').podcasts || [];
  const santos = sectionData(backup, 'santoral').santos || [];
  const oraciones = sectionData(backup, 'oraciones').oraciones || [];

  const result = {};

  result.infografias = await restoreMissing('Infografías', infografias, await existingKeys(firebase.syncDownloadInfografias, x => x.id || x.slug), x => x.id || x.slug, firebase.syncUploadInfografia);
  result.posts = await restoreMissing('Fe Católica / Blog', posts, await existingKeys(firebase.syncDownloadPosts, x => x.slug), x => x.slug, firebase.syncUploadPost, 8);
  result.recursosPdf = await restoreMissing('Recursos PDF', recursos, await existingKeys(firebase.syncDownloadRecursosPdf, x => x.slug || x.id), x => x.slug || x.id, firebase.syncUploadRecursoPdf);
  result.videos = await restoreMissing('Videos', videos, await existingKeys(firebase.syncDownloadVideos, x => x.id || x.slug), x => x.id || x.slug, firebase.syncUploadVideo);
  result.podcasts = await restoreMissing('Podcasts', podcasts, await existingKeys(firebase.syncDownloadPodcasts, x => x.id || x.slug), x => x.id || x.slug, firebase.syncUploadPodcast);
  result.santoral = await restoreMissing('Santoral', santos, await existingKeys(firebase.syncDownloadSantos, x => x.slug), x => x.slug, firebase.syncUploadSanto, 8);

  if (oraciones.length && firebase.syncUploadOracion && firebase.syncDownloadOraciones) {
    result.oraciones = await restoreMissing('Oraciones', oraciones, await existingKeys(firebase.syncDownloadOraciones, x => x.slug || x.id), x => x.slug || x.id, firebase.syncUploadOracion);
  } else {
    result.oraciones = { backup: oraciones.length, already: 0, restored: 0, failed: 0, note: 'El backup suministrado no contiene oraciones.' };
  }

  console.log('\n[Restore] RESULTADO FINAL');
  console.log(JSON.stringify(result, null, 2));

  const failures = Object.values(result).reduce((n, x) => n + Number(x.failed || 0), 0);
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error('[Restore] FATAL:', err.stack || err.message);
  process.exit(1);
});
