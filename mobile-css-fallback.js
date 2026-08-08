const express = require('express');

const FALLBACK_STYLE = `
<style id="cgpt-mobile-fallback">
  :root {
    --cgpt-bg: #F7F4EE;
    --cgpt-surface: rgba(255,255,255,.88);
    --cgpt-surface-strong: #FFFFFF;
    --cgpt-border: rgba(94,27,34,.11);
    --cgpt-maroon: #5E1B22;
    --cgpt-maroon-dark: #3A1116;
    --cgpt-gold: #BC8A36;
    --cgpt-gold-soft: #E9D7B5;
    --cgpt-ink: #211B18;
    --cgpt-muted: #756A63;
    --cgpt-shadow: 0 18px 50px rgba(52,35,25,.10);
    --cgpt-radius: 22px;
  }

  html, body { margin: 0; min-height: 100%; }
  html { background: var(--cgpt-bg); }
  body {
    background:
      radial-gradient(circle at 50% -8%, rgba(188,138,54,.10), transparent 32rem),
      linear-gradient(180deg, #FBFAF7 0%, #F7F4EE 56%, #F4F0E8 100%);
    color: var(--cgpt-ink);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  *, *::before, *::after { box-sizing: border-box; }
  img, svg { max-width: 100%; }
  a { color: inherit; text-decoration: none; }
  button, input, textarea, select { font: inherit; }
  button { cursor: pointer; }

  .font-display,
  .font-serif { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif !important; }
  .font-mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace !important; }

  .flex { display: flex; }
  .grid { display: grid; }
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
  .rounded-lg { border-radius: .75rem; }
  .rounded-xl { border-radius: 1rem; }
  .rounded-2xl { border-radius: 1.25rem; }
  .rounded-full { border-radius: 9999px; }
  .border-b { border-bottom: 1px solid var(--cgpt-border); }
  .border-r { border-right: 1px solid var(--cgpt-border); }
  .shadow-sm { box-shadow: 0 1px 2px rgba(37,27,21,.08); }
  .text-maroon { color: var(--cgpt-maroon); }
  .text-gold { color: var(--cgpt-gold); }
  .text-ink { color: var(--cgpt-ink); }
  .bg-cream { background: var(--cgpt-bg); }
  .bg-cream2 { background: #EFE9DE; }
  .pointer-events-none { pointer-events: none !important; }
  .opacity-0 { opacity: 0 !important; }
  .opacity-100 { opacity: 1 !important; }
  .-translate-x-full { transform: translateX(-100%) !important; }
  .translate-x-0 { transform: translateX(0) !important; }

  /* App shell */
  body > .flex,
  body > div.flex { min-height: 100%; }
  main { min-width: 0; background: transparent; }

  /* Header móvil moderno */
  header.md\\:hidden {
    min-height: 64px;
    padding: 10px 16px !important;
    background: rgba(255,255,255,.88) !important;
    border-bottom: 1px solid rgba(94,27,34,.08) !important;
    box-shadow: 0 8px 30px rgba(47,34,25,.06) !important;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }
  header.md\\:hidden > div:first-child { gap: 10px !important; }
  header.md\\:hidden button {
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(94,27,34,.08);
    border-radius: 14px !important;
    background: rgba(255,255,255,.92) !important;
    box-shadow: 0 5px 18px rgba(52,35,25,.07);
    color: var(--cgpt-ink) !important;
  }
  header.md\\:hidden a[href="/"] {
    display: inline-flex;
    align-items: center;
    gap: 9px !important;
  }
  header.md\\:hidden a[href="/"] span {
    font-size: 18px !important;
    font-weight: 780 !important;
    letter-spacing: -.03em !important;
    color: var(--cgpt-maroon) !important;
  }
  svg.w-7.h-7 { width: 1.75rem !important; height: 1.75rem !important; }
  svg.w-10.h-10 { width: 2.5rem !important; height: 2.5rem !important; }

  /* Sidebar / drawer */
  .sidebar-desktop { display: flex; background: rgba(255,255,255,.94) !important; }
  .nav-link {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    min-height: 42px;
    padding: 10px 12px !important;
    border-radius: 12px !important;
    color: #443A34 !important;
    font-size: 13px !important;
    font-weight: 620 !important;
    transition: background .18s ease, color .18s ease, transform .18s ease;
  }
  .nav-link:hover,
  .nav-link.active {
    background: linear-gradient(135deg, rgba(94,27,34,.08), rgba(188,138,54,.10)) !important;
    color: var(--cgpt-maroon) !important;
    transform: translateX(1px);
  }
  #mobile-drawer { transition: opacity .25s ease; background: rgba(25,19,16,.36) !important; backdrop-filter: blur(4px); }
  #mobile-drawer-content {
    transition: transform .28s cubic-bezier(.22,1,.36,1);
    background: rgba(255,255,255,.98) !important;
    border-right: 1px solid rgba(94,27,34,.09);
    box-shadow: 18px 0 60px rgba(34,24,19,.15) !important;
  }
  #mobile-drawer-content > div:first-child { padding: 18px 16px !important; }
  #mobile-drawer-content nav { gap: 4px !important; }
  #mobile-drawer-content .text-\\[10px\\] {
    color: #998B82 !important;
    font-weight: 750 !important;
    letter-spacing: .11em !important;
  }

  /* Chat / home */
  .chat-shell {
    width: 100% !important;
    max-width: 1120px !important;
    margin: 0 auto !important;
    padding: 18px 18px 28px !important;
  }
  .chat-panel,
  .chat-panel.clean-chat {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
  }
  .chat-topbar {
    border: 0 !important;
    background: transparent !important;
  }
  #chat-box {
    background: transparent !important;
    border: 0 !important;
  }
  #welcome-screen {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 28px 8px 12px !important;
    text-align: center;
    align-items: center !important;
  }
  #welcome-screen > div:first-child {
    width: 54px !important;
    height: 54px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 18px !important;
    background: linear-gradient(145deg, #6B2230, #401118) !important;
    color: white !important;
    box-shadow: 0 14px 32px rgba(94,27,34,.24) !important;
    border: 1px solid rgba(255,255,255,.45);
    font-size: 23px !important;
  }
  #welcome-screen h1 {
    max-width: 760px;
    margin: 12px auto 6px !important;
    color: var(--cgpt-maroon-dark) !important;
    font-size: clamp(2rem, 5vw, 3.25rem) !important;
    line-height: 1.04 !important;
    letter-spacing: -.045em !important;
    font-weight: 800 !important;
  }
  #welcome-screen h1 span { color: var(--cgpt-gold) !important; }
  #welcome-screen p {
    max-width: 720px;
    margin: 0 auto !important;
    color: #776A62 !important;
    font-size: clamp(.98rem, 2vw, 1.08rem) !important;
    line-height: 1.5 !important;
    font-weight: 480 !important;
  }

  .welcome-cards {
    width: 100%;
    max-width: 820px;
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 14px !important;
    margin: 24px auto 0 !important;
    padding: 0 !important;
  }
  .welcome-card {
    min-height: 150px !important;
    padding: 18px !important;
    border-radius: var(--cgpt-radius) !important;
    background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(255,252,247,.91)) !important;
    border: 1px solid rgba(94,27,34,.075) !important;
    box-shadow: 0 14px 38px rgba(56,39,29,.07) !important;
    text-align: left !important;
    position: relative;
    overflow: hidden;
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .welcome-card::after {
    content: "";
    position: absolute;
    width: 100px;
    height: 100px;
    right: -36px;
    top: -36px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(188,138,54,.13), transparent 70%);
    pointer-events: none;
  }
  .welcome-card:hover {
    transform: translateY(-2px);
    border-color: rgba(188,138,54,.28) !important;
    box-shadow: 0 20px 44px rgba(56,39,29,.11) !important;
  }
  .welcome-card-icon {
    width: 38px !important;
    height: 38px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 13px !important;
    background: rgba(188,138,54,.10) !important;
    color: var(--cgpt-gold) !important;
    margin-bottom: 14px !important;
  }
  .welcome-card-title {
    display: block;
    color: var(--cgpt-gold) !important;
    font-size: 11px !important;
    line-height: 1.2 !important;
    letter-spacing: .08em !important;
    text-transform: uppercase !important;
    font-weight: 780 !important;
    margin-bottom: 6px !important;
  }
  .welcome-card-text {
    display: block;
    color: var(--cgpt-maroon-dark) !important;
    font-size: 17px !important;
    line-height: 1.25 !important;
    letter-spacing: -.02em !important;
    font-weight: 720 !important;
  }

  /* Composer moderno */
  .chat-input-wrap {
    width: min(920px, calc(100% - 24px)) !important;
    margin: 0 auto 10px !important;
    padding: 10px !important;
    background: rgba(255,255,255,.92) !important;
    border: 1px solid rgba(94,27,34,.10) !important;
    border-radius: 22px !important;
    box-shadow: 0 16px 42px rgba(44,31,24,.12) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .chat-input-wrap form,
  .chat-input-wrap > div {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
  }
  .chat-input-wrap input,
  .chat-input-wrap textarea {
    flex: 1 1 auto;
    min-height: 46px;
    border: 0 !important;
    outline: 0 !important;
    background: transparent !important;
    color: var(--cgpt-ink) !important;
    padding: 10px 12px !important;
    font-size: 15px !important;
    line-height: 1.4 !important;
    box-shadow: none !important;
  }
  .chat-input-wrap input::placeholder,
  .chat-input-wrap textarea::placeholder { color: #A09790 !important; }
  .chat-input-wrap button[type="submit"],
  .chat-input-wrap button:last-child {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    border: 0 !important;
    border-radius: 14px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: linear-gradient(145deg, var(--cgpt-maroon), var(--cgpt-maroon-dark)) !important;
    color: white !important;
    box-shadow: 0 10px 22px rgba(94,27,34,.20) !important;
  }
  .chat-input-wrap + div,
  .chat-input-wrap ~ p,
  .chat-input-wrap small {
    color: #8D817A !important;
    font-size: 10px !important;
    line-height: 1.35 !important;
    font-weight: 500 !important;
  }

  /* Content surfaces / site general */
  article,
  .content-html,
  .blog-content,
  .santo-biografia,
  .embedded-reader {
    color: #3C332E;
  }
  .content-html h1, .content-html h2, .content-html h3,
  .blog-content h1, .blog-content h2, .blog-content h3,
  .santo-biografia h1, .santo-biografia h2, .santo-biografia h3 {
    color: var(--cgpt-maroon-dark) !important;
    letter-spacing: -.025em;
  }
  .content-html a, .blog-content a, .santo-biografia a { color: var(--cgpt-maroon) !important; text-decoration: underline; text-decoration-color: rgba(188,138,54,.55); text-underline-offset: 3px; }
  .content-html img, .blog-content img, .santo-biografia img { border-radius: 18px; }

  /* Generic cards and forms used throughout admin/public pages */
  .shadow,
  .shadow-md,
  .shadow-lg,
  .shadow-xl,
  .shadow-2xl { box-shadow: var(--cgpt-shadow) !important; }
  input, textarea, select {
    border-color: rgba(94,27,34,.14);
    border-radius: 12px;
  }

  @media (max-width: 767px) {
    .sidebar-desktop { display: none !important; }
    .md\\:hidden { display: flex !important; }
    body { overflow-x: hidden; }
    main { width: 100%; max-width: 100%; }
    #mobile-drawer-content { width: min(86vw, 320px) !important; max-width: 320px !important; }

    .chat-shell {
      max-width: 100% !important;
      padding: 10px 12px 18px !important;
      min-height: calc(100svh - 64px);
    }
    .chat-panel, #chat-box { max-width: 100% !important; }
    #chat-box { padding: 10px 0 118px !important; }
    #welcome-screen { padding: 20px 2px 8px !important; }
    #welcome-screen > div:first-child { width: 48px !important; height: 48px !important; border-radius: 16px !important; }
    #welcome-screen h1 {
      font-size: clamp(1.85rem, 8.2vw, 2.55rem) !important;
      max-width: 620px;
      margin-top: 14px !important;
    }
    #welcome-screen p {
      max-width: 560px;
      font-size: .96rem !important;
      padding: 0 6px;
    }
    .welcome-cards {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      margin-top: 18px !important;
    }
    .welcome-card {
      min-height: 112px !important;
      padding: 15px 16px !important;
      border-radius: 19px !important;
    }
    .welcome-card-icon { width: 34px !important; height: 34px !important; margin-bottom: 10px !important; }
    .welcome-card-text { font-size: 16px !important; }

    .chat-input-wrap {
      position: sticky !important;
      bottom: max(8px, env(safe-area-inset-bottom)) !important;
      z-index: 30 !important;
      width: calc(100% - 12px) !important;
      margin: 0 auto 6px !important;
      padding: 7px !important;
      border-radius: 19px !important;
    }
    .chat-input-wrap input,
    .chat-input-wrap textarea { min-height: 42px !important; font-size: 14px !important; }
    .chat-input-wrap button[type="submit"],
    .chat-input-wrap button:last-child { width: 40px !important; height: 40px !important; min-width: 40px !important; border-radius: 12px !important; }
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
