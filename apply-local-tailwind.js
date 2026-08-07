const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');
let changed = false;

const cdnBlock = /\s*<script src=\\?"https:\/\/cdn\.tailwindcss\.com\\?"><\/script>\s*<script>\s*tailwind\.config\s*=\s*\{[\s\S]*?<\/script>/m;
if (cdnBlock.test(source)) {
  source = source.replace(cdnBlock, '\n  <link rel="stylesheet" href="/tailwind.css">');
  changed = true;
}

const middlewareAnchor = "app.use(express.urlencoded({ extended: true, limit: '80mb' }));";
const staticMiddleware = `${middlewareAnchor}\napp.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', immutable: false }));`;
if (!source.includes("express.static(path.join(__dirname, 'public')")) {
  if (!source.includes(middlewareAnchor)) {
    throw new Error('No se encontró el punto seguro para registrar /public; se aborta sin modificar server.js.');
  }
  source = source.replace(middlewareAnchor, staticMiddleware);
  changed = true;
}

if (source.includes('cdn.tailwindcss.com')) {
  throw new Error('La dependencia de cdn.tailwindcss.com sigue presente; se aborta para evitar un parche parcial.');
}

if (changed) {
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Tailwind local] server.js preparado para CSS local.');
} else {
  console.log('[Tailwind local] server.js ya estaba preparado.');
}
