// CatolicosGPT final home-card refinement — 2026-08-22
// Delegates all recovery, backup, chat and infographic behavior to stable-start-v2.js.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const HOME_CARD_REFINEMENT = `
<style id="catolicosgpt-home-card-1x1">
@media (max-width:767px){
  #welcome-screen .home-infografia-day{
    position:relative!important;
    width:min(76vw,320px)!important;
    height:min(76vw,320px)!important;
    max-width:320px!important;
    max-height:320px!important;
    aspect-ratio:1/1!important;
    margin:8px auto 4px!important;
    padding:0!important;
    overflow:hidden!important;
    border:1px solid rgba(195,142,43,.48)!important;
    border-radius:22px!important;
    background:#2c211b!important;
    box-shadow:0 8px 24px rgba(37,27,21,.10)!important;
  }
  #welcome-screen .home-infografia-day>.home-infografia-preview{
    display:block!important;
    position:absolute!important;
    inset:0!important;
    width:100%!important;
    height:100%!important;
    max-width:none!important;
    max-height:none!important;
    aspect-ratio:1/1!important;
    object-fit:cover!important;
    object-position:center!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;
  }
  #welcome-screen .home-infografia-day>*:not(.home-infografia-preview){display:none!important}
  #welcome-screen .home-infografia-day::before{
    content:'';
    position:absolute;
    z-index:2;
    left:0;right:0;bottom:0;
    height:43%;
    background:linear-gradient(to top,rgba(28,18,14,.92),rgba(28,18,14,.03));
    pointer-events:none;
  }
  #welcome-screen .home-infografia-day::after{
    content:'INFOGRAFÍA DEL DÍA\\A' attr(data-infografia-title);
    white-space:pre-line;
    position:absolute;
    z-index:3;
    left:16px;right:16px;bottom:15px;
    color:#fff;
    font-family:Georgia,'Times New Roman',serif;
    font-size:15px;
    line-height:1.2;
    font-weight:700;
    text-align:left;
    text-shadow:0 1px 3px rgba(0,0,0,.5);
    pointer-events:none;
  }
  #welcome-screen .home-infografia-day::first-line{
    color:#D7A33F;
    font-size:10px;
    letter-spacing:.12em;
  }
}
</style>
<script id="catolicosgpt-home-card-1x1-runtime">
(function(){
  function refine(){
    const card=document.querySelector('#welcome-screen .home-infografia-day');
    if(!card) return false;
    const raw=(card.textContent||'').replace(/\\s+/g,' ').trim();
    const title=raw.replace(/infograf[ií]a del d[ií]a/ig,'').trim();
    card.setAttribute('data-infografia-title',title || 'Formación católica en imágenes');
    return true;
  }
  function run(){
    if(refine()) return;
    let attempts=0;
    const timer=setInterval(()=>{ attempts++; if(refine() || attempts>30) clearInterval(timer); },100);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
</script>`;

fs.readFileSync = function homeCardRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
    if (resolved !== path.resolve(serverPath) || !encoding) return result;
    let source = String(result);
    if (!source.includes('catolicosgpt-home-card-1x1')) {
      source = source.replace('</head>', HOME_CARD_REFINEMENT + '\n</head>');
    }
    return source;
  } catch (_) {
    return result;
  }
};

try {
  require('./stable-start-v2');
} finally {
  fs.readFileSync = originalReadFileSync;
}
