// CatolicosGPT deterministic CSS bootstrap.
// Purpose: make the UI independent from cdn.tailwindcss.com at runtime.
// It changes presentation delivery only; no catalogs, auth, backup or content data.
const fs = require('fs');
const path = require('path');

const MOBILE_PUBLIC_POLISH = `
<style id="cgpt-public-mobile-polish-20260827">
@media (max-width:767px){
  body.cgpt-public-section main{padding-left:16px!important;padding-right:16px!important;overflow-x:hidden!important}
  body.cgpt-public-section main>div,body.cgpt-public-section main>section,body.cgpt-public-section main>article{width:100%!important;max-width:100%!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}
  body.cgpt-public-section main h1{font-size:36px!important;line-height:1.05!important;letter-spacing:-.025em!important;overflow-wrap:anywhere!important;margin-top:14px!important;margin-bottom:14px!important}
  body.cgpt-public-section main h2{font-size:27px!important;line-height:1.12!important;overflow-wrap:anywhere!important}
  body.cgpt-public-section main h3{font-size:22px!important;line-height:1.18!important;overflow-wrap:anywhere!important}
  body.cgpt-public-section main p{font-size:17px!important;line-height:1.55!important;overflow-wrap:anywhere!important}
  body.cgpt-public-section main input,body.cgpt-public-section main select,body.cgpt-public-section main textarea{min-width:0!important;max-width:100%!important;font-size:16px!important;box-sizing:border-box!important}
  body.cgpt-public-section main form{width:100%!important;max-width:100%!important;box-sizing:border-box!important}
  body.cgpt-public-section main img{max-width:100%!important;height:auto!important}

  body.cgpt-catalog-page main form input[type="text"],body.cgpt-catalog-page main form input[type="search"]{width:100%!important;height:48px!important;padding:10px 14px!important}
  body.cgpt-catalog-page main form button{min-height:48px!important;padding:10px 18px!important;font-size:16px!important;line-height:1.1!important;white-space:nowrap!important}
  body.cgpt-catalog-page main a[class*="rounded-full"],body.cgpt-catalog-page main button[class*="rounded-full"]{font-size:14px!important;line-height:1.1!important;padding:6px 10px!important;min-height:34px!important;white-space:normal!important;text-align:center!important}

  body.cgpt-infografia-detail main{padding-left:18px!important;padding-right:18px!important}
  body.cgpt-infografia-detail main h1{font-size:34px!important;line-height:1.06!important}
  body.cgpt-infografia-detail main [id^="vista-"]{width:100%!important;max-width:100%!important}
  body.cgpt-infografia-detail main [id^="vista-"] img{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;object-fit:contain!important;margin:0 auto!important}
  body.cgpt-infografia-detail main figure{width:100%!important;max-width:100%!important;margin:14px 0!important;overflow:hidden!important}
  body.cgpt-infografia-detail main figcaption{display:flex!important;flex-wrap:wrap!important;justify-content:space-between!important;gap:6px!important;font-size:13px!important;line-height:1.25!important;padding:9px 10px!important;overflow-wrap:anywhere!important}
  body.cgpt-infografia-detail main [role="tablist"],body.cgpt-infografia-detail main .visualization-tabs{display:flex!important;flex-wrap:wrap!important;gap:6px!important;width:100%!important;max-width:100%!important}
  body.cgpt-infografia-detail main [role="tab"],body.cgpt-infografia-detail main .visualization-tabs button{font-size:14px!important;line-height:1.1!important;padding:7px 10px!important;min-height:34px!important}

  body.cgpt-ninos-page main h1{font-size:34px!important;line-height:1.05!important}
  body.cgpt-ninos-page main h2{font-size:27px!important;line-height:1.1!important}
  body.cgpt-ninos-page main .seo-card h2,body.cgpt-ninos-page main .seo-card h3{font-size:24px!important;line-height:1.12!important}
  body.cgpt-ninos-page main .seo-card p{font-size:16px!important;line-height:1.48!important}
}
</style>
<script id="cgpt-public-mobile-polish-runtime-20260827">
(function(){
  function mark(){
    var p=(location.pathname||'/').toLowerCase();
    var b=document.body;if(!b)return;
    if(p==='/infografias'||p.startsWith('/infografias/')||p==='/ninos'||p==='/blog'||p.startsWith('/blog/')) b.classList.add('cgpt-public-section');
    if(p==='/infografias'||p==='/ninos'||p==='/blog') b.classList.add('cgpt-catalog-page');
    if(p.startsWith('/infografias/')) b.classList.add('cgpt-infografia-detail');
    if(p==='/ninos'||p.startsWith('/ninos/')) b.classList.add('cgpt-ninos-page');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mark,{once:true});else mark();
})();
</script>`;

if (!global.__CGPT_LOCAL_TAILWIND_RUNTIME__) {
  global.__CGPT_LOCAL_TAILWIND_RUNTIME__ = true;

  const serverPath = require.resolve('./server');
  const originalReadFileSync = fs.readFileSync.bind(fs);

  fs.readFileSync = function cgptLocalTailwindRead(file, ...args) {
    const result = originalReadFileSync(file, ...args);
    try {
      const resolved = path.resolve(String(file));
      const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
      if (resolved !== path.resolve(serverPath) || !encoding) return result;

      let source = String(result);
      const middlewareAnchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
      const staticMarker = '// __CGPT_LOCAL_TAILWIND_STATIC__';
      if (source.includes(middlewareAnchor) && !source.includes(staticMarker)) {
        const staticRoute = `\n${staticMarker}\napp.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h', immutable: false }));\n`;
        source = source.replace(middlewareAnchor, middlewareAnchor + staticRoute);
      }

      const cdnScript = '<script src="https://cdn.tailwindcss.com"></script>';
      const localCss = '<link rel="stylesheet" href="/assets/tailwind.css?v=20260826">';
      if (!source.includes(localCss)) {
        if (source.includes(cdnScript)) source = source.replace(cdnScript, `${localCss}\n  ${cdnScript}`);
        else if (source.includes('</head>')) source = source.replace('</head>', `  ${localCss}\n</head>`);
      }

      if (!source.includes('cgpt-public-mobile-polish-20260827') && source.includes('</head>')) {
        source = source.replace('</head>', MOBILE_PUBLIC_POLISH + '\n</head>');
      }

      // If the CDN is blocked/slow, its missing global must not abort later scripts.
      if (source.includes('tailwind.config = {') && !source.includes('if (window.tailwind) tailwind.config = {')) {
        source = source.replace('tailwind.config = {', 'if (window.tailwind) tailwind.config = {');
      }

      return source;
    } catch (_) {
      return result;
    }
  };
}

module.exports = { installed: true };
