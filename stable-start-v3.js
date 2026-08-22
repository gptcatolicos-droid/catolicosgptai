// CatolicosGPT home infographic card — gallery-style refinement — 2026-08-22
// Delegates recovery, backup, chat and infographic behavior to stable-start-v2.js.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const HOME_CARD_REFINEMENT = `
<style id="catolicosgpt-home-card-gallery-style">
@media (max-width:767px){
  #welcome-screen .home-infografia-day{
    display:flex!important;
    flex-direction:column!important;
    width:min(78vw,310px)!important;
    height:auto!important;
    max-width:310px!important;
    margin:8px auto 4px!important;
    padding:10px!important;
    overflow:hidden!important;
    border:1px solid #E4DDD3!important;
    border-radius:18px!important;
    background:#fff!important;
    box-shadow:0 5px 18px rgba(37,27,21,.06)!important;
    text-align:left!important;
    text-decoration:none!important;
    color:#2D241E!important;
  }
  #welcome-screen .home-infografia-day::before,
  #welcome-screen .home-infografia-day::after{display:none!important;content:none!important}

  #welcome-screen .home-infografia-day>.home-infografia-preview{
    display:block!important;
    position:static!important;
    width:100%!important;
    height:auto!important;
    max-width:none!important;
    max-height:none!important;
    aspect-ratio:1/1!important;
    object-fit:cover!important;
    object-position:center!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:13px!important;
    background:#F7F3ED!important;
  }

  #welcome-screen .home-infografia-day>.home-infografia-gallery-body{
    display:flex!important;
    flex-direction:column!important;
    gap:7px!important;
    padding:11px 4px 4px!important;
  }
  #welcome-screen .home-infografia-gallery-meta{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    color:#C38E2B!important;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;
    font-size:9px!important;
    line-height:1.1!important;
    font-weight:700!important;
    letter-spacing:.12em!important;
    text-transform:uppercase!important;
  }
  #welcome-screen .home-infografia-gallery-title{
    margin:0!important;
    color:#6B1E26!important;
    font-family:Georgia,'Times New Roman',serif!important;
    font-size:17px!important;
    line-height:1.18!important;
    font-weight:700!important;
    letter-spacing:0!important;
    text-align:left!important;
  }
  #welcome-screen .home-infografia-gallery-description{
    margin:0!important;
    color:#6F6258!important;
    font-family:Georgia,'Times New Roman',serif!important;
    font-size:12px!important;
    line-height:1.38!important;
    text-align:left!important;
    display:-webkit-box!important;
    -webkit-box-orient:vertical!important;
    -webkit-line-clamp:2!important;
    overflow:hidden!important;
  }

  /* Hide the legacy card copy only after the gallery body has been generated. */
  #welcome-screen .home-infografia-day.gallery-home-ready>*:not(.home-infografia-preview):not(.home-infografia-gallery-body){display:none!important}
}
</style>
<script id="catolicosgpt-home-card-gallery-runtime">
(function(){
  function cleanText(value){ return String(value||'').replace(/\\s+/g,' ').trim(); }

  async function refine(){
    const card=document.querySelector('#welcome-screen .home-infografia-day');
    if(!card) return false;
    if(card.classList.contains('gallery-home-ready')) return true;

    let title='';
    let description='';
    let category='DOCTRINAL';
    let slides='';

    try{
      const response=await fetch('/infografia-del-dia',{credentials:'same-origin'});
      if(response.ok){
        const html=await response.text();
        const doc=new DOMParser().parseFromString(html,'text/html');

        const h1=doc.querySelector('main h1');
        if(h1) title=cleanText(h1.textContent);

        const header= h1 ? h1.parentElement : null;
        if(header){
          const p=header.querySelector('p');
          if(p) description=cleanText(p.textContent);
          const meta=cleanText(header.querySelector('div')?.textContent || '');
          const imageMatch=meta.match(/Imágenes:\s*(\d+)/i);
          if(imageMatch) slides=imageMatch[1];
          const categoryMatch=meta.match(/^([^•]+)/);
          if(categoryMatch && cleanText(categoryMatch[1])) category=cleanText(categoryMatch[1]);
        }
      }
    }catch(_){ }

    const legacy=cleanText(card.textContent);
    if(!title){
      title=legacy.replace(/infograf[ií]a del d[ií]a/ig,'').replace(/catequesis visual.*$/i,'').trim() || 'Infografía católica del día';
    }
    if(!description){
      const match=legacy.match(/(Catequesis visual[^.]*\.?)/i);
      description=match ? cleanText(match[1]) : 'Formación católica visual para aprender y compartir.';
    }

    const body=document.createElement('div');
    body.className='home-infografia-gallery-body';

    const meta=document.createElement('div');
    meta.className='home-infografia-gallery-meta';
    const left=document.createElement('span');
    left.textContent=(category || 'DOCTRINAL').toUpperCase();
    const right=document.createElement('span');
    right.textContent=slides ? slides+' DIAPOSITIVAS' : 'INFOGRAFÍA DEL DÍA';
    meta.append(left,right);

    const heading=document.createElement('h2');
    heading.className='home-infografia-gallery-title';
    heading.textContent=title;

    const desc=document.createElement('p');
    desc.className='home-infografia-gallery-description';
    desc.textContent=description;

    body.append(meta,heading,desc);
    card.appendChild(body);
    card.classList.add('gallery-home-ready');
    return true;
  }

  function run(){
    let attempts=0;
    const tick=()=>{
      attempts++;
      Promise.resolve(refine()).then(done=>{
        if(!done && attempts<40) setTimeout(tick,100);
      });
    };
    tick();
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
    // Remove the previous square-overlay refinement if it is present in generated source.
    source = source.replace(/<style id="catolicosgpt-home-card-1x1">[\s\S]*?<\/script>/g, '');
    if (!source.includes('catolicosgpt-home-card-gallery-style')) {
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
