// Mobile UX refinement for CatolicosGPT — 2026-09-15
// Presentation-only patch. Does not change content, admin data, daily selections,
// routes, SEO records, Google Drive URLs, Cloudinary URLs or desktop rendering.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const stableStartPath = require.resolve('./stable-start');
const previousLoader = Module._extensions['.js'];

const MOBILE_MINIMAL_UX = `
<style id="catolicosgpt-mobile-minimal-ux-20260915">
@media (max-width:767px){
  /* Home: ChatGPT-like canvas. The normal header is hidden only on the home/chat. */
  body.cgpt-home-mobile-minimal > header{display:none!important}
  body.cgpt-home-mobile-minimal .chat-shell{height:100svh!important;min-height:100svh!important}
  body.cgpt-home-mobile-minimal #chat-box{padding:56px 14px 10px!important}
  body.cgpt-home-mobile-minimal #welcome-screen{padding:0!important;gap:12px!important;justify-content:flex-start!important}
  body.cgpt-home-mobile-minimal .welcome-cards{display:block!important;width:100%!important;margin:4px 0 0!important}
  body.cgpt-home-mobile-minimal .welcome-card{display:none!important}
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia{display:block!important;width:min(72vw,280px)!important;max-width:280px!important;margin:0 auto!important;padding:10px!important;border:1px solid #E6DFD4!important;border-radius:18px!important;background:#fff!important;box-shadow:0 4px 18px rgba(37,27,21,.05)!important}
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia img{display:block!important;width:100%!important;height:auto!important;max-height:42svh!important;object-fit:contain!important;border-radius:12px!important;background:#F9F6F0!important}
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia h2,
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia h3{font-size:16px!important;line-height:1.2!important;margin:8px 2px 4px!important}
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia p{font-size:12px!important;line-height:1.35!important;margin:0 2px!important}
  .cgpt-home-nav-trigger{position:fixed!important;left:14px!important;top:14px!important;z-index:950!important;width:44px!important;height:44px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid #E6DFD4!important;border-radius:14px!important;background:rgba(255,255,255,.96)!important;color:#2D241E!important;box-shadow:0 3px 14px rgba(37,27,21,.08)!important;font-size:24px!important;line-height:1!important;padding:0!important}

  /* Drawer: compact, calm and readable. */
  #mobile-drawer-content{width:min(84vw,306px)!important;max-width:306px!important;background:#fff!important;padding-bottom:env(safe-area-inset-bottom)!important}
  #mobile-drawer-content h1,#mobile-drawer-content h2,#mobile-drawer-content h3{font-size:12px!important;line-height:1.2!important;letter-spacing:.08em!important;text-transform:uppercase!important;margin:14px 14px 6px!important;color:#6B1E26!important}
  #mobile-drawer-content nav{padding:4px 10px 12px!important;gap:2px!important}
  #mobile-drawer-content .nav-link,#mobile-drawer-content nav a{min-height:42px!important;padding:10px 12px!important;border-radius:10px!important;font-size:15px!important;line-height:1.25!important;color:#2D241E!important;background:transparent!important}
  #mobile-drawer-content .nav-link:active,#mobile-drawer-content nav a:active{background:#F6F3EE!important}
  #mobile-drawer-content .nav-link svg,#mobile-drawer-content nav a svg{width:18px!important;height:18px!important;max-width:18px!important;flex:0 0 18px!important}
  #mobile-drawer-content > div:last-child{padding:10px!important;gap:8px!important}
  #mobile-drawer-content > div:last-child a,#mobile-drawer-content > div:last-child button{min-height:42px!important;border-radius:10px!important;font-size:13px!important}

  /* Infografias: remove search/filter block and keep full covers. */
  body.cgpt-infografias-mobile-minimal main{padding-left:16px!important;padding-right:16px!important}
  body.cgpt-infografias-mobile-minimal .cgpt-mobile-hidden-search{display:none!important}
  body.cgpt-infografias-mobile-minimal main h1{font-size:32px!important;line-height:1.05!important;margin:18px 0 10px!important}
  body.cgpt-infografias-mobile-minimal main > section p,
  body.cgpt-infografias-mobile-minimal main > div > p{font-size:15px!important;line-height:1.5!important}
  body.cgpt-infografias-mobile-minimal .seo-card{width:100%!important;max-width:430px!important;margin:0 auto 18px!important;padding:12px!important;border:1px solid #E6DFD4!important;border-radius:18px!important;background:#fff!important;box-shadow:none!important;overflow:hidden!important}
  body.cgpt-infografias-mobile-minimal .seo-card img{display:block!important;width:100%!important;height:auto!important;max-height:none!important;object-fit:contain!important;object-position:center!important;border-radius:12px!important;background:#F9F6F0!important}
  body.cgpt-infografias-mobile-minimal .seo-card h2,
  body.cgpt-infografias-mobile-minimal .seo-card h3{font-size:22px!important;line-height:1.15!important;margin:10px 0 6px!important;overflow-wrap:anywhere!important}
  body.cgpt-infografias-mobile-minimal .seo-card p{font-size:14px!important;line-height:1.45!important;margin:0 0 8px!important;overflow:visible!important;display:block!important}

  /* Catequesis/PDF: remove search/filter block; cards remain untouched. */
  body.cgpt-catequesis-mobile-minimal main{padding-left:16px!important;padding-right:16px!important}
  body.cgpt-catequesis-mobile-minimal .cgpt-mobile-hidden-search{display:none!important}
  body.cgpt-catequesis-mobile-minimal main h1{font-size:32px!important;line-height:1.06!important;margin:18px 0 10px!important}
  body.cgpt-catequesis-mobile-minimal main p{max-width:100%!important}
}
</style>
<script id="catolicosgpt-mobile-minimal-ux-runtime-20260915">
(function(){
  const isMobile=()=>window.matchMedia('(max-width: 767px)').matches;
  const norm=s=>String(s||'').replace(/\\s+/g,' ').trim().toLowerCase();

  function hideSearchForms(matchers){
    document.querySelectorAll('form').forEach(form=>{
      const input=form.querySelector('input[type="search"],input[type="text"]');
      const hay=norm((input&&input.getAttribute('placeholder'))+' '+form.textContent);
      if(matchers.some(m=>hay.includes(m))) form.classList.add('cgpt-mobile-hidden-search');
    });
    document.querySelectorAll('main div,main section').forEach(el=>{
      if(el.classList.contains('cgpt-mobile-hidden-search')) return;
      const input=el.querySelector(':scope > input[type="search"],:scope > input[type="text"]');
      if(!input) return;
      const hay=norm((input.getAttribute('placeholder')||'')+' '+el.textContent);
      if(matchers.some(m=>hay.includes(m))) el.classList.add('cgpt-mobile-hidden-search');
    });
  }

  function setupHome(){
    const p=location.pathname.replace(/\\/+$/,'')||'/';
    if(p!=='/') return;
    document.body.classList.add('cgpt-home-mobile-minimal');
    const welcome=document.getElementById('welcome-screen');
    if(welcome){
      const cards=[...welcome.querySelectorAll('.welcome-card')];
      let daily=cards.find(card=>{
        const t=norm(card.textContent);
        const a=card.querySelector('a[href*="/infografias/"]');
        return t.includes('infografía del día')||t.includes('infografia del dia')||!!a;
      });
      if(!daily){
        daily=[...welcome.querySelectorAll('a')].map(a=>a.closest('.welcome-card')).find(Boolean);
      }
      if(daily) daily.classList.add('cgpt-home-daily-infografia');
    }
    if(!document.querySelector('.cgpt-home-nav-trigger')){
      const trigger=document.createElement('button');
      trigger.type='button'; trigger.className='cgpt-home-nav-trigger';
      trigger.setAttribute('aria-label','Abrir navegación'); trigger.textContent='☰';
      trigger.addEventListener('click',()=>{
        const header=document.querySelector('body > header');
        const btn=header&&header.querySelector('button');
        if(btn) btn.click();
      });
      document.body.appendChild(trigger);
    }
  }

  function setupInfografias(){
    const p=location.pathname.replace(/\\/+$/,'');
    if(p!=='/infografias') return;
    document.body.classList.add('cgpt-infografias-mobile-minimal');
    hideSearchForms(['buscar infografías','buscar infografias']);
  }

  function setupCatequesis(){
    const p=location.pathname.replace(/\\/+$/,'');
    if(!(/catequesis/i.test(p)||p==='/recursos-pdf')) return;
    document.body.classList.add('cgpt-catequesis-mobile-minimal');
    hideSearchForms(['buscar pdf','buscar recursos','buscar guías','buscar guias']);
  }

  function run(){if(!isMobile())return;setupHome();setupInfografias();setupCatequesis();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
</script>`;

Module._extensions['.js'] = function mobileMinimalUxLoader(mod, filename) {
  if (filename !== stableStartPath) return previousLoader(mod, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const anchor = "function readJsonSafe(filename, fallback = {}) {";
  let patched = source;
  if (!patched.includes('catolicosgpt-mobile-minimal-ux-20260915') && patched.includes(anchor)) {
    patched = patched.replace(anchor, `const MOBILE_MINIMAL_UX = ${JSON.stringify(MOBILE_MINIMAL_UX)};\n\n${anchor}`);
    patched = patched.replace("source = source.replace('</head>', STABLE_MOBILE_CSS + '\\n</head>');", "source = source.replace('</head>', STABLE_MOBILE_CSS + MOBILE_MINIMAL_UX + '\\n</head>');");
  }
  try {
    return mod._compile(patched, filename);
  } finally {
    Module._extensions['.js'] = previousLoader;
  }
};
