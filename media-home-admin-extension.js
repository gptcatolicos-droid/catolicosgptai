// CatolicosGPT feature extension: Google Drive media bridge + admin/home enhancements.
// Intentionally contains no global visual overrides; stable-ui-final.js remains the only UI shell.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const FEATURE_UI = `
<style id="cgpt-media-home-admin-v1">
  .cgpt-drive-help{margin:10px 0 14px;padding:12px 14px;border:1px solid #d7b877;border-radius:12px;background:#fffdf8;color:#5f5147;font-size:12px;line-height:1.45}
  .cgpt-drive-help strong{color:#6b1e26}
  .cgpt-backup-tools-feature{width:min(100%,760px);margin:16px auto;padding:16px;border:1px solid #d7b877;border-radius:16px;background:#fffdf8;box-shadow:0 3px 12px rgba(37,27,21,.04)}
  .cgpt-backup-tools-feature h2{margin:0 0 6px;color:#6b1e26;font-size:20px}
  .cgpt-backup-tools-feature p{margin:0 0 12px;color:#61574f;font-size:14px;line-height:1.4}
  .cgpt-backup-tools-feature .actions{display:flex;gap:10px;flex-wrap:wrap}
  .cgpt-backup-tools-feature a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 14px;border-radius:10px;background:#6b1e26;color:#fff!important;text-decoration:none!important;font-weight:700;font-size:14px}

  .cgpt-home-modules{width:min(100%,820px);margin:8px auto 4px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;text-align:left}
  .cgpt-home-panel{border:1px solid #e6dfd4;border-radius:16px;background:#fff;box-shadow:0 3px 12px rgba(37,27,21,.04);overflow:hidden}
  .cgpt-home-reading{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;text-decoration:none!important;color:#2d241e!important}
  .cgpt-home-reading .eyebrow,.cgpt-home-carousel-head .eyebrow{display:block;color:#bc8a36;font-size:10px;line-height:1.2;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
  .cgpt-home-reading h2{margin:3px 0 3px;font-size:19px;line-height:1.16;color:#6b1e26}
  .cgpt-home-reading p{margin:0!important;font-size:13px!important;line-height:1.35!important;color:#61574f;text-align:left!important}
  .cgpt-home-reading .arrow{flex:0 0 auto;width:36px;height:36px;border-radius:999px;display:grid;place-items:center;background:#6b1e26;color:#fff;font-size:20px}
  .cgpt-home-carousel{padding:12px}
  .cgpt-home-carousel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 10px}
  .cgpt-home-carousel-head h2{margin:2px 0 0;font-size:18px;line-height:1.15;color:#6b1e26}
  .cgpt-carousel-controls{display:flex;gap:6px}
  .cgpt-carousel-controls button{width:32px;height:32px;border:1px solid #ded6cc;border-radius:999px;background:#fff;color:#6b1e26;font-size:17px;cursor:pointer}
  .cgpt-home-inf-track{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px 1px 4px}
  .cgpt-home-inf-track::-webkit-scrollbar{display:none}
  .cgpt-home-inf-card{flex:0 0 172px;scroll-snap-align:start;display:flex;flex-direction:column;gap:7px;padding:9px;border:1px solid #e6dfd4;border-radius:13px;background:#fff;color:#2d241e!important;text-decoration:none!important}
  .cgpt-home-inf-cover{height:146px;border-radius:9px;background:#f7f3ed;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .cgpt-home-inf-cover img{display:block;width:auto!important;height:auto!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}
  .cgpt-home-inf-card strong{font-size:13px;line-height:1.2;color:#6b1e26;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .cgpt-home-seo-context{margin:4px auto 0;max-width:760px;color:#6d625b;font-size:11px;line-height:1.4;text-align:center}
  .cgpt-home-seo-context a{color:#6b1e26;text-decoration:underline;text-underline-offset:2px}

  @media(min-width:768px){
    .cgpt-home-modules{grid-template-columns:260px minmax(0,1fr);gap:14px;align-items:stretch}
    .cgpt-home-reading{height:100%;min-height:208px;align-items:flex-start;flex-direction:column;justify-content:space-between}
    .cgpt-home-reading h2{font-size:21px}
    .cgpt-home-inf-card{flex-basis:150px}
    .cgpt-home-inf-cover{height:128px}
  }
  @media(max-width:767px){
    #welcome-screen{justify-content:flex-start!important;padding-top:12px!important;overflow:visible!important}
    .cgpt-home-modules{width:100%;gap:10px;margin-top:6px}
    .cgpt-home-reading{padding:12px 13px}
    .cgpt-home-reading h2{font-size:17px}
    .cgpt-home-inf-card{flex-basis:142px;padding:8px}
    .cgpt-home-inf-cover{height:118px}
    .cgpt-home-carousel{padding:10px}
    .cgpt-home-carousel-head h2{font-size:16px}
    .cgpt-backup-tools-feature{margin:10px 0;padding:14px}
    .cgpt-backup-tools-feature .actions{display:grid;grid-template-columns:1fr}
  }
</style>
<script id="cgpt-media-home-admin-runtime-v1">
(function(){
  function driveId(value){
    var v=String(value||'').trim();
    if(!v) return '';
    var m=v.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i) || v.match(/[?&]id=([A-Za-z0-9_-]+)/i);
    if(m && m[1]) return m[1];
    if(/^[A-Za-z0-9_-]{20,}$/.test(v)) return v;
    return '';
  }
  function normalizeDrive(value){
    var v=String(value||'').trim();
    if(!v || v.indexOf('/media/drive/')===0 || v.indexOf(location.origin+'/media/drive/')===0) return v;
    var id=driveId(v);
    return id ? '/media/drive/'+encodeURIComponent(id) : v;
  }
  function refreshPreview(input){
    var row=input.closest('.manual-image-row');
    if(row && row.id && typeof window.previewImage==='function'){
      try{ window.previewImage(row.id); }catch(e){}
    }
  }
  function enhanceDriveFields(){
    var form=document.getElementById('infografiaManualForm');
    if(!form) return;
    var heading=document.getElementById('infografia-form-title');
    if(heading) heading.textContent='📥 Registrar Infografía (Google Drive o Cloudinary)';
    if(!form.querySelector('.cgpt-drive-help')){
      var help=document.createElement('div');
      help.className='cgpt-drive-help md:col-span-2';
      help.innerHTML='<strong>Nuevas imágenes:</strong> pega el enlace público de Google Drive (Cualquier persona con el enlace → Lector). Las imágenes antiguas de Cloudinary se conservan sin cambios. También puedes seguir pegando URLs de Cloudinary.';
      var first=form.querySelector('.manual-image-row') || form.firstElementChild;
      if(first) first.parentNode.insertBefore(help,first);
      else form.prepend(help);
    }
    function bind(input){
      if(!input || input.dataset.driveReady==='1') return;
      input.dataset.driveReady='1';
      input.placeholder='Google Drive público o https://res.cloudinary.com/...';
      var label=input.closest('div') && input.closest('div').querySelector('label');
      if(label && /Cloudinary/i.test(label.textContent||'')) label.textContent='Imagen (Google Drive o Cloudinary)';
      function convert(){
        var next=normalizeDrive(input.value);
        if(next && next!==input.value){ input.dataset.driveOriginal=input.value; input.value=next; }
        refreshPreview(input);
      }
      input.addEventListener('blur',convert);
      input.addEventListener('paste',function(){setTimeout(convert,30);});
    }
    form.querySelectorAll('input[name="imageUrls[]"]').forEach(bind);
    if(form.dataset.driveSubmitReady!=='1'){
      form.dataset.driveSubmitReady='1';
      form.addEventListener('submit',function(){ form.querySelectorAll('input[name="imageUrls[]"]').forEach(function(i){i.value=normalizeDrive(i.value);}); });
    }
    var mo=new MutationObserver(function(){form.querySelectorAll('input[name="imageUrls[]"]').forEach(bind);});
    mo.observe(form,{childList:true,subtree:true});
  }

  function ensureBackup(){
    if((location.pathname||'').toLowerCase()!=='/admin') return;
    var main=document.querySelector('main'); if(!main) return;
    if(document.querySelector('.cgpt-backup-tools-feature') || document.querySelector('.cgpt-backup-tools')) return;
    var box=document.createElement('section');
    box.className='cgpt-backup-tools-feature';
    box.innerHTML='<h2>Backup de CatólicosGPT</h2><p>Descarga ahora una copia completa antes de realizar cambios de contenido o restaura un backup anterior.</p><div class="actions"><a href="/admin/descargar-backup">⬇ Descargar backup</a><a href="/admin/restaurar-backup">↺ Restaurar backup</a></div>';
    main.prepend(box);
  }

  function meta(name,content,property){
    var selector=property?'meta[property="'+name+'"]':'meta[name="'+name+'"]';
    var el=document.head.querySelector(selector);
    if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',name);document.head.appendChild(el);}
    el.setAttribute('content',content);
  }
  function enhanceHomeSeo(){
    if(location.pathname!=='/') return;
    document.title='IA Católica y ChatGPT Católico | CatólicosGPT';
    meta('description','CatólicosGPT es una IA católica en español para consultar fe, Biblia, Magisterio, lecturas de hoy, catequesis e infografías católicas.');
    meta('keywords','IA católica, ChatGPT católico, chat GPT católico, chat cristiano, IA cristiana, inteligencia artificial católica, CatólicosGPT, evangelio de hoy, lecturas de hoy');
    meta('og:title','CatólicosGPT | IA Católica y ChatGPT Católico',true);
    meta('og:description','Habla con una IA católica en español y accede a lecturas, catequesis e infografías para vivir y comprender mejor la fe.',true);
    var canon=document.head.querySelector('link[rel="canonical"]');
    if(!canon){canon=document.createElement('link');canon.rel='canonical';document.head.appendChild(canon);} canon.href='https://www.catolicosgpt.com/';
    if(!document.getElementById('cgpt-home-schema')){
      var s=document.createElement('script');s.type='application/ld+json';s.id='cgpt-home-schema';
      s.textContent=JSON.stringify({'@context':'https://schema.org','@type':'WebSite',name:'CatólicosGPT',url:'https://www.catolicosgpt.com/',description:'IA católica en español para formación, catequesis, lecturas y consulta de fe.',potentialAction:{'@type':'SearchAction',target:'https://www.catolicosgpt.com/?q={search_term_string}','query-input':'required name=search_term_string'}});
      document.head.appendChild(s);
    }
  }

  function homeCardFrom(source){
    var a=source.querySelector('a[href*="/infografias/"]') || (source.matches('a[href*="/infografias/"]')?source:null);
    var img=source.querySelector('img');
    var title=source.querySelector('h2,h3,strong');
    if(!a || !img) return null;
    var out=document.createElement('a');out.className='cgpt-home-inf-card';out.href=a.getAttribute('href');
    var cover=document.createElement('div');cover.className='cgpt-home-inf-cover';
    var image=document.createElement('img');image.src=img.getAttribute('src')||img.getAttribute('data-src')||'';image.alt=img.getAttribute('alt')||((title&&title.textContent)||'Infografía católica');image.loading='lazy';cover.appendChild(image);
    var strong=document.createElement('strong');strong.textContent=(title&&title.textContent||image.alt||'Infografía católica').trim();
    out.appendChild(cover);out.appendChild(strong);return out;
  }
  function loadInfografias(track){
    fetch('/infografias',{credentials:'same-origin'}).then(function(r){return r.text();}).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html');
      var cards=Array.from(doc.querySelectorAll('.seo-card')).slice(0,4);
      track.innerHTML='';
      cards.map(homeCardFrom).filter(Boolean).forEach(function(card){track.appendChild(card);});
      if(!track.children.length) track.innerHTML='<a href="/infografias" class="cgpt-home-inf-card"><strong>Ver galería de infografías católicas</strong></a>';
    }).catch(function(){track.innerHTML='<a href="/infografias" class="cgpt-home-inf-card"><strong>Ver galería de infografías católicas</strong></a>';});
  }
  function buildHome(){
    if(location.pathname!=='/') return;
    var welcome=document.getElementById('welcome-screen'); if(!welcome || document.querySelector('.cgpt-home-modules')) return;
    welcome.querySelectorAll('.welcome-cards,.home-infografia-day,.home-infografia-gallery-link').forEach(function(x){x.remove();});
    var grid=welcome.querySelector('.grid'); if(grid) grid.remove();
    var title=welcome.querySelector('h1'); if(!title) return;
    var intro=title.parentElement||title;
    var wrap=document.createElement('div');wrap.className='cgpt-home-modules';
    wrap.innerHTML='<a class="cgpt-home-panel cgpt-home-reading" href="/blog/evangelio-de-hoy"><div><span class="eyebrow">Lecturas de hoy</span><h2>Evangelio de hoy</h2><p>Lecturas y Evangelio del día para comenzar la jornada con la Palabra de Dios.</p></div><span class="arrow">→</span></a><section class="cgpt-home-panel cgpt-home-carousel"><div class="cgpt-home-carousel-head"><div><span class="eyebrow">Formación visual</span><h2>Infografías católicas</h2></div><div class="cgpt-carousel-controls"><button type="button" aria-label="Anterior">‹</button><button type="button" aria-label="Siguiente">›</button></div></div><div class="cgpt-home-inf-track"><span style="font-size:12px;color:#776b63;padding:12px">Cargando infografías…</span></div></section>';
    intro.insertAdjacentElement('afterend',wrap);
    var track=wrap.querySelector('.cgpt-home-inf-track');var buttons=wrap.querySelectorAll('.cgpt-carousel-controls button');
    buttons[0].addEventListener('click',function(){track.scrollBy({left:-Math.max(150,track.clientWidth*.75),behavior:'smooth'});});
    buttons[1].addEventListener('click',function(){track.scrollBy({left:Math.max(150,track.clientWidth*.75),behavior:'smooth'});});
    loadInfografias(track);
    var seo=document.createElement('p');seo.className='cgpt-home-seo-context';seo.innerHTML='CatólicosGPT es una <a href="/ia-catolica">IA católica</a> y <a href="/chat-catolico">chat católico con IA</a> para formación, catequesis y vida cristiana.';wrap.insertAdjacentElement('afterend',seo);
  }

  function run(){enhanceDriveFields();ensureBackup();enhanceHomeSeo();buildHome();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(run,80);},{once:true}); else setTimeout(run,80);
  var attempts=0;var timer=setInterval(function(){run();attempts++;if(attempts>20)clearInterval(timer);},500);
})();
</script>`;

fs.readFileSync = function featureRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
    if (resolved !== path.resolve(serverPath) || !encoding) return result;
    let source = String(result);
    const anchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
    if (source.includes(anchor) && !source.includes('__cgptDriveMediaRoute')) {
      const route = `\n// __cgptDriveMediaRoute — public Google Drive image bridge, no Google API/OAuth.\napp.get('/media/drive/:id', async (req, res) => {\n  const id = String(req.params.id || '').trim();\n  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return res.status(400).send('ID de Google Drive inválido');\n  try {\n    const candidates = [\n      'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w2000',\n      'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(id)\n    ];\n    let upstream = null;\n    for (const url of candidates) {\n      try { const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 CatolicosGPT/1.0' } }); if (r.ok) { upstream = r; break; } } catch (_) {}\n    }\n    if (!upstream) return res.status(502).send('Imagen de Google Drive no disponible. Verifica que el archivo sea público.');\n    const contentType = upstream.headers.get('content-type') || 'image/jpeg';\n    if (!contentType.startsWith('image/')) return res.status(502).send('El enlace de Google Drive no corresponde a una imagen pública.');\n    const data = Buffer.from(await upstream.arrayBuffer());\n    res.set('Content-Type', contentType);\n    res.set('Cache-Control', 'public, max-age=21600, stale-while-revalidate=86400');\n    return res.send(data);\n  } catch (err) {\n    console.error('[Drive image bridge]', err.message);\n    return res.status(502).send('No se pudo cargar la imagen de Google Drive.');\n  }\n});\n`;
      source = source.replace(anchor, anchor + route);
    }
    if (!source.includes('cgpt-media-home-admin-runtime-v1')) source = source.replace('</head>', FEATURE_UI + '\n</head>');
    return source;
  } catch (_) { return result; }
};

try { require('./stable-ui-final'); }
finally { fs.readFileSync = originalReadFileSync; }
