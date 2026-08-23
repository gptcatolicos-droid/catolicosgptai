// CatolicosGPT — single stable UI layer
// Presentation only. Recovery, backup routes and data remain owned by stable-start.js.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

let faviconB64 = '';
try {
  const legacy = originalReadFileSync(path.join(__dirname, 'seo-ux-final.js'), 'utf8');
  const match = legacy.match(/const FAVICON_B64 = '([^']+)'/);
  if (match) faviconB64 = match[1];
} catch (_) {}

const UI = `
<link rel="icon" type="image/png" sizes="96x96" href="/favicon.png?v=20260823b">
<link rel="shortcut icon" href="/favicon.ico?v=20260823b">
<link rel="apple-touch-icon" href="/favicon.png?v=20260823b">
<meta name="application-name" content="CatólicosGPT">
<meta name="theme-color" content="#6B1E26">
<style id="catolicosgpt-stable-ui-final-v2">
*,*::before,*::after{box-sizing:border-box}
html,body{max-width:100%;overflow-x:hidden}
img{max-width:100%;height:auto}
@media(max-width:767px){
  html body{margin:0!important;background:#F9F6F0!important;color:#2D241E!important}
  html body main{width:100%!important;max-width:100%!important;overflow-x:hidden!important}

  /* Header */
  html body>header{position:sticky!important;top:0!important;z-index:900!important;display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:70px!important;padding:10px 14px!important;background:#fff!important;border-bottom:1px solid #E6DFD4!important;box-shadow:0 2px 8px rgba(37,27,21,.04)!important}
  html body>header svg{width:auto!important;height:auto!important;max-width:30px!important;max-height:30px!important}

  /* Drawer: highest specificity so legacy mobile CSS cannot override it. */
  html body #mobile-drawer{position:fixed!important;inset:0!important;z-index:1200!important;background:rgba(24,18,15,.44)!important}
  html body #mobile-drawer-content{width:min(82vw,310px)!important;max-width:310px!important;height:100dvh!important;padding:14px!important;background:#fff!important;overflow-y:auto!important;box-shadow:8px 0 28px rgba(34,24,18,.18)!important}
  html body #mobile-drawer-content p,html body #mobile-drawer-content span,html body #mobile-drawer-content a,html body #mobile-drawer-content button{font-size:14px!important;line-height:1.25!important}
  html body #mobile-drawer-content h1,html body #mobile-drawer-content h2,html body #mobile-drawer-content h3{font-size:11px!important;line-height:1.2!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#6B1E26!important;margin:16px 6px 6px!important;font-weight:700!important}
  html body #mobile-drawer-content nav{display:flex!important;flex-direction:column!important;gap:2px!important;margin:0!important;padding:0!important}
  html body #mobile-drawer-content a,html body #mobile-drawer-content .nav-link,html body #mobile-drawer-content nav button{display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;min-height:38px!important;padding:8px 9px!important;margin:0!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#2D241E!important;text-decoration:none!important;text-align:left!important;font-weight:400!important}
  html body #mobile-drawer-content svg{width:17px!important;height:17px!important;max-width:17px!important;max-height:17px!important;flex:0 0 17px!important}
  html body #mobile-drawer-content button[aria-label*="errar"],html body #mobile-drawer-content button[aria-label*="lose"]{display:flex!important;width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;align-items:center!important;justify-content:center!important;border:1px solid #E6DFD4!important;border-radius:9px!important;background:#fff!important}

  /* Home: chat first, no recommendation cards. */
  html body.cgpt-home #welcome-screen{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:10px!important;padding:18px 18px 8px!important}
  html body.cgpt-home #welcome-screen h1{font-size:24px!important;line-height:1.08!important;margin:0!important;text-align:center!important;color:#6B1E26!important}
  html body.cgpt-home #welcome-screen p{font-size:14px!important;line-height:1.35!important;margin:0!important;text-align:center!important;max-width:34rem!important}
  html body.cgpt-home #welcome-screen .welcome-cards,html body.cgpt-home #welcome-screen .grid,html body.cgpt-home #welcome-screen .home-infografia-day,html body.cgpt-home #welcome-screen .home-infografia-gallery-link{display:none!important}

  /* Reading / articles / Santoral */
  html body.cgpt-reading main{padding:20px 18px 34px!important}
  html body.cgpt-reading main>div,html body.cgpt-reading main>article,html body.cgpt-reading main>section{width:100%!important;max-width:720px!important;margin-left:auto!important;margin-right:auto!important}
  html body.cgpt-reading main h1{font-size:31px!important;line-height:1.09!important;margin:8px 0 14px!important;overflow-wrap:anywhere!important}
  html body.cgpt-reading main h2{font-size:23px!important;line-height:1.16!important;margin:24px 0 10px!important;overflow-wrap:anywhere!important}
  html body.cgpt-reading main h3{font-size:19px!important;line-height:1.22!important;margin:20px 0 8px!important}
  html body.cgpt-reading main p,html body.cgpt-reading main li,html body.cgpt-reading main blockquote{font-size:17px!important;line-height:1.56!important;overflow-wrap:anywhere!important}
  html body.cgpt-reading main img,html body.cgpt-reading main video,html body.cgpt-reading main iframe{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;margin-left:auto!important;margin-right:auto!important}
  html body.cgpt-reading main table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;font-size:14px!important}

  /* Fe Católica index */
  html body.cgpt-fe main{padding:18px 16px 34px!important}
  html body.cgpt-fe main h1{font-size:29px!important;line-height:1.12!important;margin:8px 0 12px!important}
  html body.cgpt-fe main h2{font-size:22px!important;line-height:1.18!important;margin:16px 0 8px!important}
  html body.cgpt-fe main p{font-size:16px!important;line-height:1.48!important}
  html body.cgpt-fe main form{display:flex!important;gap:8px!important;flex-wrap:wrap!important;width:100%!important;margin:12px 0!important}
  html body.cgpt-fe main input[type="search"],html body.cgpt-fe main input[type="text"]{flex:1 1 200px!important;min-width:0!important;height:42px!important;padding:8px 12px!important;border:1px solid #D8D0C5!important;border-radius:12px!important;background:#fff!important;font-size:16px!important;color:#2D241E!important}
  html body.cgpt-fe main button,html body.cgpt-fe main input[type="submit"]{min-height:42px!important;padding:8px 16px!important;border:0!important;border-radius:12px!important;background:#6B1E26!important;color:#fff!important;font-size:14px!important;font-weight:700!important}
  html body.cgpt-fe main .seo-card{width:100%!important;max-width:360px!important;margin:0 auto 16px!important;padding:15px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 3px 12px rgba(37,27,21,.04)!important}
  html body.cgpt-fe main .seo-card h2,html body.cgpt-fe main .seo-card h3{font-size:21px!important;line-height:1.18!important;margin:6px 0 8px!important}
  html body.cgpt-fe main .seo-card p{font-size:15px!important;line-height:1.45!important}

  /* Niños / resources */
  html body.cgpt-ninos main{padding:18px 14px 32px!important}
  html body.cgpt-ninos main h1{font-size:29px!important;line-height:1.1!important}
  html body.cgpt-ninos main h2{font-size:23px!important;line-height:1.15!important}
  html body.cgpt-ninos main p,html body.cgpt-ninos main li{font-size:16px!important;line-height:1.48!important}
  html body.cgpt-ninos main form{display:flex!important;gap:8px!important;flex-wrap:wrap!important;width:100%!important}
  html body.cgpt-ninos main input{min-width:0!important;max-width:100%!important;height:42px!important;border:1px solid #D8D0C5!important;border-radius:12px!important;background:#fff!important;font-size:16px!important}
  html body.cgpt-ninos main button{min-height:42px!important;padding:8px 14px!important;border-radius:10px!important;background:#6B1E26!important;color:#fff!important;border:0!important}
  html body.cgpt-ninos main .seo-card{width:100%!important;max-width:360px!important;margin:0 auto 18px!important;padding:14px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important}
  html body.cgpt-ninos main .seo-card img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:55vh!important;object-fit:contain!important;margin:0 auto 12px!important}

  /* Infografías: full covers only, never crop. */
  html body.cgpt-infografias main{padding-left:14px!important;padding-right:14px!important}
  html body.cgpt-infografias main .seo-card{width:100%!important;max-width:350px!important;margin:0 auto 18px!important;padding:12px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 4px 14px rgba(37,27,21,.05)!important}
  html body.cgpt-infografias main .seo-card>a:first-child,html body.cgpt-infografias main .seo-card>div:first-child{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;background:#F7F3ED!important;border-radius:12px!important;overflow:hidden!important}
  html body.cgpt-infografias main .seo-card img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:64vh!important;object-fit:contain!important;object-position:center!important;margin:0 auto!important;border-radius:10px!important}
  html body.cgpt-infografias main .seo-card h2,html body.cgpt-infografias main .seo-card h3{font-size:21px!important;line-height:1.17!important;margin:8px 0!important;color:#6B1E26!important}
  html body.cgpt-infografias main .seo-card p{font-size:14px!important;line-height:1.44!important;color:#61574F!important}

  /* Login and admin access */
  html body.cgpt-login main,html body.cgpt-admin main{padding:18px 14px 34px!important}
  html body.cgpt-login main>div,html body.cgpt-admin main>div{width:100%!important;max-width:390px!important;margin:16px auto!important;padding:20px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;box-shadow:0 4px 16px rgba(37,27,21,.05)!important;overflow:hidden!important}
  html body.cgpt-login main h1,html body.cgpt-admin main h1{font-size:28px!important;line-height:1.12!important;margin:0 0 10px!important;color:#6B1E26!important}
  html body.cgpt-login main p,html body.cgpt-admin main p{font-size:15px!important;line-height:1.45!important;margin:0 0 12px!important}
  html body.cgpt-login main form{display:flex!important;flex-direction:column!important;gap:12px!important}
  html body.cgpt-login main label{font-size:14px!important;line-height:1.25!important;font-weight:600!important;color:#2D241E!important}
  html body.cgpt-login main input{width:100%!important;min-height:44px!important;padding:10px 12px!important;border:1px solid #D8D0C5!important;border-radius:11px!important;background:#fff!important;font-size:16px!important;color:#2D241E!important}
  html body.cgpt-login main button,html body.cgpt-login main input[type="submit"],html body.cgpt-admin main a[href*="login"]{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-height:44px!important;padding:10px 14px!important;border:0!important;border-radius:11px!important;background:#6B1E26!important;color:#fff!important;text-decoration:none!important;font-size:14px!important;font-weight:700!important}

  /* Admin backup tools */
  html body.cgpt-admin .cgpt-backup-tools{width:100%!important;max-width:520px!important;margin:16px auto!important;padding:16px!important;border:1px solid #D7B877!important;border-radius:16px!important;background:#FFFDF8!important}
  html body.cgpt-admin .cgpt-backup-tools h2{font-size:19px!important;line-height:1.2!important;margin:0 0 10px!important;color:#6B1E26!important}
  html body.cgpt-admin .cgpt-backup-tools p{font-size:14px!important;line-height:1.4!important;margin:0 0 12px!important}
  html body.cgpt-admin .cgpt-backup-actions{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
  html body.cgpt-admin .cgpt-backup-actions a{display:flex!important;align-items:center!important;justify-content:center!important;min-height:42px!important;padding:9px 12px!important;border-radius:10px!important;background:#6B1E26!important;color:#fff!important;text-decoration:none!important;font-size:14px!important;font-weight:700!important}

  /* Chat and Post de Formación cards */
  html body #chat-box{max-width:100%!important;overflow-x:hidden!important}
  html body #chat-box h1{font-size:22px!important;line-height:1.16!important}
  html body #chat-box h2{font-size:19px!important;line-height:1.2!important}
  html body #chat-box h3{font-size:17px!important;line-height:1.22!important}
  html body #chat-box p,html body #chat-box li{font-size:15px!important;line-height:1.52!important}
  html body #chat-box table{display:block!important;width:100%!important;overflow-x:auto!important;font-size:13px!important}
  html body #chat-box .cgpt-post-card{display:block!important;width:100%!important;max-width:100%!important;margin:10px 0!important;padding:14px!important;border:1px solid #E4DDD3!important;border-radius:16px!important;background:#fff!important;color:#2D241E!important;text-decoration:none!important;box-shadow:0 3px 12px rgba(37,27,21,.04)!important;overflow:hidden!important}
  html body #chat-box .cgpt-post-card h1,html body #chat-box .cgpt-post-card h2,html body #chat-box .cgpt-post-card h3{font-size:18px!important;line-height:1.2!important;margin:4px 0 8px!important;color:#6B1E26!important}
  html body #chat-box .cgpt-post-card p{font-size:14px!important;line-height:1.45!important;margin:4px 0!important}
}
</style>
<script id="catolicosgpt-stable-ui-final-runtime-v2">
(function(){
  function cardRoot(el){
    if(!el) return null;
    var candidate=el.closest('.seo-card,article,section,a,[class*="border"]');
    if(candidate && candidate.id!=='chat-box' && (candidate.textContent||'').length<2200) return candidate;
    return el.parentElement && el.parentElement.id!=='chat-box' ? el.parentElement : null;
  }
  function removeHomeCards(){
    var welcome=document.getElementById('welcome-screen');
    if(!welcome) return;
    welcome.querySelectorAll('.welcome-cards,.grid,.home-infografia-day,.home-infografia-gallery-link').forEach(function(n){n.remove();});
    Array.from(welcome.querySelectorAll('*')).forEach(function(el){
      var t=(el.textContent||'').trim();
      if(/infograf[ií]a del d[ií]a|santo del d[ií]a/i.test(t) && t.length<500){
        var r=cardRoot(el); if(r) r.remove();
      }
    });
    var first=welcome.firstElementChild;
    if(first && /[✝✟✞✚➕]/.test(first.textContent||'')) first.remove();
  }
  function stylePostCards(){
    var box=document.getElementById('chat-box'); if(!box) return;
    Array.from(box.querySelectorAll('*')).forEach(function(el){
      var t=(el.textContent||'').trim();
      if(/post de formaci[oó]n/i.test(t) && t.length<500){
        var r=cardRoot(el); if(r) r.classList.add('cgpt-post-card');
      }
    });
  }
  function addBackupTools(){
    if(!document.body.classList.contains('cgpt-admin')) return;
    var main=document.querySelector('main'); if(!main || document.querySelector('.cgpt-backup-tools')) return;
    if((document.body.textContent||'').toLowerCase().includes('consola exclusiva para el administrador')) return;
    var box=document.createElement('section');
    box.className='cgpt-backup-tools';
    box.innerHTML='<h2>Backup de CatólicosGPT</h2><p>Descarga una copia completa o restaura el backup verificado.</p><div class="cgpt-backup-actions"><a href="/admin/descargar-backup">Descargar backup</a><a href="/admin/restaurar-backup">Restaurar backup</a></div>';
    main.prepend(box);
  }
  function run(){
    var p=(location.pathname||'/').toLowerCase();
    var b=document.body;
    if(p==='/'||p==='') b.classList.add('cgpt-home');
    if(p==='/infografias'||p==='/infografias/') b.classList.add('cgpt-infografias');
    if(p==='/ninos'||p.indexOf('/ninos/')===0) b.classList.add('cgpt-ninos');
    if(p==='/fe-catolica'||p==='/fe-catolica/'||p.indexOf('/fe-catolica/')===0) b.classList.add('cgpt-fe');
    if(p==='/login'||p.indexOf('/login?')===0) b.classList.add('cgpt-login');
    if(p==='/admin'||p.indexOf('/admin/')===0) b.classList.add('cgpt-admin');
    var reading=p.indexOf('/santoral/')===0||p==='/santo-del-dia'||p.indexOf('/blog/')===0||p.indexOf('/articulo/')===0||p.indexOf('/ia-catolica')===0||p.indexOf('/chat-catolico')===0||p.indexOf('/inteligencia-artificial-catolica')===0||p.indexOf('/sobre-catolicosgpt')===0||p.indexOf('/fuentes-doctrinales')===0||p.indexOf('/mejor-ia-catolica')===0||p.indexOf('/catequista-ia-catolica')===0||p.indexOf('/fe-catolica/')===0;
    if(reading) b.classList.add('cgpt-reading');
    if(b.classList.contains('cgpt-home')) removeHomeCards();
    stylePostCards();
    addBackupTools();
    setTimeout(function(){ if(b.classList.contains('cgpt-home')) removeHomeCards(); stylePostCards(); addBackupTools(); },350);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
</script>`;

fs.readFileSync = function stableUiRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
    if (resolved !== path.resolve(serverPath) || !encoding) return result;
    let source = String(result);
    const anchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
    if (faviconB64 && source.includes(anchor) && !source.includes("app.get('/favicon.png'")) {
      const routes = `\nconst __cgptFavicon = Buffer.from('${faviconB64}', 'base64');\napp.get('/favicon.png', (req,res)=>{ res.set('Cache-Control','public, max-age=604800'); res.type('png').send(__cgptFavicon); });\napp.get('/favicon.ico', (req,res)=>{ res.set('Cache-Control','public, max-age=604800'); res.type('png').send(__cgptFavicon); });\n`;
      source = source.replace(anchor, anchor + routes);
    }
    if (!source.includes('catolicosgpt-stable-ui-final-v2')) source = source.replace('</head>', UI + '\n</head>');
    return source;
  } catch (_) { return result; }
};

try { require('./stable-start'); }
finally { fs.readFileSync = originalReadFileSync; }
