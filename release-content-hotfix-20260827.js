// CatolicosGPT — release hotfix 2026-08-27
// Scope ONLY:
// 1) Persist Infografia del Dia and keep newest infographics first.
// 2) Persist Santo/Biografia del Dia without unrelated edits unmarking it.
// 3) Remove the search/filter panel only from the Fe Catolica index.
// No visual styles, cards, headers, admin layout or existing content are changed.

const fs = require('fs');
const path = require('path');

const INFO_MARK = '__cgpt_infografia_del_dia__';
const SAINT_MARK = '__cgpt_santo_del_dia__';

function words(value) {
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}
function addMark(value, mark) {
  const list = words(value).filter(v => v !== mark);
  list.push(mark);
  return list.join(', ');
}
function removeMark(value, mark) {
  return words(value).filter(v => v !== mark).join(', ');
}
function hasMark(value, mark) {
  return words(value).includes(mark);
}
function timeOf(item) {
  const value = item && (item.fechaCreacion || item.fechaISO || item.createdAt || item.fecha || 0);
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
function sortNewest(items) {
  return [...(items || [])].sort((a, b) => timeOf(b) - timeOf(a));
}

// ─────────────────────────────────────────────────────────────────────────────
// Infografias: durable featured marker + newest-first order
// The marker is stored inside `keywords`, a field that the existing Firebase
// synchronizer already persists, so the featured state survives deployments.
// ─────────────────────────────────────────────────────────────────────────────
try {
  const infografias = require('./infografias-module');
  const firebase = require('./firebase-module');
  const originalUpdate = infografias.updateInfografia.bind(infografias);

  function syncInfo(items) {
    (items || []).forEach(item => {
      try { Promise.resolve(firebase.syncUploadInfografia(item)).catch(() => {}); } catch (_) {}
    });
  }

  infografias.getInfografias = function getInfografiasHotfix({ categoria, q, page = 1, limit = 20 } = {}) {
    const catalog = infografias.loadCatalog();
    let items = sortNewest((catalog.infografias || []).filter(i => i.publicado !== false));
    if (categoria && categoria !== 'all') {
      items = items.filter(i => i.tipo === categoria || i.categoria === categoria);
    }
    if (q) {
      const ql = String(q).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      items = items.filter(i => {
        const text = ((i.titulo || '') + ' ' + (i.tema || '') + ' ' + (i.descripcion || '') + ' ' + (i.keywords || '') + ' ' + (i.categoria || ''))
          .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return text.includes(ql);
      });
    }
    const total = items.length;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Number(limit) || 20);
    return {
      items: items.slice((safePage - 1) * safeLimit, safePage * safeLimit),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit)
    };
  };

  infografias.getInfografiaDelDia = function getInfografiaDelDiaHotfix() {
    const catalog = infografias.loadCatalog();
    const items = catalog.infografias || [];
    return items.find(i => i.esInfografiaDelDia === true || hasMark(i.keywords, INFO_MARK)) || sortNewest(items)[0] || null;
  };

  infografias.setInfografiaDelDia = function setInfografiaDelDiaHotfix(slug) {
    const catalog = infografias.loadCatalog();
    catalog.infografias = catalog.infografias || [];
    const changed = [];
    let target = null;

    catalog.infografias = catalog.infografias.map(item => {
      const selected = item.slug === slug;
      const wasSelected = item.esInfografiaDelDia === true || hasMark(item.keywords, INFO_MARK);
      const next = {
        ...item,
        esInfografiaDelDia: selected,
        keywords: selected ? addMark(item.keywords, INFO_MARK) : removeMark(item.keywords, INFO_MARK)
      };
      if (selected) target = next;
      if (wasSelected !== selected || (selected && !hasMark(item.keywords, INFO_MARK))) changed.push(next);
      return next;
    });

    if (!target) return false;
    infografias.saveCatalog(catalog);
    syncInfo(changed);
    return true;
  };

  infografias.updateInfografia = function updateInfografiaHotfix(id, updatedData = {}) {
    const beforeCatalog = infografias.loadCatalog();
    const before = (beforeCatalog.infografias || []).find(i => String(i.id) === String(id));
    const wasFeatured = Boolean(before && (before.esInfografiaDelDia === true || hasMark(before.keywords, INFO_MARK)));
    const updated = originalUpdate(id, updatedData);
    if (!updated || !wasFeatured) return updated;

    const catalog = infografias.loadCatalog();
    const idx = (catalog.infografias || []).findIndex(i => String(i.id) === String(id));
    if (idx < 0) return updated;
    catalog.infografias[idx] = {
      ...catalog.infografias[idx],
      esInfografiaDelDia: true,
      keywords: addMark(catalog.infografias[idx].keywords, INFO_MARK)
    };
    infografias.saveCatalog(catalog);
    syncInfo([catalog.infografias[idx]]);
    return catalog.infografias[idx];
  };
} catch (err) {
  console.warn('[Release Hotfix] Infografias patch skipped:', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Santoral: durable daily biography marker.
// Generic edits never unfeature the current daily saint. Only the dedicated
// "set featured" action can switch the daily biography to another celebration.
// ─────────────────────────────────────────────────────────────────────────────
try {
  const santoral = require('./santoral-module');
  const firebase = require('./firebase-module');
  const originalUpdateSaint = santoral.updateSaint.bind(santoral);
  const originalCreateSaint = santoral.createSaint.bind(santoral);
  const originalGetOrCreateDailySaint = santoral.getOrCreateDailySaint.bind(santoral);

  const monthNames = {
    '01':'enero','02':'febrero','03':'marzo','04':'abril','05':'mayo','06':'junio',
    '07':'julio','08':'agosto','09':'septiembre','10':'octubre','11':'noviembre','12':'diciembre'
  };
  function monthKey(item) {
    if (item && item.mes_index) return String(item.mes_index).padStart(2, '0');
    const name = String(item && item.mes || '').toLowerCase();
    return Object.keys(monthNames).find(k => monthNames[k] === name) || '';
  }
  function sameDay(a, b) {
    return parseInt(a && a.dia) === parseInt(b && b.dia) && monthKey(a) === monthKey(b);
  }
  function isFeaturedSaint(item) {
    return Boolean(item && (item.esSantoDelDia === true || hasMark(item.seo_keywords, SAINT_MARK)));
  }
  function syncSaints(items) {
    (items || []).forEach(item => {
      try { Promise.resolve(firebase.syncUploadSanto(item)).catch(() => {}); } catch (_) {}
    });
  }

  santoral.getFeaturedSaintForDay = function getFeaturedSaintForDayHotfix(dia, mesIndex) {
    const db = santoral.loadSantoral();
    const key = String(mesIndex).padStart(2, '0');
    const same = (db.santos || []).filter(s => parseInt(s.dia) === parseInt(dia) && monthKey(s) === key);
    return same.find(isFeaturedSaint) || same[0] || null;
  };

  santoral.getOrCreateDailySaint = async function getOrCreateDailySaintHotfix(dia, mesIndex) {
    const featured = santoral.getFeaturedSaintForDay(dia, mesIndex);
    if (featured) return featured;
    return originalGetOrCreateDailySaint(dia, mesIndex);
  };

  santoral.setFeaturedSaint = function setFeaturedSaintHotfix(slug) {
    const db = santoral.loadSantoral();
    const idx = (db.santos || []).findIndex(s => s.slug === slug);
    if (idx < 0) return null;
    const source = db.santos[idx];
    const changed = [];

    db.santos = db.santos.map(item => {
      if (!sameDay(item, source)) return item;
      const selected = item.slug === slug;
      const next = {
        ...item,
        esSantoDelDia: selected,
        seo_keywords: selected ? addMark(item.seo_keywords, SAINT_MARK) : removeMark(item.seo_keywords, SAINT_MARK),
        fechaModificacion: new Date().toISOString()
      };
      changed.push(next);
      return next;
    });

    const target = db.santos.find(s => s.slug === slug);
    santoral.saveSantoral(db);
    syncSaints(changed);
    return target || null;
  };

  santoral.updateSaint = function updateSaintHotfix(slug, updatedData = {}) {
    const before = santoral.getSaintBySlug(slug);
    const wasFeatured = isFeaturedSaint(before);
    const safeData = { ...updatedData };
    // A normal edit form is not allowed to accidentally clear the daily saint.
    if (wasFeatured && safeData.esSantoDelDia !== true) safeData.esSantoDelDia = true;
    const updated = originalUpdateSaint(slug, safeData);
    if (!updated || !wasFeatured) return updated;

    const db = santoral.loadSantoral();
    const idx = (db.santos || []).findIndex(s => s.slug === slug);
    if (idx < 0) return updated;
    db.santos[idx] = {
      ...db.santos[idx],
      esSantoDelDia: true,
      seo_keywords: addMark(db.santos[idx].seo_keywords, SAINT_MARK)
    };
    santoral.saveSantoral(db);
    syncSaints([db.santos[idx]]);
    return db.santos[idx];
  };

  santoral.createSaint = function createSaintHotfix(data = {}) {
    const created = originalCreateSaint(data);
    if (!created || data.esSantoDelDia !== true) return created;
    return santoral.setFeaturedSaint(created.slug) || created;
  };
} catch (err) {
  console.warn('[Release Hotfix] Santoral patch skipped:', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fe Catolica index: remove ONLY its search/filter box.
// This is runtime DOM cleanup scoped to /fe-catolica and cannot affect article
// pages, the global header, article cards or chat buttons.
// ─────────────────────────────────────────────────────────────────────────────
const originalReadFileSync = fs.readFileSync.bind(fs);
const serverPath = path.resolve(__dirname, 'server.js');
const FE_UI = `
<script id="cgpt-fe-catolica-no-search">
(function(){
  function clean(){
    var p=(location.pathname||'').replace(/\/+$/,'').toLowerCase();
    if(p!=='/fe-catolica') return;
    var inputs=[].slice.call(document.querySelectorAll('main input[type="search"],main input[type="text"]'));
    inputs.forEach(function(input){
      var ph=String(input.getAttribute('placeholder')||'').toLowerCase();
      if(ph.indexOf('buscar')<0) return;
      var node=input.closest('form')||input.parentElement;
      var candidate=node;
      for(var i=0;i<4 && candidate && candidate.parentElement && candidate.parentElement.tagName!=='MAIN';i++){
        var parent=candidate.parentElement;
        var t=String(parent.textContent||'').toLowerCase();
        if((t.indexOf('artículos')>=0||t.indexOf('articulos')>=0) && (t.indexOf('catequesis')>=0||t.indexOf('doctrina')>=0)) candidate=parent;
        else break;
      }
      if(candidate) candidate.remove();
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',clean,{once:true}); else clean();
})();
</script>`;

fs.readFileSync = function releaseHotfixReadFile(file, options) {
  const result = originalReadFileSync(file, options);
  let resolved='';
  try { resolved=path.resolve(String(file)); } catch (_) {}
  if(resolved!==serverPath) return result;
  const encoding=typeof options==='string' ? options : (options && options.encoding);
  const wasBuffer=Buffer.isBuffer(result);
  let source=wasBuffer ? result.toString(encoding||'utf8') : String(result);
  if(!source.includes('cgpt-fe-catolica-no-search')) source=source.replace('</head>', FE_UI+'\n</head>');
  return wasBuffer && !encoding ? Buffer.from(source,'utf8') : source;
};

module.exports = { installed: true, INFO_MARK, SAINT_MARK };
