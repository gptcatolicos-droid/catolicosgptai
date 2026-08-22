// CatolicosGPT UI hardening wrapper — 2026-08-22
// Delegates recovery/backup behavior to stable-start.js and adds targeted, data-safe UX fixes.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const HARDENING_UI = `
<style id="catolicosgpt-mobile-hardening-v3">
*,*::before,*::after{box-sizing:border-box}
@media (max-width:767px){
  html,body{max-width:100%;overflow-x:hidden}
  main{max-width:100%;overflow-x:hidden}

  /* Never allow standalone UI SVGs to explode if Tailwind utilities fail. */
  main svg{width:26px!important;height:26px!important;max-width:26px!important;max-height:26px!important;flex:0 0 26px!important}
  main button svg,main a svg{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important}
  a[href*="wa.me"],a[href*="whatsapp"],a[href*="api.whatsapp"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:42px!important;height:42px!important;max-width:42px!important;max-height:42px!important;overflow:hidden!important}
  a[href*="wa.me"] svg,a[href*="whatsapp"] svg,a[href*="api.whatsapp"] svg{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important}

  /* HOME / CHAT welcome — one useful card only, compact and clean. */
  #welcome-screen{max-width:100%!important;padding:8px 10px 4px!important;gap:10px!important;justify-content:flex-start!important}
  #welcome-screen>div:first-child{display:none!important}
  #welcome-screen h1{font-size:21px!important;line-height:1.08!important;letter-spacing:0!important;margin:0!important;text-align:center!important}
  #welcome-screen p{font-size:12.5px!important;line-height:1.32!important;margin:0!important;padding:0 4px!important;text-align:center!important}
  #welcome-screen .grid,.welcome-cards{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;margin-top:2px!important;width:100%!important}
  #welcome-screen .grid>a,#welcome-screen .grid>div,.welcome-card{min-height:0!important;padding:12px!important;border-radius:16px!important}
  .home-infografia-day{overflow:hidden!important;text-align:left!important}
  .home-infografia-day .home-infografia-preview{display:block!important;width:100%!important;aspect-ratio:16/8.5!important;object-fit:cover!important;object-position:center!important;border-radius:12px!important;margin:0 0 10px!important;border:1px solid #E6DFD4!important}

  #chat-box{padding:10px 10px 6px!important;max-width:100%!important;overflow-x:hidden!important}

  /* Chat answer typography and tables must NEVER escape the viewport. */
  #chat-box .message-content,#chat-box .markdown-body,#chat-box .chat-bubble,#chat-box article{max-width:100%!important;overflow-wrap:anywhere!important;word-break:normal!important}
  #chat-box h1{font-size:22px!important;line-height:1.14!important;margin:.65em 0 .35em!important}
  #chat-box h2{font-size:19px!important;line-height:1.18!important;margin:.65em 0 .3em!important}
  #chat-box h3{font-size:17px!important;line-height:1.22!important;margin:.6em 0 .25em!important}
  #chat-box p,#chat-box li{font-size:15px!important;line-height:1.52!important}
  #chat-box table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;border-collapse:collapse!important;font-size:13px!important}
  #chat-box thead,#chat-box tbody{width:max-content!important;min-width:100%!important}
  #chat-box th,#chat-box td{font-size:13px!important;line-height:1.35!important;padding:8px!important;min-width:120px!important;max-width:240px!important;vertical-align:top!important;white-space:normal!important;overflow-wrap:anywhere!important}
  #chat-box pre,#chat-box code{max-width:100%!important;overflow-x:auto!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important}

  .chat-input-wrap{padding:8px 10px calc(8px + env(safe-area-inset-bottom))!important}
  .chat-input-wrap input,.chat-input-wrap textarea{min-height:44px!important;max-height:88px!important;padding:9px 13px!important;font-size:16px!important}
  .chat-input-wrap button{width:44px!important;height:44px!important;min-height:44px!important;flex-basis:44px!important;border-radius:14px!important}
  .chat-input-wrap>div:not(:first-child),.chat-input-wrap small{font-size:9px!important;line-height:1.2!important;margin-top:4px!important}

  /* Infographic detail — designed mobile reading experience even without Tailwind. */
  body.infografia-detail-page main>div{width:100%!important;max-width:100%!important;padding:14px 12px 28px!important;gap:14px!important}
  body.infografia-detail-page main>div>a:first-child{display:inline-flex!important;align-items:center!important;gap:6px!important;font-size:13px!important;line-height:1.2!important;margin:0 0 4px!important;text-decoration:none!important}
  body.infografia-detail-page main h1{font-size:28px!important;line-height:1.08!important;margin:4px 0 8px!important;letter-spacing:-.015em!important;overflow-wrap:anywhere!important}
  body.infografia-detail-page main p{font-size:14px!important;line-height:1.48!important;margin:0!important}
  body.infografia-detail-page main .share-buttons,body.infografia-detail-page main [aria-label*="Compartir"]{max-width:100%!important;display:flex!important;flex-wrap:wrap!important;gap:8px!important}
  body.infografia-detail-page .vista-btn{font-size:12px!important;line-height:1!important;padding:8px 10px!important;border-radius:9px!important;white-space:nowrap!important}
  body.infografia-detail-page #vista-continua{gap:14px!important;padding:0!important}
  body.infografia-detail-page #vista-carrusel,body.infografia-detail-page #vista-cuadricula{width:100%!important;max-width:100%!important}
  body.infografia-detail-page #lightbox-modal svg{width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important}

  [data-infografia-frame]{width:100%!important;max-width:620px!important;margin:0 auto 14px!important;padding:8px!important;border:1px solid #E6DFD4!important;border-radius:16px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 3px 14px rgba(37,27,21,.05)!important}
  [data-infografia-frame] img{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;object-fit:contain!important;border-radius:10px!important}
  [data-infografia-frame]>.infografia-caption{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:7px 4px 2px!important;color:#6F6258!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;font-size:10px!important;line-height:1.2!important}
  [data-infografia-frame]>.infografia-caption span{font-size:10px!important;line-height:1.2!important}
}
</style>
<script id="catolicosgpt-mobile-hardening-runtime-v3">
(function(){
  function cardRoot(el){
    if(!el) return null;
    let node=el;
    while(node && node.parentElement){
      const p=node.parentElement;
      if(p.classList && (p.classList.contains('grid') || p.classList.contains('welcome-cards'))) return node;
      if(p.id==='welcome-screen') return node;
      node=p;
    }
    return el;
  }

  async function polishHome(){
    const welcome=document.getElementById('welcome-screen');
    if(!welcome) return;

    /* Remove the decorative cross/emoji permanently from the home UX. */
    const first=welcome.firstElementChild;
    if(first && /[✝✟✞✚➕]/.test(first.textContent||'')) first.remove();

    /* Santo del Día is intentionally removed from the home. */
    const santoText=[...welcome.querySelectorAll('*')].find(el => /santo del d[ií]a/i.test((el.textContent||'').trim()) && (el.children.length===0 || (el.textContent||'').trim().length<80));
    const santoCard=cardRoot(santoText);
    if(santoCard) santoCard.remove();

    /* Keep only the Infografía del Día card among welcome recommendation cards. */
    const infText=[...welcome.querySelectorAll('*')].find(el => /infograf[ií]a del d[ií]a/i.test((el.textContent||'').trim()));
    const infCard=cardRoot(infText);
    const cardContainer=infCard && infCard.parentElement;
    if(cardContainer && (cardContainer.classList.contains('grid') || cardContainer.classList.contains('welcome-cards'))){
      [...cardContainer.children].forEach(card => { if(card!==infCard) card.remove(); });
    }
    if(!infCard) return;
    infCard.classList.add('home-infografia-day');

    /* Add the actual cover preview if the original home card has none. */
    if(!infCard.querySelector('img')){
      try{
        const response=await fetch('/infografia-del-dia',{credentials:'same-origin'});
        if(response.ok){
          const html=await response.text();
          const doc=new DOMParser().parseFromString(html,'text/html');
          const image=doc.querySelector('#vista-continua img') || doc.querySelector('[data-infografia-frame] img') || doc.querySelector('main img');
          if(image && image.src){
            const preview=document.createElement('img');
            preview.className='home-infografia-preview';
            preview.src=image.src;
            preview.alt='Infografía católica del día';
            preview.loading='lazy';
            infCard.prepend(preview);
          }
        }
      }catch(_){ }
    }
  }

  function markPageContext(){
    if(document.getElementById('vista-continua')) document.body.classList.add('infografia-detail-page');
  }

  function run(){ markPageContext(); polishHome(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
</script>`;

fs.readFileSync = function hardenedRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
    if (resolved !== path.resolve(serverPath) || !encoding) return result;
    let source = String(result);

    /* Mark continuous infographic cards/captions for precise fallback styling. */
    source = source.replace(
      '<div class="bg-cream border border-border/60 rounded-2xl overflow-hidden p-2.5 flex flex-col gap-3 shadow-sm max-w-xl mx-auto hover:border-gold/30 transition duration-300">',
      '<div data-infografia-frame class="bg-cream border border-border/60 rounded-2xl overflow-hidden p-2.5 flex flex-col gap-3 shadow-sm max-w-xl mx-auto hover:border-gold/30 transition duration-300">'
    );
    source = source.replace(
      '<div class="flex items-center justify-between text-xs px-2 py-1 text-ink2 font-mono">',
      '<div class="infografia-caption flex items-center justify-between text-xs px-2 py-1 text-ink2 font-mono">'
    );

    /* Remove older hardening layer so only v3 owns these selectors. */
    source = source.replace(/<style id="catolicosgpt-mobile-hardening-v2">[\s\S]*?<\/style>/g, '');
    if (!source.includes('catolicosgpt-mobile-hardening-v3')) {
      source = source.replace('</head>', HARDENING_UI + '\n</head>');
    }
    return source;
  } catch (_) {
    return result;
  }
};

try {
  require('./stable-start');
} finally {
  fs.readFileSync = originalReadFileSync;
}
