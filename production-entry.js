// CatolicosGPT production entrypoint.
// Keeps recovery/admin features from stable-start while preventing its generic
// content-card rules from overriding the individual page designs.
const fs = require('fs');
const Module = require('module');

const stablePath = require.resolve('./stable-start');
const originalLoader = Module._extensions['.js'];

Module._extensions['.js'] = function productionStableLoader(mod, filename) {
  if (filename !== stablePath) return originalLoader(mod, filename);

  let source = fs.readFileSync(filename, 'utf8');

  // Never force every content card/image to fill the viewport. Each module owns
  // its own card, icon and cover dimensions. This was the source of the giant
  // PDF/social icons and oversized Fe Catolica/Catequesis cards on mobile.
  source = source.replace(
    /\n\s*\/\* Content pages: only containment, never global typography rewrites\. \*\/[\s\S]*?main form input\[type="text"\],main form input\[type="search"\]\{min-width:0!important;max-width:100%!important\}\n/,
    '\n'
  );

  // Home: preserve the first DOM node so legacy :first-child selectors can
  // never attach to the text wrapper. Hide it visually instead of removing it.
  source = source.replace(
    '#welcome-screen>div:first-child{width:42px!important;height:42px!important;border-radius:14px!important;font-size:18px!important}',
    '#welcome-screen>div:first-child{visibility:hidden!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important;padding:0!important;margin:0!important;border:0!important;overflow:hidden!important;font-size:0!important}' +
    '\n    #welcome-screen>div:nth-child(2){display:flex!important;flex-direction:column!important;width:100%!important;max-width:640px!important;min-width:0!important;margin-left:auto!important;margin-right:auto!important;align-items:center!important}'
  );

  // The approved home is chat-first. Recommendation cards stay in the DOM/data
  // model but are not presented on the welcome screen.
  source = source.replace(
    '.welcome-cards{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;margin-top:4px!important;padding:0!important}',
    '.welcome-cards{display:none!important}'
  );

  Module._extensions['.js'] = originalLoader;
  return mod._compile(source, filename);
};

require('./stable-start');
