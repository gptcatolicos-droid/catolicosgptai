const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catolicosgpt-restore-'));
process.env.DATA_DIR = tempDataDir;
const restore = require('../backup-restore-module');

const items = (prefix, count, extra = {}) => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index + 1}`, titulo: `${prefix} ${index + 1}`, ...extra
}));
const write = (name, value) => fs.writeFileSync(path.join(tempDataDir, name), JSON.stringify(value));
const read = name => JSON.parse(fs.readFileSync(path.join(tempDataDir, name), 'utf8'));

const backup = {
  sections: {
    infografias: { data: { infografias: items('inf', 51) } },
    feCatolica: { data: { posts: items('fe', 2384) } },
    catequesis: { data: { posts: items('cat', 677, { categoria: 'Catequesis' }) } },
    recursosPdf: { data: { recursos: items('pdf', 7) } },
    videos: { data: { videos: items('video', 12) } },
    podcasts: { data: { podcasts: items('podcast', 4) } },
    santoral: { data: { santos: items('saint', 425) } }
  }
};

write('infografias-catalog.json', { infografias: [{ id: 'inf-1', titulo: 'versión actual' }, { id: 'new-inf' }] });
write('blog-catalog.json', { posts: [{ id: 'fe-1', titulo: 'versión actual' }, { id: 'new-post' }] });
write('recursos-pdf.json', { recursos: [{ id: 'new-pdf' }] });
write('videos-catalog.json', { videos: [{ id: 'new-video' }] });
write('podcast-catalog.json', { podcasts: [{ id: 'new-podcast' }] });
write('santoral-db.json', { santos: [{ id: 'new-saint' }] });

assert.deepStrictEqual(restore.validateBackup(backup), restore.VERIFIED_MINIMUMS);
const result = restore.restoreBackup(backup);
assert.strictEqual(result.ok, true);
assert.strictEqual(read('infografias-catalog.json').infografias.length, 52);
assert.strictEqual(read('infografias-catalog.json').infografias.find(x => x.id === 'inf-1').titulo, 'versión actual');
assert.strictEqual(read('blog-catalog.json').posts.length, 3062);
assert.strictEqual(read('blog-catalog.json').posts.find(x => x.id === 'fe-1').titulo, 'versión actual');
assert.strictEqual(read('recursos-pdf.json').recursos.length, 8);
assert.strictEqual(read('videos-catalog.json').videos.length, 13);
assert.strictEqual(read('podcast-catalog.json').podcasts.length, 5);
assert.strictEqual(read('santoral-db.json').santos.length, 426);
assert.ok(fs.existsSync(path.join(tempDataDir, 'last-restored-backup.json')));
assert.throws(() => restore.validateBackup({ sections: { infografias: { data: { infografias: [] } } } }), /Backup rechazado/);
console.log('backup-restore-module: all tests passed');
