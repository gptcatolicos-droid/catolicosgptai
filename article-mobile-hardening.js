// CatolicosGPT editorial/blog mobile hardening — 2026-08-22
// Pure presentation layer. Does not touch content, recovery, backup or data catalogs.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const ARTICLE_MOBILE_UI = `
<style id="catolicosgpt-editorial-mobile-v1">
@media (max-width:767px){
  body.cgpt-reading-page{overflow-x:hidden!important}
  body.cgpt-reading-page main{width:100%!important;max-width:100%!important;overflow-x:hidden!important;padding-left:16px!important;padding-right:16px!important}
  body.cgpt-reading-page main>div,
  body.cgpt-reading-page main>section,
  body.cgpt-reading-page main>article{width:100%!important;max-width:720px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}

  body.cgpt-reading-page main h1{font-size:32px!important;line-height:1.08!important;letter-spacing:-.02em!important;margin:10px 0 14px!important;overflow-wrap:anywhere!important;word-break:normal!important}
  body.cgpt-reading-page main h2{font-size:24px!important;line-height:1.15!important;margin:26px 0 10px!important;overflow-wrap:anywhere!important}
  body.cgpt-reading-page main h3{font-size:20px!important;line-height:1.2!important;margin:22px 0 8px!important;overflow-wrap:anywhere!important}
  body.cgpt-reading-page main h4{font-size:18px!important;line-height:1.25!important;margin:18px 0 7px!important}

  body.cgpt-reading-page main p,
  body.cgpt-reading-page main li,
  body.cgpt-reading-page main blockquote{font-size:17px!important;line-height:1.62!important;letter-spacing:0!important;overflow-wrap:anywhere!important;word-break:normal!important}
  body.cgpt-reading-page main p{margin:0 0 15px!important}
  body.cgpt-reading-page main ul,
  body.cgpt-reading-page main ol{padding-left:22px!important;margin:12px 0 18px!important}
  body.cgpt-reading-page main li{margin:5px 0!important}
  body.cgpt-reading-page main blockquote{margin:18px 0!important;padding:13px 15px!important;border-left:3px solid #C38E2B!important;background:#F8F3EA!important}

  body.cgpt-reading-page main img,
  body.cgpt-reading-page main picture,
  body.cgpt-reading-page main video,
  body.cgpt-reading-page main iframe{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}

  body.cgpt-reading-page main a{overflow-wrap:anywhere!important}
  body.cgpt-reading-page main a[class*="px-"],
  body.cgpt-reading-page main a[class*="py-"],
  body.cgpt-reading-page main button{display:inline-flex!important;align-items:center!important;justify-content:center!important;max-width:100%!important;min-height:42px!important;padding:10px 14px!important;font-size:14px!important;line-height:1.2!important;white-space:normal!important;text-align:center!important;border-radius:10px!important;box-sizing:border-box!important}

  body.cgpt-reading-page main nav,
  body.cgpt-reading-page main .flex{max-width:100%!important;flex-wrap:wrap!important;gap:8px!important}

  body.cgpt-reading-page main table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;border-collapse:collapse!important;font-size:14px!important}
  body.cgpt-reading-page main th,
  body.cgpt-reading-page main td{min-width:120px!important;max-width:260px!important;padding:9px!important;font-size:14px!important;line-height:1.38!important;white-space:normal!important;overflow-wrap:anywhere!important;vertical-align:top!important}

  body.cgpt-reading-page main pre{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;font-size:13px!important}

  body.cgpt-reading-page .prose,
  body.cgpt-reading-page [class*="prose"]{max-width:100%!important;font-size:17px!important;line-height:1.62!important}

  /* Editorial eyebrow/category labels */
  body.cgpt-reading-page main [class*="uppercase"],
  body.cgpt-reading-page main [class*="tracking-"]{font-size:12px!important;line-height:1.25!important;letter-spacing:.08em!important}

  /* Avoid desktop hero spacing on mobile */
  body.cgpt-reading-page main [class*="py-20"],
  body.cgpt-reading-page main [class*="py-24"],
  body.cgpt-reading-page main [class*="py-32"]{padding-top:24px!important;padding-bottom:24px!important}
  body.cgpt-reading-page main [class*="px-10"],
  body.cgpt-reading-page main [class*="px-12"],
  body.cgpt-reading-page main [class*="px-16"]{padding-left:16px!important;padding-right:16px!important}
}
</style>
<script id="catolicosgpt-editorial-mobile-runtime-v1">
(function(){
  function shouldMark(){
    const p=(location.pathname||'/').toLowerCase();
    const excluded=['/','/infografias','/infografia-del-dia','/ninos','/catequesis-ia','/santoral','/admin','/login','/registro','/oraciones','/videos','/podcasts','/misas'];
    if(excluded.some(x=>p===x || p.startsWith(x+'/'))) return false;
    if(document.getElementById('welcome-screen') || document.getElementById('vista-continua')) return false;
    const main=document.querySelector('main');
    if(!main) return false;
    const h1=main.querySelector('h1');
    const paragraphs=main.querySelectorAll('p');
    if(!h1 || paragraphs.length<1) return false;
    return (h1.textContent||'').trim().length>12;
  }
  function mark(){ if(shouldMark()) document.body.classList.add('cgpt-reading-page'); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mark,{once:true});
  else mark();
})();
</script>`;

fs.readFileSync = function articleHardeningRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved=path.resolve(String(file));
    const encoding=typeof args[0]==='string' ? args[0] : (args[0] && args[0].encoding);
    if(resolved!==path.resolve(serverPath) || !encoding) return result;
    let source=String(result);
    if(!source.includes('catolicosgpt-editorial-mobile-v1')){
      source=source.replace('</head>',ARTICLE_MOBILE_UI+'\n</head>');
    }
    return source;
  }catch(_){
    return result;
  }
};

try{
  require('./stable-start-v3');
}finally{
  fs.readFileSync=originalReadFileSync;
}
