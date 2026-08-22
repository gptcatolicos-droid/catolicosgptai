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
    width:min(68vw,270px)!important;
    height:auto!important;
    max-width:270px!important;
    margin:6px auto 3px!important;
    padding:9px!important;
    overflow:hidden!important;
    border:1px solid #E4DDD3!important;
    border-radius:17px!important;
    background:#fff!important;
    box-shadow:0 4px 15px rgba(37,27,21,.055)!important;
    text-align:left!important;
    text-decoration:none!important;
    color:#2D241E!important;
    cursor:pointer!important;
  }
  #welcome-screen .home-infografia-day:active{transform:scale(.99)!important}
  #welcome-screen .home-infografia-day::before,
  #welcome-screen .home-infografia-day::after{display:none!important;content:none!important}

  #welcome-screen .home-infografia-day>.home-infografia-preview{
    display:block!important;
    position:static!important;
    width:100%!important;
    height:auto!important;
    max-width:100%!important;
    max-height:245px!important;
    aspect-ratio:1/1!important;
    object-fit:contain!important;
    object-position:center!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:12px!important;
    background:#F7F3ED!important;
  }

  #welcome-screen .home-infografia-day>.home-infografia-gallery-body{
    display:flex!important;
    flex-direction:column!important;
    gap:6px!important;
    padding:9px 3px 3px!important;
  }
  #welcome-screen .home-infografia-gallery-meta{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    color:#C38E2B!important;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;
    font-size:8px!important;
    line-height:1.1!important;
    font-weight:700!important;
    letter-spacing:.11em!important;
    text-transform:uppercase!important;
  }
  #welcome-screen .home-infografia-gallery-title{
    margin:0!important;
    color:#6B1E26!important;
    font-family:Georgia,'Times New Roman',serif!important;
    font-size:15px!important;
    line-height:1.18!important;
    font-weight:700!important;
    letter-spacing:0!important;
    text-align:left!important;
  }
  #welcome-screen .home-infografia-gallery-description{
    margin:0!important;
    color:#6F6258!important;
    font-family:Georgia,'Times New Roman',serif!important;
    font-size:11px!important;
    line-height:1.38!important;
    text-align:left!important;
    display:-webkit-box!important;
    -webkit-box-orient:vertical!important;
    -webkit-line-clamp:2!important;
    overflow:hidden!important;
  }

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
    let detailUrl='/infografia-del-dia';

    try{
      const response=await fetch('/infografia-del-dia',{credentials:'same-origin'});
      if(response.ok){
        const html=await response.text();
        const doc=new DOMParser().parseFromString(html,'text/html');

        const canonical=doc.querySelector('link[rel="canonical"]');
        if(canonical && canonical.href){
          try{ detailUrl=new URL(canonical.href,window.location.origin).pathname; }catch(_){ }
        } else if(response.url){
          try{ detailUrl=new URL(response.url).pathname; }catch(_){ }
        }

        const h1=doc.querySelector('main h1');
        if(h1) title=cleanText(h1.textContent);

        const metaDescription=doc.querySelector('meta[name="description"]');
        if(metaDescription && metaDescription.content) description=cleanText(metaDescription.content);

        const header=h1 ? h1.parentElement : null;
        if(header){
          if(!description){
            const p=header.querySelector('p');
            if(p) description=cleanText(p.textContent);
          }
          const meta=cleanText(header.querySelector('div')?.textContent || '');
          const imageMatch=meta.match(/Imágenes:\\s*(\\d+)/i);
          if(imageMatch) slides=imageMatch[1];
          const categoryMatch=meta.match(/^([^•]+)/);
          if(categoryMatch && cleanText(categoryMatch[1])) category=cleanText(categoryMatch[1]);
        }

        const image=doc.querySelector('#vista-continua img') || doc.querySelector('[data-infografia-frame] img') || doc.querySelector('main img');
        const preview=card.querySelector('.home-infografia-preview');
        if(image && preview && image.src) preview.src=image.src;
      }
    }catch(_){ }

    const legacy=cleanText(card.textContent);
    if(!title){
      title=legacy.replace(/infograf[ií]a del d[ií]a/ig,'').replace(/catequesis visual.*$/i,'').trim() || 'Infografía católica del día';
    }
    if(!description){
      description='Formación católica visual para aprender, compartir y profundizar en la fe.';
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
    card.setAttribute('role','link');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label','Abrir '+title);

    const openDetail=()=>{ window.location.href=detailUrl || '/infografia-del-dia'; };
    card.addEventListener('click',openDetail);
    card.addEventListener('keydown',event=>{
      if(event.key==='Enter' || event.key===' '){ event.preventDefault(); openDetail(); }
    });
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
    source = source.replace(/<style id="catolicosgpt-home-card-1x1">[\\s\\S]*?<\\/script>/g, '');
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
