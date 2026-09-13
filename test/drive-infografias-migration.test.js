const assert = require('node:assert/strict');
const test = require('node:test');
const map = require('../drive-infografias-map.json');
const { migrateInfografiasToDrive } = require('../drive-infografias-migration');

test('the manifest has unique old URLs, valid Drive IDs and no drafts in destinations', () => {
  for (const [slug, entries] of Object.entries(map)) {
    assert.ok(slug);
    assert.equal(new Set(entries.map(entry => entry.from)).size, entries.length, slug);
    for (const entry of entries) {
      assert.match(entry.from, /^https:\/\/res\.cloudinary\.com\/dwbqrp7kk\/image\/upload\//);
      assert.match(entry.to, /^https:\/\/drive\.google\.com\/thumbnail\?id=[\w-]+&sz=w2400$/);
    }
  }
});

test('only exact old URLs change; slide metadata and newer admin edits survive', () => {
  const [first, second] = map['san-benito-abad'];
  const original = [{ id: 'id1', slug: 'san-benito-abad', imagenes: [
    { url: first.from, slide: 1, formato: '9:16' },
    { url: 'https://drive.google.com/thumbnail?id=newer-edit&sz=w2400', slide: 2 },
    { url: second.from + '?different', slide: 3 }
  ] }];
  const result = migrateInfografiasToDrive(original);
  assert.equal(result.urlCount, 1);
  assert.equal(result.items[0].imagenes[0].url, first.to);
  assert.equal(result.items[0].imagenes[0].formato, '9:16');
  assert.equal(result.items[0].imagenes[1].url, original[0].imagenes[1].url);
  assert.equal(result.items[0].imagenes[2].url, original[0].imagenes[2].url);
  assert.equal(original[0].imagenes[0].url, first.from);
  assert.equal(migrateInfografiasToDrive(result.items).urlCount, 0);
});
