const express = require('express');

const FALLBACK_STYLE = `
<style id="cgpt-mobile-fallback">
  html, body { margin: 0; min-height: 100%; }
  body { background: #F9F6F0; color: #2D241E; }
  *, *::before, *::after { box-sizing: border-box; }
  img, svg { max-width: 100%; }
  .flex { display: flex; }
  .hidden { display: none; }
  .flex-col { flex-direction: column; }
  .flex-1 { flex: 1 1 0%; }
  .flex-shrink-0 { flex-shrink: 0; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .justify-between { justify-content: space-between; }
  .justify-center { justify-content: center; }
  .overflow-hidden { overflow: hidden; }
  .overflow-y-auto { overflow-y: auto; }
  .w-full { width: 100%; }
  .h-full { height: 100%; }
  .min-w-0 { min-width: 0; }
  .w-7 { width: 1.75rem; }
  .h-7 { height: 1.75rem; }
  .w-10 { width: 2.5rem; }
  .h-10 { height: 2.5rem; }
  .w-64 { width: 16rem; }
  .gap-1 { gap: .25rem; }
  .gap-1\\.5 { gap: .375rem; }
  .gap-2 { gap: .5rem; }
  .gap-3 { gap: .75rem; }
  .gap-4 { gap: 1rem; }
  .p-1 { padding: .25rem; }
  .p-4 { padding: 1rem; }
  .px-4 { padding-left: 1rem; padding-right: 1rem; }
  .py-3 { padding-top: .75rem; padding-bottom: .75rem; }
  .sticky { position: sticky; }
  .fixed { position: fixed; }
  .top-0 { top: 0; }
  .inset-0 { inset: 0; }
  .z-40 { z-index: 40; }
  .z-50 { z-index: 50; }
  .bg-white { background: #fff; }
  .rounded { border-radius: .25rem; }
  .rounded-full { border-radius: 9999px; }
  .border-b { border-bottom: 1px solid #E6DFD4; }
  .border-r { border-right: 1px solid #E6DFD4; }
  .shadow-sm { box-shadow: 0 1px 2px rgba(37,27,21,.08); }
  .text-maroon { color: #5E1B22; }
  .text-gold { color: #BC8A36; }
  .text-ink { color: #2D241E; }
  .bg-cream { background: #F9F6F0; }
  .bg-cream2 { background: #F1ECE3; }
  .pointer-events-none { pointer-events: none !important; }
  .opacity-0 { opacity: 0 !important; }
  .opacity-100 { opacity: 1 !important; }
  .-translate-x-full { transform: translateX(-100%) !important; }
  .translate-x-0 { transform: translateX(0) !important; }
  .sidebar-desktop { display: flex; }
  #mobile-drawer { transition: opacity .3s ease; }
  #mobile-drawer-content { transition: transform .3s ease; }
  main { min-width: 0; }
  svg.w-7.h-7 { width: 1.75rem !important; height: 1.75rem !important; }
  svg.w-10.h-10 { width: 2.5rem !important; height: 2.5rem !important; }
  header.md\\:hidden { min-height: 56px; }
  @media (max-width: 767px) {
    .sidebar-desktop { display: none !important; }
    .md\\:hidden { display: flex !important; }
    body { overflow-x: hidden; }
    main { width: 100%; max-width: 100%; }
    #mobile-drawer-content { max-width: 18rem; }
    .chat-shell, .chat-panel, #chat-box { max-width: 100% !important; }
  }
  @media (min-width: 768px) {
    .md\\:hidden { display: none !important; }
  }
</style>`;

function installMobileCssFallback() {
  if (express.response.__cgptFallbackInstalled) return;
  express.response.__cgptFallbackInstalled = true;

  const originalSend = express.response.send;
  express.response.send = function patchedSend(body) {
    try {
      const contentType = String(this.getHeader('Content-Type') || '');
      if (typeof body === 'string' && body.includes('<head>') && !body.includes('id="cgpt-mobile-fallback"') && (!contentType || contentType.includes('text/html'))) {
        body = body.replace('<head>', `<head>${FALLBACK_STYLE}`);
      }
    } catch (err) {
      console.warn('[Mobile CSS Fallback] No se pudo inyectar fallback:', err.message);
    }
    return originalSend.call(this, body);
  };
}

module.exports = { installMobileCssFallback };
