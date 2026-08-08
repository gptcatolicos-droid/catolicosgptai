const express = require('express');

const HOME_CHAT_STYLE = `
<style id="cgpt-home-chat-hotfix">
  /* Home: remove recommendation cards */
  .welcome-cards,
  .welcome-card {
    display: none !important;
  }

  /* Compact the welcome/hero once cards are removed */
  #welcome-screen {
    padding-bottom: 1rem !important;
  }

  /* Modern AI composer */
  .chat-input-wrap {
    position: sticky !important;
    bottom: 0 !important;
    z-index: 35 !important;
    width: 100% !important;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom)) !important;
    background: rgba(249, 246, 240, 0.92) !important;
    backdrop-filter: blur(18px) saturate(140%) !important;
    -webkit-backdrop-filter: blur(18px) saturate(140%) !important;
    border-top: 1px solid rgba(94, 27, 34, 0.08) !important;
    box-shadow: 0 -10px 30px rgba(37, 27, 21, 0.06) !important;
  }

  .chat-input-wrap form {
    position: relative !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    width: min(100%, 760px) !important;
    margin: 0 auto !important;
    padding: 6px !important;
    background: #ffffff !important;
    border: 1px solid rgba(94, 27, 34, 0.13) !important;
    border-radius: 22px !important;
    box-shadow:
      0 8px 24px rgba(37, 27, 21, 0.08),
      0 1px 2px rgba(37, 27, 21, 0.04) !important;
  }

  .chat-input-wrap textarea,
  .chat-input-wrap input[type="text"],
  .chat-input-wrap input:not([type]) {
    flex: 1 1 auto !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 48px !important;
    max-height: 140px !important;
    margin: 0 !important;
    padding: 12px 12px 12px 14px !important;
    border: 0 !important;
    outline: 0 !important;
    resize: none !important;
    background: transparent !important;
    color: #251B15 !important;
    font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    font-size: 16px !important;
    line-height: 1.35 !important;
    box-shadow: none !important;
  }

  .chat-input-wrap textarea::placeholder,
  .chat-input-wrap input::placeholder {
    color: #8D837D !important;
    opacity: 1 !important;
  }

  .chat-input-wrap button[type="submit"],
  .chat-input-wrap form > button:last-child {
    flex: 0 0 auto !important;
    width: 46px !important;
    height: 46px !important;
    min-width: 46px !important;
    min-height: 46px !important;
    margin: 0 !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    border: 0 !important;
    border-radius: 15px !important;
    background: #5E1B22 !important;
    color: #ffffff !important;
    box-shadow: 0 6px 16px rgba(94, 27, 34, 0.20) !important;
  }

  .chat-input-wrap button[type="submit"] svg,
  .chat-input-wrap form > button:last-child svg {
    width: 21px !important;
    height: 21px !important;
  }

  /* Any old disclaimer/footer inside composer must not reserve height */
  .chat-input-wrap .chat-disclaimer,
  .chat-input-wrap .disclaimer,
  .chat-input-wrap .ai-disclaimer,
  .chat-input-wrap small {
    display: none !important;
  }

  @media (max-width: 767px) {
    #welcome-screen {
      padding: 1.25rem 1.15rem 0.65rem !important;
    }

    .chat-input-wrap {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }

    .chat-input-wrap form {
      border-radius: 20px !important;
    }
  }
</style>`;

const HOME_CHAT_SCRIPT = `
<script id="cgpt-home-chat-hotfix-js">
(function () {
  function cleanupHomeChat() {
    document.querySelectorAll('.welcome-cards, .welcome-card').forEach(function (el) {
      el.style.setProperty('display', 'none', 'important');
    });

    var needles = [
      'Conforme al Magisterio constante de la Iglesia',
      'Puede contener imprecisiones'
    ];

    document.querySelectorAll('p, small, span, div').forEach(function (el) {
      if (!el || el.id === 'welcome-screen') return;
      var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!text || text.length > 260) return;

      if (needles.some(function (needle) { return text.indexOf(needle) !== -1; })) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('margin', '0', 'important');
        el.style.setProperty('padding', '0', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('min-height', '0', 'important');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanupHomeChat);
  } else {
    cleanupHomeChat();
  }

  setTimeout(cleanupHomeChat, 250);
  setTimeout(cleanupHomeChat, 1000);
})();
</script>`;

function installHomeChatHotfix() {
  if (express.response.__cgptHomeChatHotfixInstalled) return;
  express.response.__cgptHomeChatHotfixInstalled = true;

  const originalSend = express.response.send;

  express.response.send = function patchedHomeChatSend(body) {
    try {
      const contentType = String(this.getHeader('Content-Type') || '');

      if (
        typeof body === 'string' &&
        body.includes('<head>') &&
        !body.includes('id="cgpt-home-chat-hotfix"') &&
        (!contentType || contentType.includes('text/html'))
      ) {
        body = body.replace('<head>', `<head>${HOME_CHAT_STYLE}`);
        body = body.replace('</body>', `${HOME_CHAT_SCRIPT}</body>`);
      }
    } catch (err) {
      console.warn('[Home Chat Hotfix] No se pudo aplicar:', err.message);
    }

    return originalSend.call(this, body);
  };
}

module.exports = { installHomeChatHotfix };
