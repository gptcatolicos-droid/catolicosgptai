// Mobile UX refinement for CatolicosGPT — 2026-09-15
// Presentation-only patch. Does not change content, admin data, daily selections,
// routes, SEO records, Google Drive URLs, Cloudinary URLs or desktop rendering.
const fs = require('fs');
const Module = require('module');

const stableStartPath = require.resolve('./stable-start');
const previousLoader = Module._extensions['.js'];

const MOBILE_MINIMAL_UX = `
<style id="catolicosgpt-mobile-minimal-ux-20260915">
@media (max-width:767px){
  /* Shared mobile shell: keep the existing branded header, reduce visual noise. */
  body{background:#F9F6F0!important}
  body>header{box-shadow:none!important;border-bottom:1px solid #EAE5DD!important;background:rgba(255,255,255,.98)!important}

  /* Home: one useful daily card, no visible nested scrollbar. */
  body.cgpt-home-mobile-minimal .chat-shell{height:calc(100svh - 70px)!important;min-height:0!important;overflow:hidden!important}
  body.cgpt-home-mobile-minimal #chat-box{padding:18px 16px 8px!important;scrollbar-width:none!important;-ms-overflow-style:none!important}
  body.cgpt-home-mobile-minimal #chat-box::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
  body.cgpt-home-mobile-minimal #welcome-screen{padding:4px 0 12px!important;gap:12px!important;justify-content:flex-start!important;min-height:100%!important}
  body.cgpt-home-mobile-minimal #welcome-screen>div:first-child{width:38px!important;height:38px!important;border-radius:12px!important}
  body.cgpt-home-mobile-minimal #welcome-screen h1{font-size:24px!important;line-height:1.08!important;max-width:320px!important;margin:0 auto!important}
  body.cgpt-home-mobile-minimal #welcome-screen>p{font-size:14px!important;line-height:1.42!important;max-width:330px!important;margin:0 auto!important;color:#5F554D!important}
  body.cgpt-home-mobile-minimal .welcome-cards{display:block!important;width:100%!important;max-width:390px!important;margin:4px auto 0!important;padding:0!important}
  body.cgpt-home-mobile-minimal .welcome-card{display:none!important}
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia{display:flex!important;width:100%!important;min-height:0!important;margin:0!important;padding:16px!important;border:1px solid #E6DFD4!important;border-radius:18px!important;background:#fff!important;box-shadow:none!important;gap:10px!important;text-decoration:none!important}
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia .welcome-card-icon{width:38px!important;height:38px!important;border-radius:12px!important;flex:0 0 38px!important}
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia .welcome-card-title{font-size:11px!important;line-height:1.2!important;letter-spacing:.08em!important}
  body.cgpt-home-mobile-minimal .welcome-card.cgpt-home-daily-infografia .welcome-card-text{font-size:15px!important;line-height:1.32!important;display:block!important;-webkit-line-clamp:unset!important;overflow:visible!important}

  /* Minimal filter chips shared by Infografias and Catequesis IA. */
  .cgpt-minimal-filter-shell{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:0!important;margin:0!important;gap:8px!important}
  .cgpt-minimal-filter-shell nav,.cgpt-minimal-filter-shell>div{gap:7px!important;justify-content:flex-start!important}
  .cgpt-minimal-filter-shell a{font-size:12px!important;line-height:1!important;padding:8px 12px!important;border-radius:999px!important;text-decoration:none!important}

  /* Infografias: full covers, compact type, no search field. */
  body.cgpt-infografias-mobile-minimal main{padding-left:16px!important;padding-right:16px!important}
  body.cgpt-infografias-mobile-minimal .cgpt-mobile-hidden-search{display:none!important}
  body.cgpt-infografias-mobile-minimal main>div{max-width:560px!important;margin-left:auto!important;margin-right:auto!important}
  body.cgpt-infografias-mobile-minimal main h1{font-size:30px!important;line-height:1.06!important;margin:18px 0 8px!important;letter-spacing:-.015em!important}
  body.cgpt-infografias-mobile-minimal main h1+p{font-size:15px!important;line-height:1.45!important;margin-bottom:6px!important}
  body.cgpt-infografias-mobile-minimal .seo-card{width:100%!important;max-width:430px!important;margin:0 auto 18px!important;padding:12px!important;border:1px solid #E6DFD4!important;border-radius:18px!important;background:#fff!important;box-shadow:none!important;overflow:hidden!important}
  body.cgpt-infografias-mobile-minimal .seo-card img{display:block!important;width:100%!important;height:auto!important;max-height:none!important;object-fit:contain!important;object-position:center!important;border-radius:12px!important;background:#F9F6F0!important}
  body.cgpt-infografias-mobile-minimal .seo-card h2,
  body.cgpt-infografias-mobile-minimal .seo-card h3{font-size:20px!important;line-height:1.18!important;margin:10px 0 6px!important;overflow-wrap:anywhere!important}
  body.cgpt-infografias-mobile-minimal .seo-card p{font-size:14px!important;line-height:1.45!important;margin:0 0 8px!important;overflow:visible!important;display:block!important}

  /* Catequesis IA: no search field; clean cards and simple audience chips. */
  body.cgpt-catequesis-mobile-minimal main{padding-left:16px!important;padding-right:16px!important}
  body.cgpt-catequesis-mobile-minimal .cgpt-mobile-hidden-search{display:none!important}
  body.cgpt-catequesis-mobile-minimal main>div{max-width:560px!important;margin-left:auto!important;margin-right:auto!important}
  body.cgpt-catequesis-mobile-minimal main h1{font-size:30px!important;line-height:1.06!important;margin:18px 0 8px!important;letter-spacing:-.015em!important}
  body.cgpt-catequesis-mobile-minimal main h1+p{font-size:15px!important;line-height:1.45!important}
  body.cgpt-catequesis-mobile-minimal .seo-card{border:1px solid #E6DFD4!important;border-radius:18px!important;box-shadow:none!important;background:#fff!important}
}
</style>
<script id="catolicosgpt-mobile-minimal-ux-runtime-20260915">
(function(){
  const isMobile=()=>window.matchMedia('(max-width: 767px)').matches;
  const norm=s=>String(s||'').replace(/\\s+/g,' ').trim().toLowerCase();

  function removeSearchAndMinimizeShell(matchers){
    document.querySelectorAll('form').forEach(form=>{
      const input=form.querySelector('input[type="search"],input[type="text"]');
      if(!input) return;
      const hay=norm((input.getAttribute('placeholder')||'')+' '+form.textContent);
      if(!matchers.some(m=>hay.includes(m))) return;
      const parent=form.parentElement;
      form.classList.add('cgpt-mobile-hidden-search');
      if(parent) parent.classList.add('cgpt-minimal-filter-shell');
    });
  }

  function setupHome(){
    const p=location.pathname.replace(/\\/+$/,'')||'/';
    if(p!=='/') return;
    document.body.classList.add('cgpt-home-mobile-minimal');
    const welcome=document.getElementById('welcome-screen');
    if(!welcome) return;

    const cards=[...welcome.querySelectorAll('.welcome-card')];
    let daily=cards.find(card=>{
      const t=norm(card.textContent);
      const href=String(card.getAttribute('href')||'');
      return t.includes('infografía del día')||t.includes('infografia del dia')||href.includes('/infografia-del-dia');
    });
    if(!daily){
      daily=cards.find(card=>String(card.getAttribute('href')||'').includes('/infografia'))||null;
    }
    cards.forEach(card=>{
      if(card===daily) card.classList.add('cgpt-home-daily-infografia');
      else card.remove();
    });
  }

  function setupInfografias(){
    const p=location.pathname.replace(/\\/+$/,'');
    if(p!=='/infografias') return;
    document.body.classList.add('cgpt-infografias-mobile-minimal');
    removeSearchAndMinimizeShell(['buscar infografías','buscar infografias']);
  }

  function setupCatequesis(){
    const p=location.pathname.replace(/\\/+$/,'');
    if(p!=='/catequesis-ia'&&p!=='/recursos-pdf') return;
    document.body.classList.add('cgpt-catequesis-mobile-minimal');
    removeSearchAndMinimizeShell(['buscar pdf','buscar recursos','buscar guías','buscar guias']);
  }

  function run(){
    if(!isMobile()) return;
    setupHome();
    setupInfografias();
    setupCatequesis();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
</script>`;

Module._extensions['.js'] = function mobileMinimalUxLoader(mod, filename) {
  if (filename !== stableStartPath) return previousLoader(mod, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const anchor = "function readJsonSafe(filename, fallback = {}) {";
  let patched = source;

  if (!patched.includes('catolicosgpt-mobile-minimal-ux-20260915') && patched.includes(anchor)) {
    patched = patched.replace(anchor, `const MOBILE_MINIMAL_UX = ${JSON.stringify(MOBILE_MINIMAL_UX)};\n\n${anchor}`);

    // stable-start contains a literal "\\n" in the source. Match that exact text.
    const injectionLine = "source = source.replace('</head>', STABLE_MOBILE_CSS + '\\n</head>');";
    const replacementLine = "source = source.replace('</head>', STABLE_MOBILE_CSS + MOBILE_MINIMAL_UX + '\\n</head>');";
    if (patched.includes(injectionLine)) {
      patched = patched.replace(injectionLine, replacementLine);
    }
  }

  try {
    return mod._compile(patched, filename);
  } finally {
    Module._extensions['.js'] = previousLoader;
  }
};
