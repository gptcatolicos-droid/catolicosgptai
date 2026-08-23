// CatolicosGPT mobile UI shell stabilization — 2026-08-22
// Presentation-only wrapper. Preserves recovery, backup, editorial styles and data.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const UI_SHELL = `
<style id="catolicosgpt-mobile-ui-shell-v1">
@media (max-width:767px){
  /* Mobile drawer */
  .cgpt-mobile-drawer{
    position:fixed!important;inset:0 auto 0 0!important;width:min(82vw,320px)!important;max-width:320px!important;
    height:100dvh!important;background:#fff!important;z-index:9999!important;padding:18px 16px 24px!important;
    overflow-y:auto!important;box-shadow:8px 0 28px rgba(34,24,18,.16)!important;color:#2D241E!important;
  }
  .cgpt-mobile-drawer h1,.cgpt-mobile-drawer h2,.cgpt-mobile-drawer h3{font-size:15px!important;line-height:1.2!important;margin:18px 0 8px!important;letter-spacing:.06em!important;text-transform:uppercase!important;color:#6B1E26!important}
  .cgpt-mobile-drawer a,.cgpt-mobile-drawer button:not(.cgpt-drawer-close){display:flex!important;align-items:center!important;gap:10px!important;width:100%!important;min-height:40px!important;padding:8px 10px!important;margin:1px 0!important;border-radius:10px!important;font-size:14px!important;line-height:1.2!important;color:#2D241E!important;text-decoration:none!important;background:transparent!important;border:0!important;text-align:left!important}
  .cgpt-mobile-drawer a:active{background:#F7F2EA!important}
  .cgpt-mobile-drawer svg{width:18px!important;height:18px!important;max-width:18px!important;max-height:18px!important;flex:0 0 18px!important}
  .cgpt-mobile-drawer .cgpt-drawer-close{display:flex!important;align-items:center!important;justify-content:center!important;width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;margin:0 0 10px!important;border:1px solid #E5DDD3!important;border-radius:10px!important;background:#fff!important;font-size:22px!important;line-height:1!important}
  .cgpt-mobile-drawer-overlay{position:fixed!important;inset:0!important;background:rgba(31,23,18,.38)!important;z-index:9998!important}

  /* Infographic gallery cards: full cover + clean gallery styling */
  body.cgpt-infografias-page main{padding-left:14px!important;padding-right:14px!important}
  body.cgpt-infografias-page .cgpt-inf-card{display:block!important;width:100%!important;max-width:360px!important;margin:0 auto 18px!important;padding:12px!important;background:#fff!important;border:1px solid #E4DDD3!important;border-radius:18px!important;box-shadow:0 4px 16px rgba(37,27,21,.055)!important;overflow:hidden!important;color:#2D241E!important;text-decoration:none!important}
  body.cgpt-infografias-page .cgpt-inf-card img{display:block!important;width:100%!important;height:auto!important;max-width:100%!important;max-height:none!important;object-fit:contain!important;object-position:center!important;margin:0 auto 12px!important;border-radius:12px!important;background:#F7F3ED!important}
  body.cgpt-infografias-page .cgpt-inf-card h2{font-size:21px!important;line-height:1.16!important;margin:7px 0 8px!important;color:#6B1E26!important;overflow-wrap:anywhere!important}
  body.cgpt-infografias-page .cgpt-inf-card p{font-size:14px!important;line-height:1.45!important;margin:0 0 10px!important;color:#61574F!important;display:block!important;overflow:visible!important;white-space:normal!important}
  body.cgpt-infografias-page .cgpt-inf-card .cgpt-inf-meta{display:flex!important;justify-content:space-between!important;gap:10px!important;margin:4px 0 3px!important;color:#C38E2B!important;font-size:10px!important;line-height:1.2!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important}

  /* Home daily infographic: same gallery language, compact, full cover */
  #welcome-screen .home-infografia-gallery-link{width:min(58vw,230px)!important;max-width:230px!important;padding:9px!important;margin:6px auto 4px!important;border:1px solid #E4DDD3!important;border-radius:16px!important;background:#fff!important;box-shadow:0 4px 14px rgba(37,27,21,.05)!important;overflow:hidden!important;text-decoration:none!important;color:#2D241E!important}
  #welcome-screen .home-infografia-gallery-cover{display:block!important;width:100%!important;height:auto!important;aspect-ratio:auto!important;overflow:visible!important;background:#F7F3ED!important;border-radius:11px!important}
  #welcome-screen .home-infografia-gallery-cover img{display:block!important;width:100%!important;height:auto!important;max-width:100%!important;max-height:none!important;object-fit:contain!important;object-position:center!important;margin:0!important;border-radius:11px!important}
  #welcome-screen .home-infografia-gallery-title-v4{font-size:14px!important;line-height:1.18!important;margin:6px 0 4px!important}
  #welcome-screen .home-infografia-gallery-description-v4{font-size:10.5px!important;line-height:1.35!important;margin:0!important}
  #welcome-screen .home-infografia-gallery-meta-v4{font-size:8px!important;line-height:1.1!important}
}
</style>
<script id="catolicosgpt-mobile-ui-shell-runtime-v1">
(function(){
  function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim();}

  function styleDrawer(){
    const candidates=[...document.querySelectorAll('body *')].filter(el=>{
      const t=text(el);
      return t.includes('Liturgia de hoy') && t.includes('Herramientas') && t.includes('Infografías') && t.length<1400;
    });
    let drawer=candidates.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0];
    if(!drawer) return;
    drawer.classList.add('cgpt-mobile-drawer');
    const close=[...drawer.querySelectorAll('button')].find(b=>/[×✕X]/.test(text(b)) || /close|cerrar/i.test(b.getAttribute('aria-label')||''));
    if(close) close.classList.add('cgpt-drawer-close');
    let overlay=[...document.body.children].find(el=>el!==drawer && getComputedStyle(el).position==='fixed' && parseFloat(getComputedStyle(el).opacity||'1')<1);
    if(overlay) overlay.classList.add('cgpt-mobile-drawer-overlay');
  }

  function styleInfografias(){
    if(!location.pathname.startsWith('/infografias')) return;
    if(location.pathname!=='/infografias' && location.pathname!=='/infografias/') return;
    document.body.classList.add('cgpt-infografias-page');
    const headings=[...document.querySelectorAll('main h2')];
    headings.forEach(h=>{
      const link=h.querySelector('a') || h.closest('a');
      let node=h;
      for(let i=0;i<6 && node && node.parentElement;i++){
        const p=node.parentElement;
        if(p.querySelector && p.querySelector('img') && p.contains(h)){node=p;break;}
        node=p;
      }
      if(!node || !node.querySelector || !node.querySelector('img')) return;
      node.classList.add('cgpt-inf-card');
      const raw=text(node);
      const m=raw.match(/(doctrinal|santo|devocional|serie|catequesis(?:-j[oó]venes)?)\s+(\d+)\s+diapositivas/i);
      if(m && !node.querySelector('.cgpt-inf-meta')){
        const meta=document.createElement('div');meta.className='cgpt-inf-meta';
        const a=document.createElement('span');a.textContent=m[1];
        const b=document.createElement('span');b.textContent=m[2]+' diapositivas';
        meta.append(a,b); node.insertBefore(meta,h);
      }
      if(link && link.href && node.tagName!=='A'){
        node.style.cursor='pointer';
        node.addEventListener('click',e=>{if(!e.target.closest('a')) location.href=link.href;});
      }
    });
  }

  function run(){styleDrawer();styleInfografias();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
</script>`;

fs.readFileSync=function uiShellRead(file,...args){
  const result=originalReadFileSync(file,...args);
  try{
    const resolved=path.resolve(String(file));
    const encoding=typeof args[0]==='string'?args[0]:(args[0]&&args[0].encoding);
    if(resolved!==path.resolve(serverPath)||!encoding) return result;
    let source=String(result);
    if(!source.includes('catolicosgpt-mobile-ui-shell-v1')) source=source.replace('</head>',UI_SHELL+'\n</head>');
    return source;
  }catch(_){return result;}
};

try{require('./article-mobile-hardening');}
finally{fs.readFileSync=originalReadFileSync;}
