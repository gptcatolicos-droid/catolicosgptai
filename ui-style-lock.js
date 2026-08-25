// CatolicosGPT UI style lock — presentation only.
// It does not modify routes, catalogs, auth, backups, or server startup logic.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const STYLE_LOCK = String.raw`
<script id="catolicosgpt-ui-style-lock-bootstrap">
(function(){
  var css = ` + "`" + String.raw`
@media(max-width:767px){
  html body{margin:0!important;background:#F9F6F0!important;color:#2D241E!important;font-size:16px!important;overflow-x:hidden!important}
  html body main{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
  html body>header{position:sticky!important;top:0!important;z-index:900!important;display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:70px!important;padding:10px 14px!important;background:#fff!important;border-bottom:1px solid #E6DFD4!important;box-shadow:0 2px 8px rgba(37,27,21,.04)!important}
  html body>header button{width:40px!important;height:40px!important;padding:8px!important;border:0!important;background:transparent!important}
  html body>header button svg{width:23px!important;height:23px!important;max-width:23px!important;max-height:23px!important}
  html body>header a>svg{width:29px!important;height:29px!important;max-width:29px!important;max-height:29px!important}
  html body>header a span{font-size:17px!important;line-height:1!important;white-space:nowrap!important}
  html body>header a[href="/login"]{min-height:38px!important;padding:0 16px!important;border-radius:999px!important;background:#5E1B22!important;color:#fff!important;font-size:13px!important;font-weight:700!important;text-decoration:none!important}
  html body #mobile-drawer{position:fixed!important;inset:0!important;z-index:1200!important;background:rgba(24,18,15,.46)!important}
  html body #mobile-drawer-content{width:min(82vw,310px)!important;max-width:310px!important;height:100dvh!important;padding:14px!important;background:#fff!important;overflow-y:auto!important;box-shadow:8px 0 28px rgba(34,24,18,.18)!important}
  html body #mobile-drawer-content p,html body #mobile-drawer-content span,html body #mobile-drawer-content a,html body #mobile-drawer-content button{font-size:14px!important;line-height:1.25!important}
  html body #mobile-drawer-content h1,html body #mobile-drawer-content h2,html body #mobile-drawer-content h3{font-size:11px!important;line-height:1.2!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#6B1E26!important;margin:15px 6px 5px!important;font-weight:800!important}
  html body #mobile-drawer-content nav{display:flex!important;flex-direction:column!important;gap:2px!important;margin:0!important;padding:0!important}
  html body #mobile-drawer-content a,html body #mobile-drawer-content .nav-link,html body #mobile-drawer-content nav button{display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;min-height:38px!important;padding:8px 9px!important;margin:0!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#2D241E!important;text-decoration:none!important;text-align:left!important;font-weight:400!important}
  html body #mobile-drawer-content svg{width:17px!important;height:17px!important;max-width:17px!important;max-height:17px!important;flex:0 0 17px!important}
  html body #mobile-drawer-content button[aria-label*="errar"],html body #mobile-drawer-content button[aria-label*="lose"]{display:flex!important;width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;align-items:center!important;justify-content:center!important;border:1px solid #E6DFD4!important;border-radius:9px!important;background:#fff!important;font-size:20px!important}
  html body.cgpt-infografias main .max-w-6xl{width:100%!important;max-width:720px!important;margin:0 auto!important;padding:18px 14px 34px!important;gap:14px!important}
  html body.cgpt-infografias main .max-w-6xl>div:first-child h1{font-size:28px!important;line-height:1.08!important;margin:0 0 8px!important;color:#6B1E26!important;letter-spacing:-.02em!important}
  html body.cgpt-infografias main .max-w-6xl>div:first-child p{font-size:15px!important;line-height:1.42!important;margin:0!important;color:#61574F!important}
  html body.cgpt-infografias main .max-w-6xl>div:nth-child(2){display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:10px!important;padding:12px!important;border:1px solid #E4DDD3!important;border-radius:16px!important;background:#fff!important;box-shadow:0 3px 12px rgba(37,27,21,.04)!important}
  html body.cgpt-infografias main .max-w-6xl>div:nth-child(2)>div{display:flex!important;flex-wrap:wrap!important;justify-content:flex-start!important;gap:6px!important}
  html body.cgpt-infografias main .max-w-6xl>div:nth-child(2) a{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:34px!important;padding:6px 10px!important;border:1px solid #DED6CC!important;border-radius:999px!important;background:#FFFDF8!important;color:#6B1E26!important;text-decoration:none!important;font-size:12px!important;line-height:1!important;font-weight:700!important}
  html body.cgpt-infografias main .max-w-6xl>div:nth-child(2) a[class~="bg-maroon"]{background:#6B1E26!important;color:#fff!important;border-color:#6B1E26!important}
  html body.cgpt-infografias main .max-w-6xl>div:nth-child(2) form{display:flex!important;gap:8px!important;width:100%!important;margin:0!important}
  html body.cgpt-infografias main .max-w-6xl>div:nth-child(2) input{flex:1 1 auto!important;width:100%!important;height:40px!important;padding:8px 12px!important;border:1px solid #D8D0C5!important;border-radius:12px!important;background:#fff!important;color:#2D241E!important;font-size:16px!important}
  html body.cgpt-infografias main .max-w-6xl>div:nth-child(2) button{flex:0 0 auto!important;min-height:40px!important;padding:8px 14px!important;border:0!important;border-radius:12px!important;background:#6B1E26!important;color:#fff!important;font-size:13px!important;font-weight:800!important}
  html body.cgpt-infografias main .seo-card{width:100%!important;max-width:340px!important;margin:0 auto 18px!important;padding:12px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 4px 14px rgba(37,27,21,.05)!important}
  html body.cgpt-infografias main .seo-card>a:first-child{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:auto!important;min-height:0!important;aspect-ratio:auto!important;margin:0 0 10px!important;padding:0!important;background:#F7F3ED!important;border-radius:12px!important;overflow:hidden!important}
  html body.cgpt-infografias main .seo-card img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:58vh!important;object-fit:contain!important;object-position:center!important;margin:0 auto!important;border-radius:10px!important;transform:none!important}
  html body.cgpt-infografias main .seo-card h2,html body.cgpt-infografias main .seo-card h3{font-size:20px!important;line-height:1.18!important;margin:7px 0!important;color:#6B1E26!important;overflow-wrap:anywhere!important}
  html body.cgpt-infografias main .seo-card p{font-size:14px!important;line-height:1.42!important;margin:0 0 8px!important;color:#61574F!important}
  html body.cgpt-reading main .max-w-4xl{width:100%!important;max-width:720px!important;margin:0 auto!important;padding:18px 18px 34px!important;gap:14px!important}
  html body.cgpt-reading main h1{font-size:29px!important;line-height:1.08!important;letter-spacing:-.02em!important;margin:8px 0 12px!important;color:#6B1E26!important;overflow-wrap:anywhere!important}
  html body.cgpt-reading main h2{font-size:22px!important;line-height:1.18!important;margin:22px 0 9px!important;color:#6B1E26!important;overflow-wrap:anywhere!important}
  html body.cgpt-reading main h3{font-size:19px!important;line-height:1.22!important;margin:18px 0 8px!important;color:#6B1E26!important}
  html body.cgpt-reading main p,html body.cgpt-reading main li,html body.cgpt-reading main blockquote{font-size:16px!important;line-height:1.55!important;overflow-wrap:anywhere!important;color:#2D241E!important}
  html body.cgpt-reading main p{margin:0 0 13px!important}
  html body.cgpt-reading main img,html body.cgpt-reading main video,html body.cgpt-reading main iframe{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;margin:10px auto 14px!important}
  html body.cgpt-reading main table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;font-size:14px!important}
  html body.cgpt-reading main th,html body.cgpt-reading main td{min-width:110px!important;padding:8px!important;font-size:14px!important;line-height:1.4!important;white-space:normal!important;overflow-wrap:anywhere!important}
  html body.cgpt-fe main{padding:18px 16px 34px!important}
  html body.cgpt-fe main h1{font-size:28px!important;line-height:1.12!important;margin:8px 0 12px!important;color:#6B1E26!important}
  html body.cgpt-fe main h2{font-size:21px!important;line-height:1.18!important;margin:16px 0 8px!important;color:#6B1E26!important}
  html body.cgpt-fe main p{font-size:15px!important;line-height:1.48!important}
  html body.cgpt-fe main form{display:flex!important;gap:8px!important;flex-wrap:wrap!important;width:100%!important;margin:12px 0!important}
  html body.cgpt-fe main input[type="search"],html body.cgpt-fe main input[type="text"]{flex:1 1 200px!important;min-width:0!important;height:42px!important;padding:8px 12px!important;border:1px solid #D8D0C5!important;border-radius:12px!important;background:#fff!important;font-size:16px!important;color:#2D241E!important}
  html body.cgpt-fe main button,html body.cgpt-fe main input[type="submit"]{min-height:42px!important;padding:8px 16px!important;border:0!important;border-radius:12px!important;background:#6B1E26!important;color:#fff!important;font-size:14px!important;font-weight:700!important}
  html body.cgpt-fe main .seo-card{width:100%!important;max-width:360px!important;margin:0 auto 16px!important;padding:15px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 3px 12px rgba(37,27,21,.04)!important}
  html body.cgpt-ninos main{padding:18px 14px 32px!important}
  html body.cgpt-ninos main h1{font-size:28px!important;line-height:1.1!important;color:#6B1E26!important}
  html body.cgpt-ninos main h2{font-size:22px!important;line-height:1.15!important;color:#6B1E26!important}
  html body.cgpt-ninos main p,html body.cgpt-ninos main li{font-size:15px!important;line-height:1.48!important}
  html body.cgpt-ninos main form{display:flex!important;gap:8px!important;flex-wrap:wrap!important;width:100%!important}
  html body.cgpt-ninos main input{min-width:0!important;max-width:100%!important;height:42px!important;padding:8px 12px!important;border:1px solid #D8D0C5!important;border-radius:12px!important;background:#fff!important;font-size:16px!important}
  html body.cgpt-ninos main button{min-height:42px!important;padding:8px 14px!important;border-radius:10px!important;background:#6B1E26!important;color:#fff!important;border:0!important}
  html body.cgpt-ninos main .seo-card{width:100%!important;max-width:360px!important;margin:0 auto 18px!important;padding:14px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important}
  html body.cgpt-ninos main .seo-card img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:55vh!important;object-fit:contain!important;margin:0 auto 12px!important}
  html body.cgpt-login main,html body.cgpt-admin main{padding:18px 14px 34px!important}
  html body.cgpt-login main>div,html body.cgpt-admin main>div{width:100%!important;max-width:420px!important;margin:16px auto!important;padding:18px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;box-shadow:0 4px 16px rgba(37,27,21,.05)!important;overflow:hidden!important}
  html body.cgpt-login main h1,html body.cgpt-admin main h1{font-size:27px!important;line-height:1.12!important;margin:0 0 10px!important;color:#6B1E26!important}
  html body.cgpt-login main p,html body.cgpt-admin main p{font-size:15px!important;line-height:1.45!important;margin:0 0 12px!important}
  html body.cgpt-login main form{display:flex!important;flex-direction:column!important;gap:10px!important}
  html body.cgpt-login main input{width:100%!important;min-height:44px!important;padding:10px 12px!important;border:1px solid #D8D0C5!important;border-radius:11px!important;background:#fff!important;font-size:16px!important;color:#2D241E!important}
  html body.cgpt-login main button,html body.cgpt-login main input[type="submit"],html body.cgpt-admin main a[href*="login"]{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-height:44px!important;padding:10px 14px!important;border:0!important;border-radius:11px!important;background:#6B1E26!important;color:#fff!important;text-decoration:none!important;font-size:14px!important;font-weight:700!important}
  html body.cgpt-home #welcome-screen h1{font-size:23px!important;line-height:1.1!important;text-align:center!important;color:#6B1E26!important}
  html body.cgpt-home #welcome-screen p{font-size:13px!important;line-height:1.4!important;text-align:center!important}
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
` + "`" + String.raw`;

  function classify(){
    var p=(location.pathname||'/').toLowerCase();
    var b=document.body;if(!b)return;
    if(p==='/'||p==='')b.classList.add('cgpt-home');
    if(p==='/infografias'||p==='/infografias/')b.classList.add('cgpt-infografias');
    if(p==='/ninos'||p.indexOf('/ninos/')===0)b.classList.add('cgpt-ninos');
    if(p==='/fe-catolica'||p==='/fe-catolica/'||p.indexOf('/fe-catolica/')===0)b.classList.add('cgpt-fe');
    if(p==='/login'||p.indexOf('/login?')===0)b.classList.add('cgpt-login');
    if(p==='/admin'||p.indexOf('/admin/')===0)b.classList.add('cgpt-admin');
    var reading=p.indexOf('/santoral/')===0||p==='/santo-del-dia'||p.indexOf('/blog/')===0||p.indexOf('/articulo/')===0||p.indexOf('/ia-catolica')===0||p.indexOf('/chat-catolico')===0||p.indexOf('/inteligencia-artificial-catolica')===0||p.indexOf('/sobre-catolicosgpt')===0||p.indexOf('/fuentes-doctrinales')===0||p.indexOf('/mejor-ia-catolica')===0||p.indexOf('/catequista-ia-catolica')===0||p.indexOf('/fe-catolica/')===0;
    if(reading)b.classList.add('cgpt-reading');
  }
  function install(){
    classify();
    if(document.getElementById('catolicosgpt-ui-style-lock'))return;
    var s=document.createElement('style');
    s.id='catolicosgpt-ui-style-lock';
    s.textContent=css;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  setTimeout(install,120);
})();
</script>`;

fs.readFileSync = function uiStyleRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
    if (resolved !== path.resolve(serverPath) || !encoding) return result;
    let source = String(result);
    if (!source.includes('catolicosgpt-ui-style-lock-bootstrap')) {
      source = source.replace('</head>', STYLE_LOCK + '\n</head>');
    }
    return source;
  } catch (_) {
    return result;
  }
};

try {
  require('./stable-ui-final');
} finally {
  fs.readFileSync = originalReadFileSync;
}
