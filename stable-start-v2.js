// CatolicosGPT UI hardening wrapper — 2026-08-22
// Delegates all recovery/backup behavior to stable-start.js and only adds targeted mobile fixes.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const HARDENING_CSS = `
<style id="catolicosgpt-mobile-hardening-v2">
@media (max-width:767px){
  /* Never allow standalone UI SVGs to explode when Tailwind utilities are missing. */
  main svg{width:28px!important;height:28px!important;max-width:28px!important;max-height:28px!important;flex:0 0 28px!important}
  main button svg,main a svg{width:24px!important;height:24px!important;max-width:24px!important;max-height:24px!important}
  a[href*="wa.me"],a[href*="whatsapp"],a[href*="api.whatsapp"]{max-width:52px!important;max-height:52px!important}
  a[href*="wa.me"] svg,a[href*="whatsapp"] svg,a[href*="api.whatsapp"] svg{width:26px!important;height:26px!important;max-width:26px!important;max-height:26px!important}

  /* Chat welcome: compact, balanced and readable. */
  #welcome-screen{max-width:100%!important;padding:8px 8px 4px!important;gap:8px!important;justify-content:flex-start!important}
  #welcome-screen>div:first-child{width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;padding:6px!important;font-size:16px!important}
  #welcome-screen h1{font-size:20px!important;line-height:1.08!important;letter-spacing:0!important;margin:0!important}
  #welcome-screen p{font-size:12px!important;line-height:1.3!important;margin:0!important;padding:0 6px!important}
  #welcome-screen .grid{gap:8px!important;margin-top:2px!important}
  #welcome-screen .grid>a,#welcome-screen .grid>div{min-height:0!important;padding:12px!important;border-radius:15px!important}
  #chat-box{padding:10px 10px 6px!important}
  .chat-input-wrap{padding:8px 10px calc(8px + env(safe-area-inset-bottom))!important}
  .chat-input-wrap input,.chat-input-wrap textarea{min-height:44px!important;max-height:88px!important;padding:9px 13px!important;font-size:16px!important}
  .chat-input-wrap button{width:44px!important;height:44px!important;min-height:44px!important;flex-basis:44px!important;border-radius:14px!important}
  .chat-input-wrap>div:not(:first-child),.chat-input-wrap small{font-size:9px!important;line-height:1.2!important;margin-top:4px!important}

  /* Infographic detail: preserve the designed card instead of raw full-bleed content. */
  [data-infografia-frame]{width:100%!important;max-width:620px!important;margin:0 auto 16px!important;padding:8px!important;border:1px solid #E6DFD4!important;border-radius:16px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 3px 14px rgba(37,27,21,.05)!important}
  [data-infografia-frame] img{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;object-fit:contain!important;border-radius:10px!important}
  [data-infografia-frame]>.infografia-caption{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:6px 4px 2px!important;color:#6F6258!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;font-size:10px!important;line-height:1.25!important}
  [data-infografia-frame]>.infografia-caption span{font-size:10px!important;line-height:1.25!important}
  #vista-continua{gap:14px!important;padding:0!important}
  #vista-carrusel,#vista-cuadricula{width:100%!important;max-width:100%!important}
  #lightbox-modal svg{width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important}
}
</style>`;

fs.readFileSync = function hardenedRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
    if (resolved !== path.resolve(serverPath) || !encoding) return result;
    let source = String(result);

    // Mark the continuous infographic cards/captions so fallback CSS can target them safely.
    source = source.replace(
      '<div class="bg-cream border border-border/60 rounded-2xl overflow-hidden p-2.5 flex flex-col gap-3 shadow-sm max-w-xl mx-auto hover:border-gold/30 transition duration-300">',
      '<div data-infografia-frame class="bg-cream border border-border/60 rounded-2xl overflow-hidden p-2.5 flex flex-col gap-3 shadow-sm max-w-xl mx-auto hover:border-gold/30 transition duration-300">'
    );
    source = source.replace(
      '<div class="flex items-center justify-between text-xs px-2 py-1 text-ink2 font-mono">',
      '<div class="infografia-caption flex items-center justify-between text-xs px-2 py-1 text-ink2 font-mono">'
    );

    if (!source.includes('catolicosgpt-mobile-hardening-v2')) {
      source = source.replace('</head>', HARDENING_CSS + '\n</head>');
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
