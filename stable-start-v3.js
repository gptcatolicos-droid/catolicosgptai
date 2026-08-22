// CatolicosGPT home infographic card — clean gallery card — 2026-08-22
// Delegates recovery, backup, chat and infographic behavior to stable-start-v2.js.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const HOME_CARD_REFINEMENT = `
<style id="catolicosgpt-home-card-clean-v4">
@media (max-width:767px){
  #welcome-screen .home-infografia-gallery-link{
    display:block!important;
    width:min(62vw,245px)!important;
    max-width:245px!important;
    margin:6px auto 4px!important;
    padding:9px!important;
    border:1px solid #E4DDD3!important;
    border-radius:16px!important;
    background:#fff!important;
    box-shadow:0 4px 14px rgba(37,27,21,.055)!important;
    color:#2D241E!important;
    text-decoration:none!important;
    overflow:hidden!important;
    -webkit-tap-highlight-color:transparent!important;
  }
  #welcome-screen .home-infografia-gallery-link:active{
    transform:scale(.985)!important;
  }
  #welcome-screen .home-infografia-gallery-cover{
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:100%!important;
    aspect-ratio:1/1!important;
    overflow:hidden!important;
    border-radius:11px!important;
    background:#F7F3ED!important;
  }
  #welcome-screen .home-infografia-gallery-cover img{
    display:block!important;
    width:auto!important;
    height:auto!important;
    max-width:100%!important;
    max-height:100%!important;
    object-fit:contain!important;
    object-position:center!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
  }
  #welcome-screen .home-infografia-gallery-body-v4{
    display:flex!important;
    flex-direction:column!important;
    gap:6px!important;
    padding:9px 3px 2px!important;
  }
  #welcome-screen .home-infografia-gallery-meta-v4{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    color:#C38E2B!important;
    font-family:Arial,Helvetica,sans-serif!important;
    font-size:8px!important;
    line-height:1.1!important;
    font-weight:700!important;
    letter-spacing:.1em!important;
    text-transform:uppercase!important;
  }
  #welcome-screen .home-infografia-gallery-title-v4{
    margin:0!important;
    color:#6B1E26!important;
    font-family:Georgia,'Times New Roman',serif!important;
    font-size:15px!important;
    line-height:1.18!important;
    font-weight:700!important;
    text-align:left!important;
  }
  #welcome-screen .home-infografia-gallery-description-v4{
    margin:0!important;
    color:#6F6258!important;
    font-family:Georgia,'Times New Roman',serif!important;
    font-size:10.5px!important;
    line-height:1.35!important;
    text-align:left!important;
    display:block!important;
    overflow:visible!important;
    white-space:normal!important;
  }
}
</style>
<script id="catolicosgpt-home-card-clean-runtime-v4">
(function(){
  function cleanText(value){ return String(value||'').replace(/\\s+/g,' ').trim(); }

  async function buildCard(){
    const oldCard=document.querySelector('#welcome-screen .home-infografia-day');
    if(!oldCard) return false;
    if(document.querySelector('#welcome-screen .home-infografia-gallery-link')) return true;

    let title='Infografía católica del día';
    let category='DOCTRINAL';
    let slides='';
    let imageUrl='';
    let detailUrl='/infografia-del-dia';

    try{
      const response=await fetch('/infografia-del-dia',{credentials:'same-origin',cache:'no-store'});
      if(response.ok){
        const html=await response.text();
        const doc=new DOMParser().parseFromString(html,'text/html');

        const h1=doc.querySelector('main h1');
        if(h1 && cleanText(h1.textContent)) title=cleanText(h1.textContent);

        const image=doc.querySelector('#vista-continua img') || doc.querySelector('[data-infografia-frame] img') || doc.querySelector('main img');
        if(image && image.src) imageUrl=image.src;

        const header=h1 ? h1.parentElement : null;
        if(header){
          const metaText=cleanText(header.textContent);
          const imageMatch=metaText.match(/Imágenes:\\s*(\\d+)/i);
          if(imageMatch) slides=imageMatch[1];
          const catMatch=metaText.match(/(?:^|\\s)(doctrinal|santo|devocional|serie|catequesis(?:-j[oó]venes)?)/i);
          if(catMatch) category=cleanText(catMatch[1]);
        }

        const canonical=doc.querySelector('link[rel="canonical"]');
        if(canonical && canonical.getAttribute('href')){
          try{
            const candidate=new URL(canonical.getAttribute('href'),window.location.origin);
            if(candidate.pathname && candidate.pathname!=='/') detailUrl=candidate.pathname+candidate.search;
          }catch(_){ }
        }
      }
    }catch(_){ }

    if(!imageUrl){
      const existing=oldCard.querySelector('.home-infografia-preview, img');
      if(existing && existing.src) imageUrl=existing.src;
    }

    /* Always keep a working route even when canonical points back to home. */
    if(!detailUrl || detailUrl==='/') detailUrl='/infografia-del-dia';

    const link=document.createElement('a');
    link.className='home-infografia-gallery-link';
    link.href=detailUrl;
    link.setAttribute('aria-label','Abrir '+title);

    const cover=document.createElement('div');
    cover.className='home-infografia-gallery-cover';
    const img=document.createElement('img');
    img.src=imageUrl;
    img.alt=title;
    img.loading='eager';
    img.decoding='async';
    cover.appendChild(img);

    const body=document.createElement('div');
    body.className='home-infografia-gallery-body-v4';

    const meta=document.createElement('div');
    meta.className='home-infografia-gallery-meta-v4';
    const left=document.createElement('span');
    left.textContent=(category||'DOCTRINAL').toUpperCase();
    const right=document.createElement('span');
    right.textContent=slides ? slides+' DIAPOSITIVAS' : 'INFOGRAFÍA DEL DÍA';
    meta.append(left,right);

    const heading=document.createElement('h2');
    heading.className='home-infografia-gallery-title-v4';
    heading.textContent=title;

    const desc=document.createElement('p');
    desc.className='home-infografia-gallery-description-v4';
    desc.textContent=slides
      ? 'Descubre esta infografía católica y recorre sus '+slides+' diapositivas.'
      : 'Descubre esta infografía católica, aprende y compártela.';

    body.append(meta,heading,desc);
    link.append(cover,body);

    oldCard.replaceWith(link);
    return true;
  }

  function run(){
    let attempts=0;
    const tick=()=>{
      attempts++;
      Promise.resolve(buildCard()).then(done=>{
        if(!done && attempts<50) setTimeout(tick,100);
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
    const resolved=path.resolve(String(file));
    const encoding=typeof args[0]==='string' ? args[0] : (args[0] && args[0].encoding);
    if(resolved!==path.resolve(serverPath) || !encoding) return result;
    let source=String(result);

    /* Remove prior Home-card refinements so v4 is the only owner of this component. */
    source=source.replace(/<style id="catolicosgpt-home-card-1x1">[\\s\\S]*?<\\/script>/g,'');
    source=source.replace(/<style id="catolicosgpt-home-card-gallery-style">[\\s\\S]*?<\\/script>/g,'');
    if(!source.includes('catolicosgpt-home-card-clean-v4')){
      source=source.replace('</head>',HOME_CARD_REFINEMENT+'\\n</head>');
    }
    return source;
  }catch(_){
    return result;
  }
};

try{
  require('./stable-start-v2');
}finally{
  fs.readFileSync=originalReadFileSync;
}
