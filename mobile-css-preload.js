// Production-safe HTML patch: replace Tailwind Play CDN v3 with the current
// Tailwind browser CDN served by jsDelivr. This runs before server.js and does
// not touch application data, Firestore, routes, or the Cloud Run startup flow.
const http = require('http');

const originalEnd = http.ServerResponse.prototype.end;

const replacement = `
<style type="text/tailwindcss">
  @theme {
    --color-cream: #F9F6F0;
    --color-cream2: #F1ECE3;
    --color-gold: #BC8A36;
    --color-goldDeep: #9F7124;
    --color-maroon: #5E1B22;
    --color-maroonDark: #320E12;
    --color-espresso: #251B15;
    --color-ink: #2D241E;
    --color-ink2: #5A4E46;
  }
</style>
<script>window.tailwind = window.tailwind || {};</script>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>`;

http.ServerResponse.prototype.end = function patchedEnd(chunk, encoding, callback) {
  try {
    const contentType = String(this.getHeader('content-type') || '');
    if (chunk && contentType.includes('text/html')) {
      const isBuffer = Buffer.isBuffer(chunk);
      let html = isBuffer ? chunk.toString('utf8') : String(chunk);
      if (html.includes('https://cdn.tailwindcss.com')) {
        html = html.replace(
          /<script\s+src=["']https:\/\/cdn\.tailwindcss\.com\/?["']><\/script>/i,
          replacement
        );
        const output = Buffer.from(html, 'utf8');
        this.setHeader('content-length', String(output.length));
        chunk = isBuffer ? output : html;
      }
    }
  } catch (err) {
    console.warn('[Mobile CSS] HTML patch skipped:', err.message);
  }
  return originalEnd.call(this, chunk, encoding, callback);
};

console.log('[Mobile CSS] Tailwind browser fallback enabled.');
