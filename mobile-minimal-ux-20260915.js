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
      if(parent) parent.classList.add('cgpt-minimal-filter-shell');
      form.remove();
    });
  }

  // La página de inicio (chat) ya no usa este parche: tiene su propia hoja
  // dedicada (agent-ui.css) y ya no existen las tarjetas de bienvenida que
  // este bloque recortaba, así que dejarlo activo solo producía clases y
  // reglas CSS en conflicto con el rediseño del chat.

  function setupInfografias(){
    const p=location.pathname.replace(/\\/+$/,'');
    if(p!=='/infografias') return;
    if(isMobile()) document.body.classList.add('cgpt-infografias-mobile-minimal');
    removeSearchAndMinimizeShell(['buscar infografías','buscar infografias']);
  }

  function setupCatequesis(){
    const p=location.pathname.replace(/\\/+$/,'');
    if(p!=='/catequesis-ia'&&p!=='/recursos-pdf') return;
    if(isMobile()) document.body.classList.add('cgpt-catequesis-mobile-minimal');
    removeSearchAndMinimizeShell(['buscar pdf','buscar recursos','buscar guías','buscar guias']);
  }

  function run(){
    setupInfografias();
    setupCatequesis();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
</script>`;

// Lo inyectado no aterriza en el HTML: aterriza DENTRO de un literal de
// plantilla del propio server.js, que se vuelve a resolver al renderizar. Sin
// escapar, /\\s+/ llega al navegador como /s+/ (busca la letra "s", no
// espacios) y /\\/+$/ como //+$/, que es un comentario y rompe el script entero.
function escaparParaPlantilla(texto) {
  return String(texto)
    .replace(/\\\\/g, '\\\\\\\\')
    .replace(/`/g, '\\\\`')
    .replace(/\\$\\{/g, '\\\\${');
}

Module._extensions['.js'] = function mobileMinimalUxLoader(mod, filename) {
  if (filename !== stableStartPath) return previousLoader(mod, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const anchor = "function readJsonSafe(filename, fallback = {}) {";
  let patched = source;

  if (!patched.includes('catolicosgpt-mobile-minimal-ux-20260915') && patched.includes(anchor)) {
    patched = patched.replace(anchor, `const MOBILE_MINIMAL_UX = ${JSON.stringify(escaparParaPlantilla(MOBILE_MINIMAL_UX))};\n\n${anchor}`);

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
