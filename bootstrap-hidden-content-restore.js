// Conserva el contenido respaldado de Video y Podcast aunque esas secciones estén ocultas del menú.
// Merge no destructivo: cualquier registro actual tiene prioridad sobre el backup.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const VIDEOS = 'H4sIADN9h2oC/51X3XIaNxR+Fc32pp1BDMvfgu8cwMSOHSfBYZp0Oh2xK7ASIWFpFxvSPEwve5GLNo/Ai/Uc7QLLArbTCw+7Wun8fN93jo6/eHNurNDKO/H8csUrebGOmfRO/GrJm4uIa+ud/PbFmyUjKUIWae8kNgkveaGechUzI2DF63IbJiPDiWRkJPTEsPHqGyMRJwOmyIW2fMoMrvRsaMR89Rd+esEkmyTclMg4URGYNrAqyfUssaTLRZl0tNIhJzYht8LG2ghWIqGBRaknYKxE9MgwC2tMaSWWLBSr74osyMwIFYoZk9wSrixf/cPUktkyJCciiBbSon7Qqjb8aqUR+H4NPliZTOBTFrxgNOLUMkU/pbHDAnehuw+jLHIKlhjFKOiCbqMAMEveQidxMuLn6DA6r/V7w9ZgyT/Al5DFfILZwBd8vku4FRaRF3EiEc4XPwoh+ZMMIZQSuYZYAIFOHhHnUiGnXofFGmjUtv/mxvta+rITiwT3ZgKPu8H7SW3x/lP3Y/3h6pilfVxb7Va1GuRz6miDxHZuDXApCCWXkEoSMvfKtgyEbh8N031UAvD5XY/rMFMMqMiKiRJjtxOBKnhfoFDFdKZNzEAqDma5jQdh5gpXxhzUFa++o08SakW4jeGkGucJymNRJptagCicsDE+TUarbxi5LqHZmeGWO8eGM+lsoF+N4oUyuEtWf+M2YB68XQkL4Vi0F4Ipo7NoUXxQDw4ZxcoZnwfpyfP5anjbG7+Kx6f1VkGMOQFsaLvUFsKQU/ihKKsYHhbk2jiZc7vlTWoLBYMbsRJgG5SEzm0rKKQd1NuVClbeDoE5d2gF2LNkxkDTYMqUyUu2JHFCpjwSMYr7X0UigdXpuJGbw2WyLxWEpxhEq1Zt1xvbJCz6pGm9z4WZcLV5gU5IQylmT2owI81FRbEsuSYdOAgvXaYW5A3ULKBSRjTTjsWQzaFzh+dAVXkGivbW2wrmj9dmnvyP9zfNswfeHNirAvnTxEJOTkQ516ByKCCoHrYEgEF3F9wm1ttL+fA+4mAj4X728HrlHK6Lh+VJcNZomFrDhvsp87qHfJHQdtCoB/UdLOAXnbga1gU43l7IYMAWH96wz8fhyB9YfGj0B6dnQXjz+TnFgyWMyRRa3RGiHtfVQWN4+a1vEGxZKeCuYuAkVxHcDdA3UEMaG0nMwRjy0xU6X7yMpqgXuu0uvNVKJWhWoG24TpOPrSfJDZuOAArJjXa6lBLlHTpnrxn2quh45hvEHjF0IBy/EVSCVoHTO34bXozf/nFxaY9TlOXNJY237qDKc84OtI9Ddw2UbpfPNfY5cq6mLExkoRRcrZag58Npy7B9TgVc20a7ieQJSVcrtWoAaeZBeo6/Aijh0NZetVl/HN4/CUqUmadiYz5fi9PM/NGZIi//Kx4xwBSkl2bMdhvYAU5r7UrT95970z/p4jDupABPbzjkD4P3l43x+8cGtG21TFOndG1x97p4DJ39tJ4oiVyK2TD4gisRF1vZvNN/2Y3uTgfv6scZLoLdaNRrzeBgZtn8O1r7KvaigzHhNZwWhSUTvPwd7GAjEukggNthhIKhnoXGTUbp+IPj2ATmdZG23J04m80A/lr1oJDxu556uD+7jfvdR6fqI/gW83HT1DqbM4NtwKbd6xR7KyUD+D8CZjMYQaacJAqGQMgjSYc72AVjyYwtyzvDIKZ1fkp+8rE19+yMgQVZuNv3fR3S/nY+oeP1fqSI4f4fkdVO2tm98A70i9cChLoT/c/rC8OSvl5qq+0vu6OSpiY9SmFECtdHJ7MY6iI7SSfpyQJ3C6l6zV8vz+T8/Jlqbbd9GNWqfjWP3/9I4OvvX/8Dbn9gVPQOAAA=';
const PODCASTS = 'H4sIADN9h2oC/9VX71IbNxB/Fc3NNJ8s23c+/yWk4zgJkAmUgaQNlE5HJ63PAp10lXQGm+Fh8gD91Efgxbp3Nn9S6hkImTB8sC1pV7vr1e+3K50HU7BOGh0MgrDeDGqBN56pYBDXgtwIzpx3weD384AzD6mxkqFiIhOFg1ogwHErc77Y/8E4ss9Uhj+U/GpUkYEmIY5HJsulYlxe/qOJgKVSjWzKTKPyjOxaSEvZLnMFZ6pOtjRXxQzI6PKL9pKbctch48xe/s3KDaDINku1HEuMq46RQJaA+GQx8GDife4GjYbJQdddbrwcz+rcZI1Kp8FUUmSN8G1fv/6cpRv+9O2Hndl0c5Qfi+jnwmd/OlNYDuspaLDMG/vCyfUIRDvstlpxLx7HzT6UeZK+UGb130YVKVCMWaRhtxdFYT/utTpxBwXLqH5ovJW1TZ+VLl/KsWUZEME8ox6cl2L9aKFBF6KjgDg/U4DLibECLLVMyMINwig/K4WWo+hHhI7OTqXwE3QXNps/4XQCMp14nLfaEU6reF9XQeJaE1eYUuZ0XCiF6ATQuHq1iENWeJMrNlsjXMk8McwKemqlhzUCmttZ7jEJGQjJ1siNjTWSS+4LC1RquhyiUWUwKzpFs4rNZ0fBq5eNRf5elaesihSTrYyjrsIHnS7QQUOU5gWSiDOBEPK2gFoVmEX9N0wjI1jJFxNc1M7vwKjd7bX73ac80uYut83OITQP9nbCk1BsFJ+mzfcrjzSB/jhuJ2E/6bE44s1nfKQPJu4jU/UNpe3xHu9A83bxN5ZV9X4FYG9gD55pyRwVQBcU0N64u01jqVZWeFVV0lKNSAFMkZxZRiqHZXfIsVMZjcuZBO0t7sGvhB0z91U5/l+DFZEemsn4eK66ewef35nDzvCXYVfY2fyv/ZWZbLMkipChSRiKeNx+UoY+MvTny9CvimWn3ep1W+1edBsg28ONna13W6PhR+zX24VDpJMRJqKEPPkPlu8wYQnu7PryQbPKAuVLC1SgBZpfW7jHvWlYnhi5FRZfcGAZFI6ueGC/qQQ9HsYrW9P9GYVU5SeN+CT7uJ9ORKr1wfy9nto3Z7+dyZWhQBh1OrwPrW6ElyeePA2jvkvoz5dR18SpKinZM45ZacjWsKSPdB5w5siGmRtX1feHAPR7oWJFK7pnI7tdM1qtbq/f7YSt3h2e7gGH8pZ/XOiKn/fJBz5lqk523bKm+MH3AT5g8DVjDTHLGQo15sd6qN/00KpnUrvwQCWj2ZV9mi7zffHHxb8q3msMxA0AAA=';

function decode(v) { return JSON.parse(zlib.gunzipSync(Buffer.from(v, 'base64')).toString('utf8')); }
function key(v = {}) { return String(v.id || v.slug || v.url || v.titulo || v.title || '').trim().toLowerCase(); }
function read(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; } }

function restore(filename, listKey, backup) {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
  const runtimePath = path.join(dataDir, filename);
  const repoPath = path.join(__dirname, 'data', filename);
  const current = read(runtimePath);
  const currentItems = Array.isArray(current[listKey]) ? current[listKey] : [];
  const backupItems = Array.isArray(backup[listKey]) ? backup[listKey] : [];
  const map = new Map();
  for (const item of backupItems) if (key(item)) map.set(key(item), item);
  for (const item of currentItems) if (key(item)) map.set(key(item), item);
  const merged = [...map.values()];
  if (merged.length <= currentItems.length) return;
  const result = { ...backup, ...current, [listKey]: merged, total: merged.length };
  const json = JSON.stringify(result, null, 2);
  try { fs.writeFileSync(runtimePath, json, 'utf8'); } catch (err) { console.warn(`[Hidden Content] ${filename}:`, err.message); }
  if (repoPath !== runtimePath) { try { fs.writeFileSync(repoPath, json, 'utf8'); } catch (_) {} }
  console.log(`[Hidden Content] ${filename}: ${merged.length} registros preservados.`);
}

function restoreHiddenCatalogs() {
  try { restore('videos-catalog.json', 'videos', decode(VIDEOS)); } catch (e) { console.warn('[Hidden Content] Videos:', e.message); }
  try { restore('podcast-catalog.json', 'podcasts', decode(PODCASTS)); } catch (e) { console.warn('[Hidden Content] Podcasts:', e.message); }
}

module.exports = { restoreHiddenCatalogs };
