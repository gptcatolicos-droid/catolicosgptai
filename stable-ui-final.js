// CatolicosGPT — single stable UI layer
// This is the ONLY presentation wrapper loaded by npm start.
// Recovery/backup/data stay owned by stable-start.js.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

// Reuse the exact approved favicon already embedded in the legacy SEO wrapper,
// without executing that wrapper or any of its chained presentation layers.
let faviconB64 = '';
try {
  const legacy = originalReadFileSync(path.join(__dirname, 'seo-ux-final.js'), 'utf8');
  const match = legacy.match(/const FAVICON_B64 = '([^']+)'/);
  if (match) faviconB64 = match[1];
} catch (_) {}

const UI = `
<link rel="icon" type="image/png" sizes="96x96" href="/favicon.png?v=20260823">
<link rel="shortcut icon" href="/favicon.ico?v=20260823">
<link rel="apple-touch-icon" href="/favicon.png?v=20260823">
<meta name="application-name" content="CatólicosGPT">
<meta name="theme-color" content="#6B1E26">
<style id="catolicosgpt-stable-ui-final">
*,*::before,*::after{box-sizing:border-box}
html,body{max-width:100%;overflow-x:hidden}
img{max-width:100%;height:auto}
@media(max-width:767px){
  body{margin:0;background:#F9F6F0;color:#2D241E}
  main{width:100%!important;max-width:100%!important;overflow-x:hidden!important}

  /* HEADER */
  body>header{position:sticky!important;top:0!important;z-index:900!important;min-height:70px!important;padding:10px 14px!important;background:#fff!important;border-bottom:1px solid #E6DFD4!important}
  body>header svg{max-width:30px!important;max-height:30px!important}

  /* DRAWER — explicit IDs; no DOM guessing */
  #mobile-drawer{position:fixed!important;inset:0!important;z-index:1000!important;background:rgba(24,18,15,.42)!important}
  #mobile-drawer-content{width:min(84vw,320px)!important;max-width:320px!important;height:100dvh!important;padding:16px!important;background:#fff!important;overflow-y:auto!important;box-shadow:8px 0 28px rgba(34,24,18,.18)!important}
  #mobile-drawer-content h1,#mobile-drawer-content h2,#mobile-drawer-content h3{font-size:12px!important;line-height:1.2!important;letter-spacing:.09em!important;text-transform:uppercase!important;color:#6B1E26!important;margin:18px 6px 7px!important}
  #mobile-drawer-content nav{display:flex!important;flex-direction:column!important;gap:3px!important}
  #mobile-drawer-content a,#mobile-drawer-content .nav-link,#mobile-drawer-content nav button{display:flex!important;align-items:center!important;gap:10px!important;width:100%!important;min-height:40px!important;padding:8px 10px!important;margin:0!important;border:0!important;border-radius:10px!important;background:transparent!important;color:#2D241E!important;text-decoration:none!important;font-size:14px!important;line-height:1.2!important;text-align:left!important}
  #mobile-drawer-content svg{width:18px!important;height:18px!important;max-width:18px!important;max-height:18px!important;flex:0 0 18px!important}
  #mobile-drawer-content button[aria-label*="errar"],#mobile-drawer-content button[aria-label*="lose"]{width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;justify-content:center!important;border:1px solid #E6DFD4!important;background:#fff!important;font-size:20px!important}

  /* HOME — chat first. No recommendation cards. */
  body.cgpt-home #welcome-screen{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:10px!important;padding:18px 18px 8px!important;min-height:0!important}
  body.cgpt-home #welcome-screen>div:first-child{display:none!important}
  body.cgpt-home #welcome-screen h1{font-size:24px!important;line-height:1.08!important;margin:0!important;text-align:center!important;color:#6B1E26!important}
  body.cgpt-home #welcome-screen p{font-size:14px!important;line-height:1.35!important;margin:0!important;text-align:center!important;max-width:34rem!important}
  body.cgpt-home #welcome-screen .welcome-cards,body.cgpt-home #welcome-screen .grid{display:none!important}

  /* READING / BLOG / SANTORAL */
  body.cgpt-reading main{padding:22px 18px 34px!important}
  body.cgpt-reading main>div,body.cgpt-reading main>article,body.cgpt-reading main>section{width:100%!important;max-width:720px!important;margin-left:auto!important;margin-right:auto!important}
  body.cgpt-reading main h1{font-size:32px!important;line-height:1.08!important;letter-spacing:-.02em!important;margin:10px 0 16px!important;overflow-wrap:anywhere!important}
  body.cgpt-reading main h2{font-size:24px!important;line-height:1.16!important;margin:26px 0 10px!important;overflow-wrap:anywhere!important}
  body.cgpt-reading main h3{font-size:20px!important;line-height:1.2!important;margin:22px 0 8px!important}
  body.cgpt-reading main p,body.cgpt-reading main li,body.cgpt-reading main blockquote{font-size:17px!important;line-height:1.58!important;overflow-wrap:anywhere!important}
  body.cgpt-reading main p{margin:0 0 15px!important}
  body.cgpt-reading main img,body.cgpt-reading main video,body.cgpt-reading main iframe{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;margin-left:auto!important;margin-right:auto!important}
  body.cgpt-reading main table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;font-size:14px!important}
  body.cgpt-reading main th,body.cgpt-reading main td{min-width:120px!important;padding:9px!important;font-size:14px!important;line-height:1.38!important;white-space:normal!important;overflow-wrap:anywhere!important}
  body.cgpt-reading main a[class*="px-"],body.cgpt-reading main button{max-width:100%!important;white-space:normal!important}

  /* NIÑOS / RECURSOS */
  body.cgpt-ninos main{padding:18px 14px 32px!important}
  body.cgpt-ninos main h1{font-size:30px!important;line-height:1.08!important;margin:8px 0 12px!important}
  body.cgpt-ninos main h2{font-size:24px!important;line-height:1.15!important;margin:20px 0 9px!important}
  body.cgpt-ninos main h3{font-size:20px!important;line-height:1.18!important}
  body.cgpt-ninos main p,body.cgpt-ninos main li{font-size:16px!important;line-height:1.5!important}
  body.cgpt-ninos main form{display:flex!important;gap:8px!important;flex-wrap:wrap!important;width:100%!important}
  body.cgpt-ninos main input[type="search"],body.cgpt-ninos main input[type="text"]{flex:1 1 190px!important;min-width:0!important;max-width:100%!important;height:42px!important;padding:8px 12px!important;font-size:16px!important;border:1px solid #D8D0C5!important;border-radius:12px!important;background:#fff!important}
  body.cgpt-ninos main button{min-height:42px!important;padding:8px 14px!important;font-size:14px!important;border-radius:10px!important}
  body.cgpt-ninos main .seo-card{width:100%!important;max-width:360px!important;margin:0 auto 18px!important;padding:14px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important}
  body.cgpt-ninos main .seo-card img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:55vh!important;object-fit:contain!important;margin:0 auto 12px!important}
  body.cgpt-ninos main .seo-card h2,body.cgpt-ninos main .seo-card h3{font-size:21px!important;line-height:1.16!important;margin:8px 0!important}
  body.cgpt-ninos main .seo-card p{font-size:15px!important;line-height:1.45!important}

  /* INFOGRAFÍAS — full covers, never crop 1:1 or 9:16 */
  body.cgpt-infografias main{padding-left:14px!important;padding-right:14px!important}
  body.cgpt-infografias main .seo-card{width:100%!important;max-width:350px!important;margin:0 auto 18px!important;padding:12px!important;border:1px solid #E4DDD3!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 4px 14px rgba(37,27,21,.05)!important}
  body.cgpt-infografias main .seo-card>a:first-child,body.cgpt-infografias main .seo-card>div:first-child{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-height:0!important;background:#F7F3ED!important;border-radius:12px!important;overflow:hidden!important}
  body.cgpt-infografias main .seo-card img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:62vh!important;object-fit:contain!important;object-position:center!important;margin:0 auto!important;border-radius:10px!important}
  body.cgpt-infografias main .seo-card h2,body.cgpt-infografias main .seo-card h3{font-size:21px!important;line-height:1.16!important;margin:8px 0!important;color:#6B1E26!important}
  body.cgpt-infografias main .seo-card p{font-size:14px!important;line-height:1.45!important;margin:0 0 8px!important;color:#61574F!important}
  body.cgpt-infografias main form{display:flex!important;gap:8px!important;flex-wrap:wrap!important}
  body.cgpt-infografias main input{min-width:0!important;max-width:100%!important}

  /* CHAT */
  #chat-box{max-width:100%!important;overflow-x:hidden!important}
  #chat-box h1{font-size:22px!important;line-height:1.16!important}
  #chat-box h2{font-size:19px!important;line-height:1.2!important}
  #chat-box h3{font-size:17px!important;line-height:1.22!important}
  #chat-box p,#chat-box li{font-size:15px!important;line-height:1.52!important}
  #chat-box table{display:block!important;width:100%!important;overflow-x:auto!important;font-size:13px!important}
}
</style>
<script id="catolicosgpt-stable-ui-final-runtime">
(function(){
  function setContext(){
    var p=(location.pathname||'/').toLowerCase();
    var b=document.body;
    if(p==='/' || p==='') b.classList.add('cgpt-home');
    if(p==='/infografias' || p==='/infografias/') b.classList.add('cgpt-infografias');
    if(p==='/ninos' || p.indexOf('/ninos/')===0) b.classList.add('cgpt-ninos');
    var reading = p.indexOf('/santoral/')===0 || p==='/santo-del-dia' || p.indexOf('/fe-catolica/')===0 || p.indexOf('/blog/')===0 || p.indexOf('/articulo/')===0 || p.indexOf('/ia-catolica')===0 || p.indexOf('/chat-catolico')===0 || p.indexOf('/inteligencia-artificial-catolica')===0 || p.indexOf('/sobre-catolicosgpt')===0 || p.indexOf('/fuentes-doctrinales')===0 || p.indexOf('/mejor-ia-catolica')===0 || p.indexOf('/catequista-ia-catolica')===0;
    if(reading) b.classList.add('cgpt-reading');

    // Home must remain chat-first: remove recommendation cards rather than restyling them.
    if(b.classList.contains('cgpt-home')){
      var welcome=document.getElementById('welcome-screen');
      if(welcome){
        var cards=welcome.querySelector('.welcome-cards') || welcome.querySelector('.grid');
        if(cards) cards.remove();
        var first=welcome.firstElementChild;
        if(first && /[✝✟✞✚➕]/.test(first.textContent||'')) first.remove();
      }
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setContext,{once:true});
  else setContext();
})();
</script>`;

fs.readFileSync = function stableUiRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
    if (resolved !== path.resolve(serverPath) || !encoding) return result;
    let source = String(result);

    // Public favicon routes using the exact approved icon from the prior wrapper.
    const anchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
    if (faviconB64 && source.includes(anchor) && !source.includes("app.get('/favicon.png'")) {
      const routes = `\nconst __cgptFavicon = Buffer.from('${faviconB64}', 'base64');\napp.get('/favicon.png', (req,res)=>{ res.set('Cache-Control','public, max-age=604800'); res.type('png').send(__cgptFavicon); });\napp.get('/favicon.ico', (req,res)=>{ res.set('Cache-Control','public, max-age=604800'); res.type('png').send(__cgptFavicon); });\n`;
      source = source.replace(anchor, anchor + routes);
    }

    if (!source.includes('catolicosgpt-stable-ui-final')) source = source.replace('</head>', UI + '\n</head>');
    return source;
  } catch (_) { return result; }
};

try { require('./stable-start'); }
finally { fs.readFileSync = originalReadFileSync; }
