// CatolicosGPT deterministic mobile UI guard — 2026-08-25
// Presentation only. It never mutates catalogs, auth, backup or admin data.
// The goal is to make mobile UX independent from Tailwind/CDN timing and prevent
// the regressions that produced giant typography, SVGs and unstyled controls.
const fs = require('fs');
const path = require('path');

if (!global.__CATOLICOSGPT_UI_REGRESSION_GUARD__) {
  global.__CATOLICOSGPT_UI_REGRESSION_GUARD__ = true;

  const serverPath = require.resolve('./server');
  const originalReadFileSync = fs.readFileSync.bind(fs);

  const UI_GUARD = `
<style id="catolicosgpt-ui-regression-guard-v1">
@media (max-width:767px){
  html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
  main{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
  main img{max-width:100%!important;height:auto!important}

  /* HOME: chat-first, compact and centered. */
  body.cgpt-home-page #welcome-screen{
    display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;
    width:100%!important;max-width:760px!important;min-width:0!important;min-height:0!important;height:auto!important;
    margin:0 auto!important;padding:28px 16px 10px!important;gap:8px!important;overflow:visible!important;text-align:center!important;
  }
  body.cgpt-home-page #welcome-screen>div:first-child{display:none!important;width:0!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
  body.cgpt-home-page #welcome-screen>div:nth-child(2){display:flex!important;flex-direction:column!important;align-items:center!important;width:100%!important;max-width:680px!important;min-width:0!important;margin:0 auto!important}
  body.cgpt-home-page #welcome-screen h1{width:100%!important;max-width:680px!important;margin:0 auto 8px!important;font-size:30px!important;line-height:1.08!important;letter-spacing:-.02em!important;text-align:center!important;overflow-wrap:normal!important;word-break:normal!important}
  body.cgpt-home-page #welcome-screen p{width:100%!important;max-width:680px!important;margin:0 auto!important;font-size:15px!important;line-height:1.35!important;text-align:center!important;overflow-wrap:normal!important;word-break:normal!important}
  body.cgpt-home-page #welcome-screen .grid,
  body.cgpt-home-page #welcome-screen .welcome-cards,
  body.cgpt-home-page #welcome-screen .home-infografia-day,
  body.cgpt-home-page #welcome-screen .home-infografia-gallery-link{display:none!important}

  /* MOBILE DRAWER: deterministic even when utility CSS fails. */
  .cgpt-mobile-drawer{
    position:fixed!important;inset:0 auto 0 0!important;width:min(82vw,320px)!important;max-width:320px!important;
    height:100dvh!important;background:#fff!important;z-index:9999!important;padding:18px 16px 24px!important;
    overflow-y:auto!important;box-shadow:8px 0 28px rgba(34,24,18,.16)!important;color:#2D241E!important;
  }
  .cgpt-mobile-drawer h1,.cgpt-mobile-drawer h2,.cgpt-mobile-drawer h3{font-size:15px!important;line-height:1.2!important;margin:18px 0 8px!important;letter-spacing:.06em!important;text-transform:uppercase!important;color:#6B1E26!important}
  .cgpt-mobile-drawer a,.cgpt-mobile-drawer button:not(.cgpt-drawer-close){display:flex!important;align-items:center!important;gap:10px!important;width:100%!important;min-height:40px!important;padding:8px 10px!important;margin:1px 0!important;border-radius:10px!important;font-size:14px!important;line-height:1.2!important;color:#2D241E!important;text-decoration:none!important;background:transparent!important;border:0!important;text-align:left!important}
  .cgpt-mobile-drawer svg{width:18px!important;height:18px!important;max-width:18px!important;max-height:18px!important;flex:0 0 18px!important}
  .cgpt-mobile-drawer .cgpt-drawer-close{display:flex!important;align-items:center!important;justify-content:center!important;width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;margin:0 0 10px!important;border:1px solid #E5DDD3!important;border-radius:10px!important;background:#fff!important;font-size:22px!important;line-height:1!important;color:#2D241E!important}
  .cgpt-mobile-drawer-overlay{position:fixed!important;inset:0!important;background:rgba(31,23,18,.38)!important;z-index:9998!important}

  /* INFOGRAPHIC GALLERY: complete covers, compact cards and usable filters. */
  body.cgpt-infografias-page main{padding:18px 14px 110px!important}
  body.cgpt-infografias-page main>div,body.cgpt-infografias-page main>section{width:100%!important;max-width:820px!important;margin-left:auto!important;margin-right:auto!important}
  body.cgpt-infografias-page main h1{font-size:34px!important;line-height:1.08!important;margin:8px 0 10px!important;letter-spacing:-.02em!important}
  body.cgpt-infografias-page main p{font-size:15px!important;line-height:1.45!important}
  body.cgpt-infografias-page main form{display:flex!important;flex-wrap:wrap!important;gap:8px!important;align-items:center!important;width:100%!important;margin:12px 0 16px!important}
  body.cgpt-infografias-page main input[type="text"],body.cgpt-infografias-page main input[type="search"],body.cgpt-infografias-page main select{flex:1 1 180px!important;min-width:0!important;max-width:100%!important;height:42px!important;padding:8px 12px!important;border:1px solid #DDD5C9!important;border-radius:10px!important;background:#fff!important;color:#2D241E!important;font-size:14px!important}
  body.cgpt-infografias-page main form button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:42px!important;padding:8px 14px!important;border:0!important;border-radius:10px!important;background:#6B1E26!important;color:#fff!important;font-size:14px!important;font-weight:700!important}
  body.cgpt-infografias-page .cgpt-inf-card{display:block!important;width:100%!important;max-width:360px!important;margin:0 auto 18px!important;padding:12px!important;background:#fff!important;border:1px solid #E4DDD3!important;border-radius:18px!important;box-shadow:0 4px 16px rgba(37,27,21,.055)!important;overflow:hidden!important;color:#2D241E!important;text-decoration:none!important}
  body.cgpt-infografias-page .cgpt-inf-card [class*="aspect-"]{aspect-ratio:auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
  body.cgpt-infografias-page .cgpt-inf-card img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:430px!important;object-fit:contain!important;object-position:center!important;margin:0 auto 12px!important;border-radius:12px!important;background:#F7F3ED!important}
  body.cgpt-infografias-page .cgpt-inf-card h2{font-size:21px!important;line-height:1.16!important;margin:7px 0 8px!important;color:#6B1E26!important;overflow-wrap:anywhere!important}
  body.cgpt-infografias-page .cgpt-inf-card p{font-size:14px!important;line-height:1.45!important;margin:0 0 10px!important;color:#61574F!important;display:block!important;overflow:visible!important;white-space:normal!important}
  body.cgpt-infografias-page .cgpt-inf-card .cgpt-inf-meta{display:flex!important;justify-content:space-between!important;gap:10px!important;margin:4px 0 5px!important;color:#C38E2B!important;font-size:10px!important;line-height:1.2!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important}

  /* READING PAGES: blog, Fe Catolica and nested Catequesis/Ninos articles. */
  body.cgpt-reading-page{overflow-x:hidden!important}
  body.cgpt-reading-page main{width:100%!important;max-width:100%!important;overflow-x:hidden!important;padding:18px 16px 110px!important}
  body.cgpt-reading-page main>div,body.cgpt-reading-page main>section,body.cgpt-reading-page main>article{width:100%!important;max-width:720px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}
  body.cgpt-reading-page main h1{font-size:32px!important;line-height:1.08!important;letter-spacing:-.02em!important;margin:10px 0 14px!important;overflow-wrap:anywhere!important;word-break:normal!important}
  body.cgpt-reading-page main h2{font-size:24px!important;line-height:1.15!important;margin:26px 0 10px!important;overflow-wrap:anywhere!important}
  body.cgpt-reading-page main h3{font-size:20px!important;line-height:1.2!important;margin:22px 0 8px!important;overflow-wrap:anywhere!important}
  body.cgpt-reading-page main h4{font-size:18px!important;line-height:1.25!important;margin:18px 0 7px!important}
  body.cgpt-reading-page main p,body.cgpt-reading-page main li,body.cgpt-reading-page main blockquote{font-size:17px!important;line-height:1.62!important;letter-spacing:0!important;overflow-wrap:anywhere!important;word-break:normal!important}
  body.cgpt-reading-page main p{margin:0 0 15px!important}
  body.cgpt-reading-page main ul,body.cgpt-reading-page main ol{padding-left:22px!important;margin:12px 0 18px!important}
  body.cgpt-reading-page main li{margin:5px 0!important}
  body.cgpt-reading-page main blockquote{margin:18px 0!important;padding:13px 15px!important;border-left:3px solid #C38E2B!important;background:#F8F3EA!important}
  body.cgpt-reading-page main img,body.cgpt-reading-page main picture,body.cgpt-reading-page main video,body.cgpt-reading-page main iframe{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}
  body.cgpt-reading-page main table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;border-collapse:collapse!important;font-size:14px!important}
  body.cgpt-reading-page main th,body.cgpt-reading-page main td{min-width:120px!important;max-width:260px!important;padding:9px!important;font-size:14px!important;line-height:1.38!important;white-space:normal!important;overflow-wrap:anywhere!important;vertical-align:top!important}
  body.cgpt-reading-page main pre{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;font-size:13px!important}
  body.cgpt-reading-page main nav,body.cgpt-reading-page main .flex{max-width:100%!important;flex-wrap:wrap!important;gap:8px!important}
  body.cgpt-reading-page main a{overflow-wrap:anywhere!important}
  body.cgpt-reading-page main a svg,body.cgpt-reading-page main button svg{width:24px!important;height:24px!important;max-width:24px!important;max-height:24px!important}
  body.cgpt-reading-page main .seo-card svg{width:28px!important;height:28px!important;max-width:28px!important;max-height:28px!important}
  body.cgpt-reading-page main button,body.cgpt-reading-page main a[class*="px-"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;max-width:100%!important;min-height:42px!important;padding:10px 14px!important;font-size:14px!important;line-height:1.2!important;white-space:normal!important;text-align:center!important;border-radius:10px!important;box-sizing:border-box!important}

  /* LISTING/RESOURCE PAGES: prevent raw Tailwind fallbacks and giant icons. */
  body.cgpt-resource-page main{width:100%!important;max-width:100%!important;padding:18px 14px 110px!important;overflow-x:hidden!important}
  body.cgpt-resource-page main>div,body.cgpt-resource-page main>section{width:100%!important;max-width:760px!important;margin-left:auto!important;margin-right:auto!important}
  body.cgpt-resource-page main h1{font-size:32px!important;line-height:1.1!important;margin:8px 0 12px!important;overflow-wrap:anywhere!important}
  body.cgpt-resource-page main h2{font-size:23px!important;line-height:1.15!important;margin:18px 0 9px!important;overflow-wrap:anywhere!important}
  body.cgpt-resource-page main h3{font-size:19px!important;line-height:1.2!important;margin:15px 0 7px!important}
  body.cgpt-resource-page main p,body.cgpt-resource-page main li{font-size:16px!important;line-height:1.5!important;overflow-wrap:anywhere!important}
  body.cgpt-resource-page main .seo-card{width:100%!important;max-width:100%!important;margin:0 auto 16px!important;padding:14px!important;border:1px solid #E4DDD3!important;border-radius:16px!important;background:#fff!important;overflow:hidden!important}
  body.cgpt-resource-page main .seo-card img{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;object-fit:contain!important}
  body.cgpt-resource-page main .seo-card svg,body.cgpt-resource-page main a svg,body.cgpt-resource-page main button svg{width:26px!important;height:26px!important;max-width:26px!important;max-height:26px!important}
  body.cgpt-resource-page main form{display:flex!important;flex-wrap:wrap!important;gap:8px!important;width:100%!important;margin:12px 0!important}
  body.cgpt-resource-page main input[type="text"],body.cgpt-resource-page main input[type="search"],body.cgpt-resource-page main select{flex:1 1 180px!important;min-width:0!important;height:42px!important;padding:8px 12px!important;border:1px solid #DDD5C9!important;border-radius:10px!important;background:#fff!important;font-size:14px!important}
  body.cgpt-resource-page main form button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:42px!important;padding:8px 14px!important;border:0!important;border-radius:10px!important;background:#6B1E26!important;color:#fff!important;font-size:14px!important;font-weight:700!important}
}
</style>
<script id="catolicosgpt-ui-regression-runtime-v1">
(function(){
  function cleanText(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim();}
  function pathname(){return (location.pathname||'/').replace(/\/+$/,'')||'/';}

  function markHome(){
    if(pathname()!=='/') return;
    if(document.getElementById('welcome-screen')) document.body.classList.add('cgpt-home-page');
  }

  function markGallery(){
    if(pathname()!=='/infografias') return;
    document.body.classList.add('cgpt-infografias-page');
    const headings=[...document.querySelectorAll('main h2')];
    headings.forEach(function(h){
      let node=h;
      for(let i=0;i<7 && node && node.parentElement;i++){
        const p=node.parentElement;
        if(p.querySelector && p.querySelector('img') && p.contains(h)){node=p;break;}
        node=p;
      }
      if(!node || !node.querySelector || !node.querySelector('img')) return;
      node.classList.add('cgpt-inf-card');
      const raw=cleanText(node);
      const m=raw.match(/(doctrinal|santo|devocional|serie|catequesis(?:-j[oó]venes)?)\s+(\d+)\s+diapositivas/i);
      if(m && !node.querySelector('.cgpt-inf-meta')){
        const meta=document.createElement('div');meta.className='cgpt-inf-meta';
        const a=document.createElement('span');a.textContent=m[1];
        const b=document.createElement('span');b.textContent=m[2]+' diapositivas';
        meta.append(a,b);node.insertBefore(meta,h);
      }
      const link=h.querySelector('a')||h.closest('a')||node.querySelector('a[href*="/infografias/"]');
      if(link&&link.href&&node.tagName!=='A'){
        node.style.cursor='pointer';
        node.addEventListener('click',function(e){if(!e.target.closest('a,button,input,select')) location.href=link.href;});
      }
    });
  }

  function markDrawer(){
    const candidates=[...document.querySelectorAll('body *')].filter(function(el){
      const t=cleanText(el);
      return t.includes('Liturgia de hoy')&&t.includes('Herramientas')&&t.includes('Infografías')&&t.length<1400;
    });
    const drawer=candidates.sort(function(a,b){return a.querySelectorAll('*').length-b.querySelectorAll('*').length;})[0];
    if(!drawer) return;
    drawer.classList.add('cgpt-mobile-drawer');
    const close=[...drawer.querySelectorAll('button')].find(function(b){return /[×✕X]/.test(cleanText(b))||/close|cerrar/i.test(b.getAttribute('aria-label')||'');});
    if(close) close.classList.add('cgpt-drawer-close');
    const fixed=[...document.body.children].filter(function(el){try{return el!==drawer&&getComputedStyle(el).position==='fixed';}catch(_){return false;}});
    const overlay=fixed.find(function(el){try{return parseFloat(getComputedStyle(el).opacity||'1')<1||String(getComputedStyle(el).backgroundColor).includes('rgba');}catch(_){return false;}});
    if(overlay) overlay.classList.add('cgpt-mobile-drawer-overlay');
  }

  function markContent(){
    const p=pathname().toLowerCase();
    const exactResource=['/ninos','/catequesis-ia','/recursos-pdf'];
    if(exactResource.includes(p)){document.body.classList.add('cgpt-resource-page');return;}
    const excluded=['/','/infografias','/infografia-del-dia','/santoral','/admin','/login','/registro'];
    if(excluded.includes(p)||p.startsWith('/admin/')) return;
    const main=document.querySelector('main');
    if(!main) return;
    const h1=main.querySelector('h1');
    const paragraphs=main.querySelectorAll('p');
    if(h1&&paragraphs.length>=1&&cleanText(h1).length>8) document.body.classList.add('cgpt-reading-page');
  }

  function run(){markHome();markGallery();markDrawer();markContent();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  const observer=new MutationObserver(function(){markDrawer();});
  if(document.body) observer.observe(document.body,{childList:true,subtree:true});
})();
</script>`;

  fs.readFileSync = function catolicosGptGuardRead(file, ...args) {
    const result = originalReadFileSync(file, ...args);
    try {
      const resolved = path.resolve(String(file));
      const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
      if (resolved !== path.resolve(serverPath) || !encoding) return result;
      let source = String(result);
      if (!source.includes('catolicosgpt-ui-regression-guard-v1')) {
        source = source.replace('</head>', UI_GUARD + '\n</head>');
      }
      return source;
    } catch (_) {
      return result;
    }
  };
}

module.exports = { installed: true };