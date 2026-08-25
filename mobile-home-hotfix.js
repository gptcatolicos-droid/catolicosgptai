// CatolicosGPT mobile-home hotfix only.
// Purpose: keep the approved stable UI intact and normalize ONLY the home welcome block on phones.
const fs = require('fs');
const path = require('path');

const serverPath = require.resolve('./server');
const originalReadFileSync = fs.readFileSync.bind(fs);

const HOTFIX = `
<style id="cgpt-mobile-home-hotfix">
@media (max-width:767px){
  body.cgpt-home #welcome-screen{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    overflow:hidden!important;
  }
  body.cgpt-home #welcome-screen > *{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    margin-left:auto!important;
    margin-right:auto!important;
    transform:none!important;
  }
  body.cgpt-home #welcome-screen > div:first-child{
    display:flex!important;
    flex-direction:column!important;
    align-items:center!important;
    justify-content:center!important;
    gap:8px!important;
    position:static!important;
    inset:auto!important;
    float:none!important;
    text-align:center!important;
  }
  body.cgpt-home #welcome-screen > div:first-child > *{
    display:block!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    flex:0 1 auto!important;
    position:static!important;
    inset:auto!important;
    margin-left:0!important;
    margin-right:0!important;
    transform:none!important;
    float:none!important;
    text-align:center!important;
  }
  body.cgpt-home #welcome-screen h1,
  body.cgpt-home #welcome-screen p{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    white-space:normal!important;
    overflow:visible!important;
    overflow-wrap:break-word!important;
    word-break:normal!important;
    text-align:center!important;
  }
  body.cgpt-home #welcome-screen h1{
    font-size:24px!important;
    line-height:1.08!important;
  }
  body.cgpt-home #welcome-screen p{
    font-size:14px!important;
    line-height:1.35!important;
  }
}
</style>`;

fs.readFileSync = function mobileHomeHotfixRead(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    const encoding = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].encoding);
    if (resolved !== path.resolve(serverPath) || !encoding) return result;
    let source = String(result);
    if (!source.includes('cgpt-mobile-home-hotfix')) source = source.replace('</head>', HOTFIX + '\n</head>');
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
