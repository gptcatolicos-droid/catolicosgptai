// CatolicosGPT final UX + favicon + home SEO wrapper — 2026-08-22
// Presentation/SEO only. Delegates all data, backup, recovery and content behavior downstream.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const FAVICON_B64 = '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';

const FINAL_UI = `
<link rel="icon" type="image/png" sizes="96x96" href="/favicon.png?v=20260822">
<link rel="shortcut icon" href="/favicon.ico?v=20260822">
<link rel="apple-touch-icon" href="/favicon.png?v=20260822">
<meta name="keywords" content="IA católica, ChatGPT católico, chat GPT católico, IA cristiana, inteligencia artificial católica, inteligencia artificial cristiana, chatbot católico, CatólicosGPT, catequesis con IA, fe católica e inteligencia artificial">
<meta name="application-name" content="CatólicosGPT">
<meta name="theme-color" content="#6B1E26">
<style id="catolicosgpt-final-ui-v1">
@media(max-width:767px){
  /* Home = conversation-first. No recommendation cards. */
  #welcome-screen .grid,#welcome-screen .welcome-cards,#welcome-screen .home-infografia-day,#welcome-screen .home-infografia-gallery-link{display:none!important}
  #welcome-screen{min-height:auto!important;padding-top:18px!important}

  /* Gallery cover area must never crop 1:1 or portrait assets. */
  body.cgpt-infografias-page .cgpt-inf-card{max-width:340px!important;padding:12px!important}
  body.cgpt-infografias-page .cgpt-inf-card .cgpt-inf-cover{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;overflow:visible!important;background:#F7F3ED!important;border-radius:12px!important;padding:8px!important}
  body.cgpt-infografias-page .cgpt-inf-card .cgpt-inf-cover img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:430px!important;object-fit:contain!important;object-position:center!important;margin:0 auto!important;border-radius:8px!important}
  body.cgpt-infografias-page .cgpt-inf-card [class*="aspect-"]{aspect-ratio:auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
}
</style>
<script id="catolicosgpt-final-ui-runtime-v1">
(function(){
  function finalizeHome(){
    const welcome=document.getElementById('welcome-screen');
    if(!welcome) return;
    [...welcome.querySelectorAll('.grid,.welcome-cards,.home-infografia-day,.home-infografia-gallery-link')].forEach(el=>el.remove());
  }
  function finalizeGallery(){
    if(!/^\/infografias\/?$/.test(location.pathname)) return;
    document.body.classList.add('cgpt-infografias-page');
    document.querySelectorAll('.cgpt-inf-card img').forEach(img=>{
      const p=img.parentElement;
      if(p) p.classList.add('cgpt-inf-cover');
    });
  }
  function run(){finalizeHome();finalizeGallery();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
</script>`;

fs.readFileSync=function finalUxRead(file,...args){
  const result=originalReadFileSync(file,...args);
  try{
    const resolved=path.resolve(String(file));
    const encoding=typeof args[0]==='string'?args[0]:(args[0]&&args[0].encoding);
    if(resolved!==path.resolve(serverPath)||!encoding) return result;
    let source=String(result);

    if(!source.includes("app.get('/favicon.png'")){
      source=source.replace(
        'const app  = express();',
        `const app  = express();\napp.get('/favicon.png',(req,res)=>{res.set('Cache-Control','public, max-age=86400');res.type('png').send(Buffer.from('${FAVICON_B64}','base64'));});\napp.get('/favicon.ico',(req,res)=>{res.set('Cache-Control','public, max-age=86400');res.type('png').send(Buffer.from('${FAVICON_B64}','base64'));});`
      );
    }
    if(!source.includes('catolicosgpt-final-ui-v1')) source=source.replace('</head>',FINAL_UI+'\n</head>');
    return source;
  }catch(_){return result;}
};

try{require('./mobile-ui-shell-fix');}
finally{fs.readFileSync=originalReadFileSync;}
